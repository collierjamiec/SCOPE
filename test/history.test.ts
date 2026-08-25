import test from 'node:test';
import assert from 'node:assert/strict';
import { findingFingerprint, normalizeDomain, normalizePageUrl } from '../src/history.js';
import { applyInternalGraphMetrics } from '../src/crawler.js';
import type { PageResult } from '../src/types.js';

test('normalizes domain identity without merging subdomains or registered domains', () => {
  assert.equal(normalizeDomain('https://www.Example.com/path'), 'example.com');
  assert.equal(normalizeDomain('http://example.com'), 'example.com');
  assert.equal(normalizeDomain('https://blog.example.com'), 'blog.example.com');
  assert.equal(normalizeDomain('http://localhost:4173'), 'localhost:4173');
});

test('finding identity survives presentation-message changes', () => {
  const first = findingFingerprint('example.com', 'https://www.example.com/about/?utm_source=x', { category: 'seo', severity: 'warning', rule: 'missing_h1', message: 'No H1.' });
  const second = findingFingerprint('example.com', 'https://example.com/about', { category: 'seo', severity: 'critical', rule: 'missing_h1', message: 'This page has no primary heading.' });
  assert.equal(first, second);
  assert.equal(normalizePageUrl('https://www.example.com/about/?utm_source=x'), 'example.com/about');
});

const page = (url: string, links: string[]): PageResult => ({ requestedUrl: url, url, status: 200, redirectChain: [], contentType: 'text/html', title: '', titleCharacters: 0, metaDescription: '', metaDescriptionCharacters: 0, canonical: url, robotsDirectives: [], indexable: true, h1s: [], h2s: [], headings: [], primaryCta: null, schemas: [], suggestedSchemas: [], wordCount: 0, contentMetrics: { wordCount: 0, sentenceCount: 0, paragraphCount: 0, averageWordsPerSentence: 0, fleschReadingEase: null, fleschKincaidGrade: null, readingTimeMinutes: 0, textToHtmlRatio: 0 }, text: '', links: links.map(destination => ({ text: destination, url: destination, internal: true })), internalLinkCount: links.length, externalLinkCount: 0, incomingInternalLinks: 0, imageCount: 0, imagesMissingAltText: 0, images: [], imageRecommendations: [], aio: { score: 0, label: 'significant_barriers', dimensions: { accessibility: 0, extractability: 0, evidence: 0, entityClarity: 0, intentCoverage: 0, freshness: 0, multimodal: 0 }, questionsDetected: [], answerPassages: [], indicators: [], visibilityMeasured: false }, htmlLang: null, hasViewportMeta: false, canonicalMatchesUrl: true, responseTimeMs: 1, keywordSignals: [], findings: [], pageSpeed: [], crawledAt: new Date().toISOString() });

test('derives minimum click depth and exhaustive orphan findings from the link graph', () => {
  const pages = [page('https://example.com/', ['https://example.com/a/']), page('https://example.com/a/', ['https://example.com/b/']), page('https://example.com/b/', []), page('https://example.com/orphan/', [])];
  pages[1].incomingInternalLinks = 1; pages[2].incomingInternalLinks = 1;
  applyInternalGraphMetrics(pages, 'https://example.com/start', true);
  assert.deepEqual(pages.map(item => item.clickDepth), [0, 1, 2, null]);
  assert.equal(pages[3].orphan, true);
  assert.equal(pages[3].findings[0].rule, 'orphan_page');
});
