import { createHash, randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const scope = 'https://www.googleapis.com/auth/webmasters.readonly';

export interface GoogleLocalCredentials {
  clientId: string;
  clientSecret?: string;
  refreshToken?: string;
}

export interface SearchConsoleSite { siteUrl: string; permissionLevel: string }
export interface SearchConsoleQueryOptions { siteUrl: string; startDate: string; endDate: string; maximumRows?: number }

export function googleCredentialPath(): string {
  return process.env.SCOPE_GOOGLE_CREDENTIALS_FILE
    ?? join(process.env.SCOPE_DATA_DIR ?? resolve(process.cwd(), '.scope'), 'google-search-console.json');
}

export async function loadGoogleCredentials(): Promise<GoogleLocalCredentials | undefined> {
  try {
    const parsed = JSON.parse(await readFile(googleCredentialPath(), 'utf8')) as GoogleLocalCredentials;
    return parsed.clientId ? parsed : undefined;
  } catch { return undefined; }
}

export async function saveGoogleCredentials(credentials: GoogleLocalCredentials): Promise<void> {
  const path = googleCredentialPath(); await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600 });
  await chmod(temporary, 0o600); await rename(temporary, path); await chmod(path, 0o600);
}

export async function removeGoogleCredentials(): Promise<void> {
  try { await unlink(googleCredentialPath()); } catch { /* Already absent. */ }
}

export function createGoogleAuthorization(clientId: string, redirectUri: string, state: string) {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  for (const [key, value] of Object.entries({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope, access_type: 'offline', prompt: 'consent select_account', state, code_challenge: challenge, code_challenge_method: 'S256' })) url.searchParams.set(key, value);
  return { url: url.href, verifier };
}

async function tokenRequest(values: Record<string, string>): Promise<any> {
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(values) });
  const data = await response.json() as any;
  if (!response.ok) throw new Error(data.error_description ?? data.error ?? `Google OAuth returned HTTP ${response.status}`);
  return data;
}

export async function exchangeGoogleCode(credentials: GoogleLocalCredentials, code: string, verifier: string, redirectUri: string): Promise<GoogleLocalCredentials> {
  const data = await tokenRequest({ client_id: credentials.clientId, ...(credentials.clientSecret ? { client_secret: credentials.clientSecret } : {}), code, code_verifier: verifier, redirect_uri: redirectUri, grant_type: 'authorization_code' });
  if (!data.refresh_token) throw new Error('Google did not return a refresh token. Reconnect and approve offline access.');
  return { ...credentials, refreshToken: String(data.refresh_token) };
}

async function accessToken(credentials: GoogleLocalCredentials): Promise<string> {
  if (!credentials.refreshToken) throw new Error('Google Search Console is not connected.');
  const data = await tokenRequest({ client_id: credentials.clientId, ...(credentials.clientSecret ? { client_secret: credentials.clientSecret } : {}), refresh_token: credentials.refreshToken, grant_type: 'refresh_token' });
  return String(data.access_token);
}

async function googleJson(url: string, token: string, init?: RequestInit): Promise<any> {
  const response = await fetch(url, { ...init, headers: { ...init?.headers, authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  const data = await response.json() as any;
  if (!response.ok) throw new Error(data.error?.message ?? `Google Search Console returned HTTP ${response.status}`);
  return data;
}

export async function listSearchConsoleSites(credentials: GoogleLocalCredentials): Promise<SearchConsoleSite[]> {
  const data = await googleJson('https://www.googleapis.com/webmasters/v3/sites', await accessToken(credentials));
  return (data.siteEntry ?? []).filter((site: any) => site.siteUrl && site.permissionLevel !== 'siteUnverifiedUser');
}

const csv = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

export async function fetchSearchConsoleQueryPages(credentials: GoogleLocalCredentials, options: SearchConsoleQueryOptions): Promise<{ csv: string; rows: number }> {
  const token = await accessToken(credentials), maximum = Math.min(50_000, Math.max(1, options.maximumRows ?? 50_000));
  const collected: any[] = [];
  while (collected.length < maximum) {
    const rowLimit = Math.min(25_000, maximum - collected.length);
    const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(options.siteUrl)}/searchAnalytics/query`;
    const data = await googleJson(endpoint, token, { method: 'POST', body: JSON.stringify({ startDate: options.startDate, endDate: options.endDate, dimensions: ['query', 'page'], type: 'web', aggregationType: 'auto', dataState: 'final', rowLimit, startRow: collected.length }) });
    const rows = data.rows ?? []; collected.push(...rows);
    if (rows.length < rowLimit) break;
  }
  const lines = ['Query,Page,Clicks,Impressions,CTR,Position', ...collected.map(row => [row.keys?.[0], row.keys?.[1], row.clicks, row.impressions, row.ctr, row.position].map(csv).join(','))];
  return { csv: `${lines.join('\n')}\n`, rows: collected.length };
}
