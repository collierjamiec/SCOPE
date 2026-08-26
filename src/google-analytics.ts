import { createHash, randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const scope = 'https://www.googleapis.com/auth/analytics.readonly';
const metrics = ['sessions', 'totalUsers', 'engagedSessions', 'engagementRate', 'bounceRate', 'keyEvents'] as const;

export interface GoogleAnalyticsLocalCredentials {
  clientId: string;
  clientSecret?: string;
  refreshToken?: string;
}

export interface GoogleAnalyticsProperty {
  property: string;
  displayName: string;
  account: string;
  accountDisplayName: string;
  propertyType?: string;
}

export interface GoogleAnalyticsReportOptions {
  property: string;
  startDate: string;
  endDate: string;
  maximumRows?: number;
}

export interface GoogleAnalyticsTotals {
  sessions: number;
  totalUsers: number;
  engagedSessions: number;
  engagementRate: number | null;
  bounceRate: number | null;
  keyEvents: number;
}

export interface GoogleAnalyticsDataQuality {
  timeZone?: string;
  currencyCode?: string;
  subjectToThresholding: boolean;
  dataLossFromOtherRow: boolean;
  sampled: boolean;
}

type GoogleFetchOptions = {
  fetchFn?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  maxRetries?: number;
};

export function googleAnalyticsCredentialPath(): string {
  return process.env.SCOPE_GOOGLE_ANALYTICS_CREDENTIALS_FILE
    ?? join(process.env.SCOPE_DATA_DIR ?? resolve(process.cwd(), '.scope'), 'google-analytics.json');
}

export async function loadGoogleAnalyticsCredentials(): Promise<GoogleAnalyticsLocalCredentials | undefined> {
  try {
    const parsed = JSON.parse(await readFile(googleAnalyticsCredentialPath(), 'utf8')) as GoogleAnalyticsLocalCredentials;
    return parsed.clientId ? parsed : undefined;
  } catch { return undefined; }
}

export async function saveGoogleAnalyticsCredentials(credentials: GoogleAnalyticsLocalCredentials): Promise<void> {
  const path = googleAnalyticsCredentialPath();
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600 });
  await chmod(temporary, 0o600);
  await rename(temporary, path);
  await chmod(path, 0o600);
}

export async function removeGoogleAnalyticsCredentials(): Promise<void> {
  try { await unlink(googleAnalyticsCredentialPath()); } catch { /* Already absent. */ }
}

export function createGoogleAnalyticsAuthorization(clientId: string, redirectUri: string, state: string) {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  for (const [key, value] of Object.entries({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope, access_type: 'offline', prompt: 'consent select_account', state, code_challenge: challenge, code_challenge_method: 'S256' })) url.searchParams.set(key, value);
  return { url: url.href, verifier };
}

async function tokenRequest(values: Record<string, string>, fetchFn: typeof fetch = fetch): Promise<any> {
  const response = await fetchFn('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(values) });
  const data = await response.json() as any;
  if (!response.ok) throw new Error(data.error_description ?? data.error ?? `Google OAuth returned HTTP ${response.status}`);
  return data;
}

export async function exchangeGoogleAnalyticsCode(credentials: GoogleAnalyticsLocalCredentials, code: string, verifier: string, redirectUri: string): Promise<GoogleAnalyticsLocalCredentials> {
  const data = await tokenRequest({ client_id: credentials.clientId, ...(credentials.clientSecret ? { client_secret: credentials.clientSecret } : {}), code, code_verifier: verifier, redirect_uri: redirectUri, grant_type: 'authorization_code' });
  if (!data.refresh_token) throw new Error('Google did not return a refresh token. Reconnect and approve offline access.');
  return { ...credentials, refreshToken: String(data.refresh_token) };
}

async function accessToken(credentials: GoogleAnalyticsLocalCredentials, fetchFn: typeof fetch = fetch): Promise<string> {
  if (!credentials.refreshToken) throw new Error('Google Analytics 4 is not connected.');
  const data = await tokenRequest({ client_id: credentials.clientId, ...(credentials.clientSecret ? { client_secret: credentials.clientSecret } : {}), refresh_token: credentials.refreshToken, grant_type: 'refresh_token' }, fetchFn);
  return String(data.access_token);
}

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));
const retryAfter = (value: string | null, attempt: number) => {
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(60_000, seconds * 1_000);
  const date = value ? Date.parse(value) : Number.NaN;
  if (Number.isFinite(date)) return Math.min(60_000, Math.max(0, date - Date.now()));
  return Math.min(30_000, 1_000 * (2 ** attempt));
};

