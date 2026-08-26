import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { applyEntityConsistency, crawlSite, isArchiveUrl, isExcludedUrl, isGatedAuthenticationFlow, isTrailingSlashOnlyRedirect, needsJavaScriptRendering, safeCrawlUrl, validateConfig } from '../src/crawler.js';
import type { PageResult } from '../src/types.js';

test('accepts an unlimited crawl configuration', () => {
  assert.doesNotThrow(() => validateConfig({ startUrl: 'https://example.test', maxPages: null, maxKeywords: 100, concurrency: 1, delayMs: 0, userAgent: 'test', pageSpeed: false }));
});

test('accepts thousands of discovered keywords while limiting ranking checks', () => {
  assert.doesNotThrow(() => validateConfig({ startUrl: 'https://example.test', maxPages: null, maxKeywords: 5000, maxRankings: 100, concurrency: 1, delayMs: 0, userAgent: 'test', pageSpeed: false }));
});

test('accepts bounded external crawling settings', () => {
  assert.doesNotThrow(() => validateConfig({ startUrl: 'https://example.test', maxPages: 10, maxKeywords: 100, concurrency: 8, delayMs: 25, userAgent: 'test', pageSpeed: false, externalCrawlDepth: 3, maxExternalPages: 500 }));
  assert.throws(() => validateConfig({ startUrl: 'https://example.test', maxPages: 10, maxKeywords: 100, concurrency: 8, delayMs: 25, userAgent: 'test', pageSpeed: false, externalCrawlDepth: 4 }));
});

test('normalizes tracking parameters before queueing crawl URLs', () => {
  assert.equal(safeCrawlUrl('https://example.test/a?utm_source=x&b=2&a=1#section'), 'https://example.test/a?a=1&b=2');
  assert.equal(safeCrawlUrl('https://example.test/article?share=twitter'), 'https://example.test/article');
});

test('path exclusions match a section and its descendants without matching similar slugs', () => {
  assert.equal(isExcludedUrl('https://example.test/blog', ['/blog']), true);
  assert.equal(isExcludedUrl('https://example.test/blog/article', ['/blog']), true);
  assert.equal(isExcludedUrl('https://example.test/blogger', ['/blog']), false);
});

test('skips browser rendering for meaningful server-rendered pages', () => {
  const links = '<a href="/one">One</a><a href="/two">Two</a><a href="/three">Three</a>';
  const copy = 'Useful server-rendered page content. '.repeat(20);
  assert.equal(needsJavaScriptRendering(`<html><head><title>Resource</title></head><body><main><h1>Resource</h1>${copy}${links}</main></body></html>`), false);
});

test('uses browser rendering for thin JavaScript application shells', () => {
  assert.equal(needsJavaScriptRendering('<html><head><title>App</title></head><body><div id="root"></div><script src="app.js"></script></body></html>'), true);
});

test('identifies common low-value archive URL patterns', () => {
  assert.equal(isArchiveUrl('https://example.test/tag/seo'), true);
  assert.equal(isArchiveUrl('https://example.test/category/news'), true);
  assert.equal(isArchiveUrl('https://example.test/articles/page/3'), true);
  assert.equal(isArchiveUrl('https://example.test/feed/'), true);
  assert.equal(isArchiveUrl('https://example.test/resource/seo-guide'), false);
});

test('classifies Patreon unlock redirects as gated authentication rather than broken links', () => {
  const source = 'https://queerandunbroken.com/patreon-flow?patreon-unlock-post=1773';
  const oauth = 'https://www.patreon.com/oauth2/authorize?client_id=test';
  const login = 'https://www.patreon.com/login?ru=%2Foauth2%2Fauthorize';
  assert.equal(isGatedAuthenticationFlow(source, login, [source, oauth, login]), true);
  assert.equal(isGatedAuthenticationFlow('https://example.test/old', 'https://other.test/missing', []), false);
});

test('recognizes pure trailing-slash normalization redirects', () => {
  assert.equal(isTrailingSlashOnlyRedirect('https://example.test/article', 'https://example.test/article/'), true);
  assert.equal(isTrailingSlashOnlyRedirect('https://example.test/article?a=1', 'https://example.test/article/?a=1'), true);
  assert.equal(isTrailingSlashOnlyRedirect('https://example.test/old', 'https://example.test/new/'), false);
  assert.equal(isTrailingSlashOnlyRedirect('http://example.test/article', 'https://example.test/article/'), false);
});

