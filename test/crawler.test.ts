import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { crawlSite, isExcludedUrl, validateConfig } from '../src/crawler.js';

test('accepts an unlimited crawl configuration', () => {
  assert.doesNotThrow(() => validateConfig({ startUrl: 'https://example.test', maxPages: null, maxKeywords: 100, concurrency: 1, delayMs: 0, userAgent: 'test', pageSpeed: false }));
});

test('accepts thousands of discovered keywords while limiting ranking checks', () => {
  assert.doesNotThrow(() => validateConfig({ startUrl: 'https://example.test', maxPages: null, maxKeywords: 5000, maxRankings: 100, concurrency: 1, delayMs: 0, userAgent: 'test', pageSpeed: false }));
});

test('path exclusions match a section and its descendants without matching similar slugs', () => {
  assert.equal(isExcludedUrl('https://example.test/blog', ['/blog']), true);
  assert.equal(isExcludedUrl('https://example.test/blog/article', ['/blog']), true);
  assert.equal(isExcludedUrl('https://example.test/blogger', ['/blog']), false);
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
    response.setHeader('content-type', 'text/html');
    if (request.url === '/') return response.end('<title>Website Audit Software</title><meta name="description" content="Website audit software for technical SEO teams."><h1>Website Audit Software</h1><a href="/allowed">Allowed</a><a href="/blocked">Blocked</a><a href="/hidden">Hidden</a><a href="/missing">Missing page</a><a href="/blog/article">Blog article</a>');
    if (request.url === '/allowed') return response.end('<title>Technical SEO Audit</title><h1>Technical SEO Audit</h1>');
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
  assert.deepEqual(report.redirects[0].chain.map(url => new URL(url).pathname), ['/old', '/allowed']);
  assert.equal(report.pages.find(page => page.url.endsWith('/'))?.internalLinkCount, 5);
  assert.ok(report.excludedPages.some(page => page.url.includes('/blog/article') && page.reason.includes('configuration')));
  assert.ok(report.brokenLinks.some(link => link.destination.endsWith('/missing') && link.sourcePage.endsWith('/') && link.anchorText === 'Missing page' && link.status === 404));
  assert.ok(report.aiCrawlerAccess.some(item => item.crawler === 'OAI-SearchBot'));
});
