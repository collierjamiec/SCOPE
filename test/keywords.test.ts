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
