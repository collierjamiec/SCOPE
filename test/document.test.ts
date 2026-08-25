import test from 'node:test';
import assert from 'node:assert/strict';
import { auditDocumentFilename, createAuditDocument } from '../src/document.js';
import type { AuditReport } from '../src/types.js';

const report: AuditReport = {
  domain: 'example.com',
  config: { startUrl: 'https://example.com', maxPages: 50, maxKeywords: 100, concurrency: 1, delayMs: 0, userAgent: 'test', pageSpeed: false, serpConfigured: false, imageAnalysisConfigured: false },
  summary: { pagesFetched: 1, indexablePagesAnalyzed: 1, excludedNonIndexable: 0, keywordsIdentified: 0, rankingsChecked: 0, sitemapPageUrls: 0 },
  sitemaps: [], redirects: [], brokenLinks: [], pages: [], excludedPages: [], keywords: [], cannibalization: [], aiCrawlerAccess: [], importedData: { gscRows: 0, ga4Rows: 0 }, generatedAt: '2026-08-24T12:00:00.000Z'
};

test('uses the requested dated audit filename', () => {
  assert.equal(auditDocumentFilename(new Date(2026, 7, 24)), 'SCOPE-Audit-08-24-2026.docx');
});

test('creates a valid DOCX zip buffer', async () => {
  const buffer = await createAuditDocument(report);
  assert.equal(buffer.subarray(0, 2).toString(), 'PK');
  assert.ok(buffer.length > 5000);
});
