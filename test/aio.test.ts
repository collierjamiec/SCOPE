import test from 'node:test';
import assert from 'node:assert/strict';
import { assessAio, type AioInput } from '../src/aio.js';

const input = (overrides: Partial<AioInput> = {}): AioInput => ({
  title: 'Editorial feature', metaDescription: 'A detailed editorial feature.', h1s: ['Editorial feature'],
  h2s: [], text: '', robotsDirectives: [], schemaTypes: ['Article'], externalLinkCount: 2,
  imageCount: 0, imagesMissingAltText: 0, hasAuthor: true, hasPublishedDate: true,
  hasModifiedDate: false, lastModified: null, listCount: 0, tableCount: 0,
  questionHeadings: [], citedClaimCount: 1, ...overrides
});

test('substantial editorial coverage does not require artificial commercial headings', () => {
  const assessment = assessAio(input({
    text: 'Substantive editorial reporting and analysis. '.repeat(500),
    h2s: Array.from({ length: 13 }, (_, index) => `Editorial section ${index + 1}`)
  }));
  const indicator = assessment.indicators.find(item => item.key === 'intent_coverage');
  assert.equal(indicator?.status, 'pass');
  assert.match(indicator?.evidence ?? '', /13 H2 sections/);
});

test('intent opportunity states the missing signal and gives a topic-specific action', () => {
  const assessment = assessAio(input({ text: 'Useful article content. '.repeat(200), h2s: ['Context', 'Impact', 'History'] }));
  const indicator = assessment.indicators.find(item => item.key === 'intent_coverage');
  assert.equal(indicator?.status, 'opportunity');
  assert.match(indicator?.evidence ?? '', /0 question-led headings/);
  assert.match(indicator?.recommendation ?? '', /realistic follow-up question for this specific topic/);
});