test('reports conservative sitewide entity naming variants', () => {
  const minimal = (url: string, name: string): PageResult => ({ requestedUrl: url, url, status: 200, redirectChain: [], contentType: 'text/html', title: name, titleCharacters: name.length, metaDescription: '', metaDescriptionCharacters: 0, canonical: url, robotsDirectives: [], indexable: true, h1s: [name], h2s: [], headings: [], primaryCta: null, schemas: [], wordCount: 1, text: name, links: [], internalLinkCount: 0, externalLinkCount: 0, incomingInternalLinks: 0, imageCount: 0, imagesMissingAltText: 0, imageRecommendations: [], htmlLang: 'en', hasViewportMeta: true, aio: { score: 50, label: 'partial', dimensions: { accessibility: 20, extractability: 10, evidence: 5, entityClarity: 5, intentCoverage: 5, freshness: 0, multimodal: 5 }, questionsDetected: [], answerPassages: [], indicators: [], visibilityMeasured: false }, canonicalMatchesUrl: true, responseTimeMs: 1, suggestedSchemas: [], entityNames: [{ name, type: 'Organization' }], keywordSignals: [], findings: [], pageSpeed: [], crawledAt: new Date().toISOString() });
  const pages = [minimal('https://example.test/a', 'Phoenix Rising SEO LLC'), minimal('https://example.test/b', 'Phoenix Rising SEO')];
  applyEntityConsistency(pages);
  assert.ok(pages.every(page => page.findings.some(finding => finding.rule === 'aio_entity_naming_consistency')));
});

test('crawl respects robots and excludes noindex pages from analysis', async (context) => {
  const requested: string[] = [];
  const server = createServer((request, response) => {
    requested.push(request.url ?? '');
    if (request.url === '/robots.txt') return response.end('User-agent: *\nDisallow: /blocked\n');
    if (request.url === '/sitemap.xml') {
      response.setHeader('content-type', 'application/xml');
      return response.end(`<urlset><url><loc>http://127.0.0.1:${(server.address() as any).port}/allowed</loc></url><url><loc>http://127.0.0.1:${(server.address() as any).port}/hidden</loc></url><url><loc>http://127.0.0.1:${(server.address() as any).port}/old</loc></url></urlset>`);
    }
    if (request.url === '/old') { response.statusCode = 301; response.setHeader('location', '/allowed'); return response.end(); }
    if (request.url === '/allowed') { response.statusCode = 301; response.setHeader('location', '/allowed/'); return response.end(); }
    response.setHeader('content-type', 'text/html');
    if (request.url === '/') return response.end('<title>Website Audit Software</title><meta name="description" content="Website audit software for technical SEO teams."><h1>Website Audit Software</h1><a href="/allowed">Allowed</a><a href="/blocked">Blocked</a><a href="/hidden">Hidden</a><a href="/missing">Missing page</a><a href="/blog/article">Blog article</a>');
    if (request.url === '/allowed/') return response.end('<title>Technical SEO Audit</title><h1>Technical SEO Audit</h1>');
    if (request.url === '/hidden') return response.end('<meta name="robots" content="noindex"><title>Hidden</title><h1>Hidden</h1>');
    response.statusCode = 404; response.end('missing');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const report = await crawlSite({
    startUrl: `http://127.0.0.1:${address.port}/`, maxPages: 10, maxKeywords: 20,
    concurrency: 1, delayMs: 0, userAgent: 'OrganicSiteAuditor', pageSpeed: false, excludePaths: ['/blog']
  });
  assert.equal(report.pages.length, 2);
  assert.ok(!requested.includes('/blocked'));
  assert.ok(report.excludedPages.some(page => page.url.endsWith('/blocked') && page.reason.includes('robots.txt')));
  assert.ok(report.excludedPages.some(page => page.url.endsWith('/hidden') && page.reason.includes('noindex')));
  assert.ok(report.keywords.every(keyword => keyword.pages.every(page => !page.url.endsWith('/hidden'))));
  assert.equal(report.sitemaps[0].type, 'urlset');
  assert.equal(report.summary.sitemapPageUrls, 3);
  assert.equal(report.redirects.length, 1);
  assert.ok(report.redirects.some(redirect => redirect.chain.some(url => new URL(url).pathname === '/allowed/')));
  assert.equal(report.pages.find(page => page.url.endsWith('/'))?.internalLinkCount, 5);
  assert.ok(report.excludedPages.some(page => page.url.includes('/blog/article') && page.reason.includes('configuration')));
  assert.ok(report.brokenLinks.some(link => link.destination.endsWith('/missing') && link.sourcePage.endsWith('/') && link.anchorText === 'Missing page' && link.status === 404));
  assert.ok(report.aiCrawlerAccess.some(item => item.crawler === 'OAI-SearchBot'));
  assert.ok(report.aiCrawlerAccess.some(item => item.crawler === 'GPTBot' && item.note.includes('independent from ChatGPT search')));
  assert.ok(report.aiCrawlerAccess.some(item => item.crawler === 'ChatGPT-User' && item.note.includes('user-initiated')));
});
