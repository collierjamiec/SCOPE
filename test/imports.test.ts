import test from 'node:test';
import assert from 'node:assert/strict';
import { applyGa4Export, averageGscPosition, detectGa4DateRange, detectGscDateRange, mergeGscExport } from '../src/imports.js';
import type { PageResult } from '../src/types.js';

test('merges Search Console exports into keyword candidates', () => {
  const keywords: any[] = [];
  const count = mergeGscExport(keywords, 'Query,Page,Clicks,Impressions,CTR,Position\nseo audit,https://example.com/a,12,120,10%,4.5\n', 5000, 'https://example.com');
  assert.equal(count, 1);
  assert.equal(keywords[0].keyword, 'seo audit');
  assert.equal(keywords[0].searchConsole.clicks, 12);
  assert.equal(keywords[0].searchConsole.ctr, 0.1);
});

test('GSC queries are imported even when inferred keywords already fill the limit', () => {
  const keywords: any[] = [{ keyword: 'inferred phrase', score: 10, confidence: .8, pages: [], ranking: null }];
  mergeGscExport(keywords, 'Query,Clicks,Impressions,CTR,Position\nobserved query,5,50,10%,3.2\n', 1, 'https://example.com');
  assert.ok(keywords.some(keyword => keyword.keyword === 'observed query' && keyword.searchConsole));
});

test('calculates impression-weighted average GSC position', () => {
  const keywords: any[] = [];
  mergeGscExport(keywords, 'Query,Page,Clicks,Impressions,CTR,Position\nfirst,https://example.com/a,1,100,1%,2\nsecond,https://example.com/b,1,300,0.3%,10\n', 100, 'https://example.com');
  assert.equal(averageGscPosition(keywords), 8);
  assert.equal(averageGscPosition([]), undefined);
});

test('derives the GSC reporting period from a date-dimension export fallback', () => {
  const range = detectGscDateRange(['Date,Clicks,Impressions,CTR,Position\n2026-06-30,1,10,10%,4\n2026-06-01,2,20,10%,5\n']);
  assert.deepEqual(range, { start: '2026-06-01', end: '2026-06-30', label: '2026-06-01 through 2026-06-30', source: 'Date dimension export' });
});

test('reads the reporting-period filter from a standard GSC Filters export', () => {
  assert.deepEqual(detectGscDateRange(['Filter,Value\nSearch type,Web\nDate,"June 1, 2026 - June 30, 2026"\n']), {
    start: '2026-06-01', end: '2026-06-30', label: 'June 1, 2026 - June 30, 2026', source: 'Filters export'
  });
  assert.deepEqual(detectGscDateRange(['Filter,Value\nDate,Last 3 months\n']), { label: 'Last 3 months', source: 'Filters export' });
  assert.deepEqual(detectGscDateRange(['Date: Last 28 days\nSearch type: Web\n']), { label: 'Last 28 days', source: 'Filters export' });
});

test('attaches GA4 landing-page metrics to matching pages', () => {
  const pages = [{ url: 'https://example.com/a', analytics: undefined }] as unknown as PageResult[];
  const count = applyGa4Export(pages, 'Landing page,Sessions,Active users,Engaged sessions,Engagement rate,Key events\n/a,40,30,25,62.5%,3\n', 'https://example.com');
  assert.equal(count, 1);
  assert.equal(pages[0].analytics?.sessions, 40);
  assert.equal(pages[0].analytics?.engagementRate, 0.625);
});

test('preserves omitted GA4 engagement rate as unavailable instead of zero', () => {
  const pages = [{ url: 'https://example.com/a', analytics: undefined }] as unknown as PageResult[];
  applyGa4Export(pages, 'Landing page,Sessions,Active users,Engaged sessions,Key events\n/a,40,30,25,3\n', 'https://example.com');
  assert.equal(pages[0].analytics?.engagementRate, null);
});

test('excludes diagnostic search-operator queries from keyword opportunities', () => {
  const keywords: any[] = [];
  mergeGscExport(keywords, 'Query,Clicks,Impressions,CTR,Position\nsite:example.com,2,20,10%,1\nreal topic,3,30,10%,4\n', 100, 'https://example.com');
  assert.deepEqual(keywords.map(keyword => keyword.keyword), ['real topic']);
});

test('finds native GA4 headers after report metadata rows', () => {
  const pages = [{ url: 'https://example.com/a/', analytics: undefined }] as unknown as PageResult[];
  const csv = '# GA4 Landing page report\n# Date range: last 28 days\nLanding page + query string,Sessions,Active users,Engaged sessions,Engagement rate,Key events\n/a?utm_source=test,40,30,25,62.5%,3\n';
  assert.equal(applyGa4Export(pages, csv, 'https://example.com'), 1);
  assert.equal(pages[0].analytics?.sessions, 40);
  assert.equal(pages[0].analytics?.engagementRate, 0.625);
});

test('discloses GA4 dates from native export metadata or a date dimension', () => {
  assert.deepEqual(detectGa4DateRange('# Start date: 20260501\n# End date: 20260531\nLanding page,Sessions\n/,1\n'), {
    start: '2026-05-01', end: '2026-05-31', label: '2026-05-01 through 2026-05-31', source: 'GA4 export metadata'
  });
  assert.deepEqual(detectGa4DateRange('Date,Landing page,Sessions\n20260531,/,1\n20260501,/a,2\n'), {
    start: '2026-05-01', end: '2026-05-31', label: '2026-05-01 through 2026-05-31', source: 'GA4 date dimension'
  });
});
