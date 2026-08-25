import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPageType, extractPage } from '../src/extract.js';

test('extracts metadata counts, CTA, schema, and noindex', () => {
  const description = 'A concise description for search results.';
  const html = `<html><head><title>Example SEO Page</title><meta name="description" content="${description}"><meta name="robots" content="noindex"><script type="application/ld+json">{"@type":"Article"}</script></head><body><main><h1>Example SEO Page</h1><h2>Details</h2><a class="primary cta" href="/demo">Book a demo</a><p>Useful page text.</p></main></body></html>`;
  const result = extractPage('https://example.test/', 'https://example.test/', 200, 'text/html', html, new Headers());
  assert.equal(result.metaDescriptionCharacters, [...description].length);
  assert.equal(result.indexable, false);
  assert.equal(result.primaryCta?.url, 'https://example.test/demo');
  assert.deepEqual(result.schemas[0].types, ['Article']);
});

test('suggests alt text and filenames for images that need optimization', () => {
  const html = '<title>Virtual Receptionist Service</title><main><h1>Virtual Receptionist Service</h1><figure><img src="/IMG_1234.jpg" alt=""><figcaption>Receptionist answering a customer call</figcaption></figure></main>';
  const result = extractPage('https://example.test/', 'https://example.test/', 200, 'text/html', html, new Headers());
  assert.equal(result.imageRecommendations.length, 1);
  assert.equal(result.imageRecommendations[0].issue, 'both');
  assert.match(result.imageRecommendations[0].suggestedFilename, /virtual-receptionist/);
  assert.match(result.imageRecommendations[0].suggestedAlt, /Receptionist answering a customer call/);
  assert.equal(result.imageRecommendations[0].basis, 'page_context');
});

test('does not mistake an opaque CDN asset identifier for a renameable filename', () => {
  const result = extractPage('https://example.com', 'https://example.com', 200, 'text/html', '<title>Team</title><h1>Team</h1><img src="https://cdn.example.com/avatar/cdb7f6881f21a0a74a9531eeeefce2e7db3e9610d9315ec5b9e76886757c1d3b" alt="Team member">', new Headers());
  assert.equal(result.imageRecommendations.length, 0);
});

test('produces transparent AI answer-readiness dimensions and opportunities', () => {
  const html = '<title>Answering Service Guide</title><meta name="robots" content="nosnippet"><main><h1>Answering Service Guide</h1><h2>What is an answering service?</h2><p>An answering service handles customer calls on behalf of a business so callers can receive timely assistance.</p></main>';
  const result = extractPage('https://example.test/', 'https://example.test/', 200, 'text/html', html, new Headers());
  assert.ok(result.aio.score >= 0 && result.aio.score <= 100);
  assert.equal(result.aio.visibilityMeasured, false);
  assert.equal(result.aio.indicators.find(item => item.key === 'snippet_access')?.status, 'blocked');
  assert.ok(result.aio.questionsDetected.includes('What is an answering service?'));
});

test('classifies archive pages and applies archive-specific findings', () => {
  assert.equal(classifyPageType('https://example.test/category/news/', false), 'category_archive');
  assert.equal(classifyPageType('https://example.test/?s=scope', false), 'search_archive');
  const result = extractPage('https://example.test/category/news/', 'https://example.test/category/news/', 200, 'text/html', '<title>News</title><h1>News</h1><p>Short listing.</p>', new Headers());
  assert.equal(result.pageType, 'category_archive');
  assert.ok(result.findings.some(finding => finding.rule === 'indexable_archive_review'));
  assert.ok(!result.findings.some(finding => finding.rule === 'thin_content' || finding.rule === 'meta_description_missing'));
});
