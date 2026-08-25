import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchPageSpeed, parsePageSpeedResponse } from '../src/pagespeed.js';

test('captures Lighthouse scores, lab metrics, and available field data', () => {
    const result = parsePageSpeedResponse({
      lighthouseResult: {
        categories: {
          performance: { score: 0.91 }, accessibility: { score: 0.98 },
          'best-practices': { score: 0.87 }, seo: { score: 1 },
        },
        audits: {
          'largest-contentful-paint': { numericValue: 2400 },
          'cumulative-layout-shift': { numericValue: 0.08 },
          'total-blocking-time': { numericValue: 180 },
          'first-contentful-paint': { numericValue: 1200 },
          'speed-index': { numericValue: 2700 },
        },
      },
      loadingExperience: { metrics: {
        LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2300, category: 'FAST' },
        CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 8, category: 'FAST' },
        INTERACTION_TO_NEXT_PAINT: { percentile: 190, category: 'FAST' },
      } },
    });
  assert.equal(result.performance, 0.91);
  assert.equal(result.metrics.lcp, 2400);
  assert.equal(result.metrics.cls, 0.08);
  assert.deepEqual(result.fieldMetrics?.lcp, { percentile: 2300, category: 'FAST' });
  assert.deepEqual(result.fieldMetrics?.inp, { percentile: 190, category: 'FAST' });
  assert.deepEqual(result.fieldMetrics?.fcp, { percentile: null, category: null });
});

test('retries PageSpeed 429 responses using Retry-After and returns a classified quota error', async () => {
  const original = globalThis.fetch; let calls = 0; const waits: number[] = [];
  globalThis.fetch = (async () => { calls += 1; return new Response('{}', { status: 429, headers: { 'retry-after': '2' } }); }) as typeof fetch;
  try {
    const result = await fetchPageSpeed('https://example.com/', undefined, { maxRetries: 1, sleep: async milliseconds => { waits.push(milliseconds); } });
    assert.equal(calls, 2);
    assert.deepEqual(waits, [2000]);
    assert.equal(result.errorCode, 'rate_limited');
    assert.match(result.error ?? '', /HTTP 429/);
  } finally { globalThis.fetch = original; }
});
