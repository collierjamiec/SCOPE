import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGoogleAnalyticsAuthorization, fetchGoogleAnalyticsLandingPages, googleAnalyticsCredentialPath, listGoogleAnalyticsProperties, saveGoogleAnalyticsCredentials } from '../src/google-analytics.js';

test('creates a read-only GA4 OAuth authorization with PKCE', () => {
  const authorization = createGoogleAnalyticsAuthorization('client.apps.googleusercontent.com', 'http://127.0.0.1:4173/api/google-analytics/callback', 'state-123');
  const url = new URL(authorization.url);
  assert.equal(url.searchParams.get('scope'), 'https://www.googleapis.com/auth/analytics.readonly');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('prompt'), 'consent select_account');
  assert.ok(authorization.verifier.length > 40);
});

test('stores GA4 OAuth credentials only in the owner-readable local file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'scope-ga4-'));
  const previous = process.env.SCOPE_GOOGLE_ANALYTICS_CREDENTIALS_FILE;
  process.env.SCOPE_GOOGLE_ANALYTICS_CREDENTIALS_FILE = join(directory, 'credentials.json');
  try {
    await saveGoogleAnalyticsCredentials({ clientId: 'client.apps.googleusercontent.com', clientSecret: 'local-secret', refreshToken: 'local-token' });
    assert.equal((await stat(googleAnalyticsCredentialPath())).mode & 0o777, 0o600);
    assert.match(await readFile(googleAnalyticsCredentialPath(), 'utf8'), /local-token/);
  } finally {
    if (previous === undefined) delete process.env.SCOPE_GOOGLE_ANALYTICS_CREDENTIALS_FILE; else process.env.SCOPE_GOOGLE_ANALYTICS_CREDENTIALS_FILE = previous;
  }
});

test('lists accessible GA4 properties across account-summary pages', async () => {
  const calls: string[] = [];
  const fetchFn = (async (input: string | URL | Request) => {
    const url = String(input); calls.push(url);
    if (url.includes('oauth2.googleapis.com/token')) return new Response(JSON.stringify({ access_token: 'access' }), { status: 200 });
    if (url.includes('pageToken=next')) return new Response(JSON.stringify({ accountSummaries: [{ account: 'accounts/2', displayName: 'Second', propertySummaries: [{ property: 'properties/22', displayName: 'Site B' }] }] }), { status: 200 });
    return new Response(JSON.stringify({ accountSummaries: [{ account: 'accounts/1', displayName: 'First', propertySummaries: [{ property: 'properties/11', displayName: 'Site A' }] }], nextPageToken: 'next' }), { status: 200 });
  }) as typeof fetch;
  const properties = await listGoogleAnalyticsProperties({ clientId: 'client.apps.googleusercontent.com', refreshToken: 'refresh' }, { fetchFn });
  assert.deepEqual(properties.map(item => item.property), ['properties/11', 'properties/22']);
  assert.ok(calls.some(url => url.includes('analyticsadmin.googleapis.com/v1alpha/accountSummaries')));
  assert.ok(calls.some(url => url.includes('pageToken=next')));
});

test('queries GA4 landing pages, retries a 429, and preserves aggregate totals and quality metadata', async () => {
  const waits: number[] = [], reportBodies: any[] = []; let reportAttempts = 0;
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('oauth2.googleapis.com/token')) return new Response(JSON.stringify({ access_token: 'access' }), { status: 200 });
    reportAttempts += 1; reportBodies.push(JSON.parse(String(init?.body)));
    if (reportAttempts === 1) return new Response(JSON.stringify({ error: { message: 'slow down' } }), { status: 429, headers: { 'retry-after': '0' } });
    return new Response(JSON.stringify({
      rows: [{ dimensionValues: [{ value: '/welcome?source=test' }], metricValues: ['40', '30', '25', '.625', '.375', '3'].map(value => ({ value })) }],
      totals: [{ metricValues: ['40', '28', '25', '.625', '.375', '3'].map(value => ({ value })) }],
      rowCount: 1,
      metadata: { timeZone: 'America/New_York', currencyCode: 'USD', subjectToThresholding: true, dataLossFromOtherRow: false },
      propertyQuota: { tokensPerHour: { remaining: 999 } }
    }), { status: 200 });
  }) as typeof fetch;
  const result = await fetchGoogleAnalyticsLandingPages({ clientId: 'client.apps.googleusercontent.com', refreshToken: 'refresh' }, { property: '1234', startDate: '2026-07-01', endDate: '2026-07-31' }, { fetchFn, sleep: async milliseconds => { waits.push(milliseconds); }, maxRetries: 2 });
  assert.equal(reportAttempts, 2);
  assert.deepEqual(waits, [0]);
  assert.equal(result.totals.totalUsers, 28);
  assert.equal(result.quality.subjectToThresholding, true);
  assert.match(result.csv, /Google Analytics Data API/);
  assert.match(result.csv, /welcome\?source=test/);
  assert.deepEqual(reportBodies[0].dimensions, [{ name: 'landingPagePlusQueryString' }]);
  assert.deepEqual(reportBodies[0].metrics.map((item: any) => item.name), ['sessions', 'totalUsers', 'engagedSessions', 'engagementRate', 'bounceRate', 'keyEvents']);
  assert.equal(reportBodies[0].returnPropertyQuota, true);
});
