import test from 'node:test';
import assert from 'node:assert/strict';
import { applyGa4Export, detectGscDateRange, mergeGscExport } from '../src/imports.js';
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

test('derives the GSC reporting period from a Dates export', () => {
  const range = detectGscDateRange(['Date,Clicks,Impressions,CTR,Position\n2026-06-30,1,10,10%,4\n2026-06-01,2,20,10%,5\n']);
  assert.deepEqual(range, { start: '2026-06-01', end: '2026-06-30', source: 'Dates export' });
});

test('attaches GA4 landing-page metrics to matching pages', () => {
  const pages = [{ url: 'https://example.com/a', analytics: undefined }] as unknown as PageResult[];
  const count = applyGa4Export(pages, 'Landing page,Sessions,Active users,Engaged sessions,Engagement rate,Key events\n/a,40,30,25,62.5%,3\n', 'https://example.com');
  assert.equal(count, 1);
  assert.equal(pages[0].analytics?.sessions, 40);
  assert.equal(pages[0].analytics?.engagementRate, 0.625);
});

test('finds native GA4 headers after report metadata rows', () => {
  const pages = [{ url: 'https://example.com/a/', analytics: undefined }] as unknown as PageResult[];
  const csv = '# GA4 Landing page report\n# Date range: last 28 days\nLanding page + query string,Sessions,Active users,Engaged sessions,Engagement rate,Key events\n/a?utm_source=test,40,30,25,62.5%,3\n';
  assert.equal(applyGa4Export(pages, csv, 'https://example.com'), 1);
  assert.equal(pages[0].analytics?.sessions, 40);
});