async function googleJson(url: string, token: string, init: RequestInit = {}, options: GoogleFetchOptions = {}): Promise<any> {
  const fetchFn = options.fetchFn ?? fetch, sleep = options.sleep ?? wait, maxRetries = options.maxRetries ?? 3;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetchFn(url, { ...init, headers: { ...init.headers, authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
    const data = await response.json().catch(() => ({})) as any;
    if (response.ok) return data;
    const retryable = response.status === 429 || response.status === 500 || response.status === 503;
    if (retryable && attempt < maxRetries) { await sleep(retryAfter(response.headers.get('retry-after'), attempt)); continue; }
    const prefix = response.status === 429 ? 'Google Analytics quota or rate limit was exhausted' : 'Google Analytics Data API request failed';
    throw new Error(`${prefix} (HTTP ${response.status}): ${data.error?.message ?? data.error_description ?? data.error ?? 'No additional details were returned.'}`);
  }
  throw new Error('Google Analytics Data API retry limit was exhausted.');
}

export async function listGoogleAnalyticsProperties(credentials: GoogleAnalyticsLocalCredentials, options: GoogleFetchOptions = {}): Promise<GoogleAnalyticsProperty[]> {
  const fetchFn = options.fetchFn ?? fetch, token = await accessToken(credentials, fetchFn), properties: GoogleAnalyticsProperty[] = [];
  let pageToken = '';
  do {
    const endpoint = new URL('https://analyticsadmin.googleapis.com/v1alpha/accountSummaries');
    endpoint.searchParams.set('pageSize', '200');
    if (pageToken) endpoint.searchParams.set('pageToken', pageToken);
    const data = await googleJson(endpoint.href, token, {}, options);
    for (const account of data.accountSummaries ?? []) {
      for (const property of account.propertySummaries ?? []) properties.push({ property: String(property.property), displayName: String(property.displayName ?? property.property), account: String(account.account ?? ''), accountDisplayName: String(account.displayName ?? account.account ?? ''), propertyType: property.propertyType ? String(property.propertyType) : undefined });
    }
    pageToken = String(data.nextPageToken ?? '');
  } while (pageToken);
  return properties.sort((a, b) => a.accountDisplayName.localeCompare(b.accountDisplayName) || a.displayName.localeCompare(b.displayName));
}

const csv = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const metricValue = (row: any, index: number) => {
  const parsed = Number(row?.metricValues?.[index]?.value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const totalsFrom = (row: any): GoogleAnalyticsTotals => ({
  sessions: metricValue(row, 0),
  totalUsers: metricValue(row, 1),
  engagedSessions: metricValue(row, 2),
  engagementRate: row?.metricValues?.[3]?.value === undefined ? null : metricValue(row, 3),
  bounceRate: row?.metricValues?.[4]?.value === undefined ? null : metricValue(row, 4),
  keyEvents: metricValue(row, 5)
});

export async function fetchGoogleAnalyticsLandingPages(credentials: GoogleAnalyticsLocalCredentials, report: GoogleAnalyticsReportOptions, options: GoogleFetchOptions = {}): Promise<{ csv: string; rows: number; totals: GoogleAnalyticsTotals; quality: GoogleAnalyticsDataQuality; quota?: any }> {
  const property = report.property.startsWith('properties/') ? report.property : `properties/${report.property}`;
  if (!/^properties\/\d+$/.test(property)) throw new Error('Choose a valid GA4 property.');
  const fetchFn = options.fetchFn ?? fetch, token = await accessToken(credentials, fetchFn), maximumRows = Math.min(1_000_000, Math.max(1, report.maximumRows ?? 250_000));
  const collected: any[] = []; let totals: GoogleAnalyticsTotals | undefined, metadata: any = {}, quota: any;
  while (collected.length < maximumRows) {
    const limit = Math.min(250_000, maximumRows - collected.length);
    const data = await googleJson(`https://analyticsdata.googleapis.com/v1beta/${property}:runReport`, token, { method: 'POST', body: JSON.stringify({
      dateRanges: [{ startDate: report.startDate, endDate: report.endDate }],
      dimensions: [{ name: 'landingPagePlusQueryString' }],
      metrics: metrics.map(name => ({ name })),
      metricAggregations: ['TOTAL'],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: String(limit), offset: String(collected.length), returnPropertyQuota: true
    }) }, options);
    collected.push(...(data.rows ?? []));
    totals ??= totalsFrom(data.totals?.[0]);
    metadata = data.metadata ?? metadata; quota = data.propertyQuota ?? quota;
    if (collected.length >= Number(data.rowCount ?? collected.length) || !(data.rows?.length)) break;
  }
  totals ??= { sessions: 0, totalUsers: 0, engagedSessions: 0, engagementRate: null, bounceRate: null, keyEvents: 0 };
  const lines = [
    `# Start date: ${report.startDate}`,
    `# End date: ${report.endDate}`,
    '# Source: Google Analytics Data API',
    `# Property: ${property}`,
    'Landing page + query string,Sessions,Total users,Engaged sessions,Engagement rate,Bounce rate,Key events',
    ...collected.map(row => [row.dimensionValues?.[0]?.value, ...metrics.map((_, index) => row.metricValues?.[index]?.value)].map(csv).join(','))
  ];
  const quality: GoogleAnalyticsDataQuality = {
    timeZone: metadata.timeZone ? String(metadata.timeZone) : undefined,
    currencyCode: metadata.currencyCode ? String(metadata.currencyCode) : undefined,
    subjectToThresholding: Boolean(metadata.subjectToThresholding),
    dataLossFromOtherRow: Boolean(metadata.dataLossFromOtherRow),
    sampled: Boolean(metadata.samplingMetadatas?.length)
  };
  return { csv: `${lines.join('\n')}\n`, rows: collected.length, totals, quality, quota };
}
