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
  const archiveFinding = result.findings.find(finding => finding.rule === 'indexable_archive_review');
  assert.match(archiveFinding?.message ?? '', /HTTP 200, no noindex directive detected/);
  assert.match(archiveFinding?.evidence ?? '', /indexable: yes/);
  assert.ok(!result.findings.some(finding => finding.rule === 'thin_content' || finding.rule === 'meta_description_missing'));
});

test('treats a trailing-slash-only canonical as self-referencing', () => {
  const result = extractPage('https://example.test/blog/', 'https://example.test/blog/', 200, 'text/html', '<title>Blog</title><link rel="canonical" href="https://example.test/blog"><h1>Blog</h1>', new Headers());
  assert.equal(result.canonicalMatchesUrl, true);
  assert.ok(!result.findings.some(finding => finding.rule === 'canonical_differs'));
});

test('does not call a noindex category archive indexable', () => {
  const result = extractPage('https://example.test/category/news/', 'https://example.test/category/news/', 200, 'text/html', '<title>News</title><meta name="robots" content="noindex,follow"><h1>News</h1>', new Headers());
  assert.equal(result.indexable, false);
  assert.ok(!result.findings.some(finding => finding.rule === 'indexable_archive_review'));
});

test('captures hierarchy, staleness, and active mixed-content measurements', () => {
  const html = '<html><head><title>Older guide</title><meta property="article:modified_time" content="2020-01-01"><link rel="stylesheet" href="http://cdn.example.test/site.css"></head><body><main><h1>Guide</h1><h3>Skipped level</h3><a href="http://example.org/reference">ordinary external link</a><p>Useful content.</p></main></body></html>';
  const result = extractPage('https://example.test/guide', 'https://example.test/guide', 200, 'text/html', html, new Headers());
  assert.deepEqual(result.headings.map(heading => heading.level), [1, 3]);
  assert.ok(result.findings.some(finding => finding.rule === 'heading_hierarchy_skipped'));
  assert.ok(result.findings.some(finding => finding.rule === 'content_stale'));
  assert.deepEqual(result.mixedContentResources, ['http://cdn.example.test/site.css']);
  assert.ok(result.findings.some(finding => finding.rule === 'mixed_content'));
});

test('uses accessible link names and excludes skip-navigation links', () => {
  const html = '<title>Links</title><main id="main"><h1>Links</h1><a href="#main">Skip to content</a><a href="/share" aria-label="Share on Bluesky"><svg></svg></a><span id="next-label" class="screen-reader-text">Next page</span><a href="/page/2" aria-labelledby="next-label"><svg></svg></a></main>';
  const result = extractPage('https://example.test/', 'https://example.test/', 200, 'text/html', html, new Headers());
  assert.deepEqual(result.links.map(link => link.text), ['Share on Bluesky', 'Next page']);
});

test('reports actionable JSON-LD syntax and core-property issues separately', () => {
  const html = '<title>Schema</title><h1>Schema</h1><script type="application/ld+json">{"@type":"Article",}</script><script type="application/ld+json">{"@type":"Article","headline":"Test"}</script>';
  const result = extractPage('https://example.test/', 'https://example.test/', 200, 'text/html', html, new Headers());
  assert.match(result.schemas[0].error ?? '', /line|position/i);
  assert.ok(result.findings.some(finding => finding.rule === 'schema_invalid_json' && /invalid:/i.test(finding.message)));
  assert.ok(result.findings.some(finding => finding.rule === 'schema_missing_core_property' && /author/.test(finding.message)));
});
