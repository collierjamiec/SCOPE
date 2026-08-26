import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIntelligenceCsv } from '../src/intelligence-imports.js';

test('normalizes competitive SEO exports without calling estimates first-party traffic', () => {
  const result = parseIntelligenceCsv('Keyword,Position,URL,Estimated Traffic,Search Volume\nseo audit,4,https://competitor.test/a,120,1000\nwebsite crawler,12,https://competitor.test/b,40,500', 'competitive_seo');
  assert.equal(result.metrics.keywordCount, 2);
  assert.equal(result.metrics.top10Keywords, 1);
  assert.equal(result.metrics.estimatedTraffic, 160);
});

test('normalizes AI visibility exports across prompt and citation fields', () => {
  const result = parseIntelligenceCsv('Prompt,Platform,Citation URL,Mention,Share of Voice\nbest seo tool,ChatGPT,https://example.test/,yes,24\nseo crawler,Google AI Overviews,,,10', 'ai_visibility');
  assert.equal(result.metrics.promptCount, 2);
  assert.equal(result.metrics.citationCount, 1);
  assert.equal(result.metrics.mentionCount, 1);
  assert.deepEqual(result.metrics.platforms, ['ChatGPT', 'Google AI Overviews']);
});
