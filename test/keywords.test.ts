import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateKeywords, detectCannibalization, extractKeywordSignals } from '../src/keywords.js';
import type { PageResult } from '../src/types.js';

const page = (url: string, title: string): PageResult => ({
  requestedUrl: url, url, status: 200, redirectChain: [], contentType: 'text/html', title, titleCharacters: title.length,
  metaDescription: '', metaDescriptionCharacters: 0, canonical: url, robotsDirectives: [], indexable: true,
  h1s: [title], h2s: [], headings: [], primaryCta: null, schemas: [], wordCount: 20, text: title,
  links: [], internalLinkCount: 0, externalLinkCount: 0, incomingInternalLinks: 0,
  imageCount: 0, imagesMissingAltText: 0, imageRecommendations: [], htmlLang: 'en', hasViewportMeta: true,
  aio: { score: 50, label: 'partial', dimensions: { accessibility: 20, extractability: 10, evidence: 5, entityClarity: 5, intentCoverage: 5, freshness: 0, multimodal: 5 }, questionsDetected: [], answerPassages: [], indicators: [], visibilityMeasured: false },
  canonicalMatchesUrl: true, responseTimeMs: 10, suggestedSchemas: [],
  keywordSignals: extractKeywordSignals(title, '', [title], [], title), findings: [], pageSpeed: [], crawledAt: new Date().toISOString()
});

test('keyword aggregation is capped', () => {
  const result = aggregateKeywords([page('https://x.test/a', 'Enterprise Website Crawler Software')], 2);
  assert.ok(result.length <= 2);
  assert.ok(result.some(item => item.keyword.includes('website crawler')));
});

test('similar targeting on two pages flags cannibalization', () => {
  const keywords = aggregateKeywords([
    page('https://x.test/a', 'Enterprise Website Crawler'),
    page('https://x.test/b', 'Enterprise Website Crawler')
  ], 20);
  const issues = detectCannibalization(keywords);
  assert.ok(issues.length > 0);
  assert.equal(issues[0].severity, 'likely');
});

test('Search Console landing-page overlap flags observed cannibalization', () => {
  const issues = detectCannibalization([{ keyword: 'seo audit', score: 0, confidence: 1, pages: [], ranking: null, searchConsole: { clicks: 3, impressions: 50, ctr: 0.06, position: 8, pages: ['https://example.com/a', 'https://example.com/b'], pageMetrics: { 'https://example.com/a': { clicks: 2, impressions: 30, ctr: 0.067, position: 7 }, 'https://example.com/b': { clicks: 1, impressions: 20, ctr: 0.05, position: 10 } } } }]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].severity, 'likely');
  assert.match(issues[0].reason, /Search Console/);
  assert.match(issues[0].reason, /60%/);
});

test('labels question-query overlap as an answer and snippet competition hypothesis', () => {
  const issues = detectCannibalization([{ keyword: 'what is an seo audit', score: 0, confidence: 1, pages: [], ranking: null, searchConsole: { clicks: 3, impressions: 50, ctr: 0.06, position: 8, pages: ['https://example.com/a', 'https://example.com/b'], pageMetrics: { 'https://example.com/a': { clicks: 2, impressions: 30, ctr: 0.067, position: 7 }, 'https://example.com/b': { clicks: 1, impressions: 20, ctr: 0.05, position: 10 } } } }]);
  assert.equal(issues[0].intentType, 'question_answer');
  assert.match(issues[0].reason, /answer|snippet/i);
});

test('suppresses observed overlap when one GSC landing page clearly dominates', () => {
  const issues = detectCannibalization([{ keyword: 'seo audit', score: 0, confidence: 1, pages: [], ranking: null, searchConsole: { clicks: 10, impressions: 100, ctr: 0.1, position: 4, pages: ['https://example.com/a', 'https://example.com/b'], pageMetrics: { 'https://example.com/a': { clicks: 10, impressions: 95, ctr: 0.105, position: 3 }, 'https://example.com/b': { clicks: 0, impressions: 5, ctr: 0, position: 28 } } } }]);
  assert.equal(issues.length, 0);
});
