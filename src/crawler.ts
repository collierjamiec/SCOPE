import { createRequire } from 'node:module';
import * as cheerio from 'cheerio';
import type { AuditConfig, AuditReport, PageResult, SitemapResult } from './types.js';
import { extractPage } from './extract.js';
import { aggregateKeywords, applyRankings, detectCannibalization } from './keywords.js';
import { fetchPageSpeed } from './pagespeed.js';
import { getRankings, HttpSerpProvider } from './serp.js';
import { enrichImageRecommendations } from './image-analysis.js';
import { normaliseUrl, sameHost } from './util.js';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const require = createRequire(import.meta.url);
const robotsParser = require('robots-parser') as (url: string, body: string) => {
  isAllowed(url: string, userAgent?: string): boolean | undefined;
  getSitemaps(): string[];
};

export interface CrawlProgress {
  phase: 'starting' | 'robots' | 'sitemaps' | 'crawling' | 'pagespeed' | 'keywords' | 'complete';
  message: string;
  fetched: number;
  analyzed: number;
  queued: number;
  currentUrl?: string;
  percent: number | null;
}

export type ProgressReporter = (progress: CrawlProgress) => void | Promise<void>;

export function isExcludedUrl(url: string, patterns: string[] = []): boolean {
  const candidate = new URL(url);
  return patterns.some(raw => {
    const value = raw.trim();
    if (!value) return false;
    let path = value;
    try { path = new URL(value, candidate.origin).pathname; } catch { /* Treat as a path. */ }
    path = path.replace(/\*+$/, '').replace(/\/$/, '') || '/';
    const candidatePath = candidate.pathname.replace(/\/$/, '') || '/';
    return candidatePath === path || candidatePath.startsWith(`${path}/`);
  });
}

export function validateConfig(config: AuditConfig): void {
  const url = new URL(config.startUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Start URL must use HTTP or HTTPS.');
  if (config.maxPages !== null && (!Number.isInteger(config.maxPages) || config.maxPages < 1)) throw new Error('maxPages must be null (unlimited) or a positive integer.');
  if (!Number.isInteger(config.maxKeywords) || config.maxKeywords < 1 || config.maxKeywords > 100) throw new Error('maxKeywords must be an integer between 1 and 100.');
}

async function loadRobots(origin: string, userAgent: string) {
  const robotsUrl = new URL('/robots.txt', origin).href;
  try {
    const response = await fetch(robotsUrl, { headers: { 'user-agent': userAgent }, signal: AbortSignal.timeout(10000) });
    const body = response.ok ? await response.text() : '';
    const parser = robotsParser(robotsUrl, body);
    return { parser, sitemapUrls: parser.getSitemaps() };
  } catch {
    const parser = robotsParser(robotsUrl, '');
    return { parser, sitemapUrls: [] as string[] };
  }
}

async function fetchWithRedirects(url: string, userAgent: string, accept = 'text/html,application/xhtml+xml', maximum = 10) {
  const startedAt = Date.now();
  const chain = [url];
  let current = url;
  for (let hop = 0; hop <= maximum; hop++) {
    const response = await fetch(current, { redirect: 'manual', headers: { 'user-agent': userAgent, accept }, signal: AbortSignal.timeout(30000) });
    if (response.status < 300 || response.status >= 400) return { response, finalUrl: current, redirectChain: chain.length > 1 ? chain : [], responseTimeMs: Date.now() - startedAt };
    const location = response.headers.get('location');
    if (!location) return { response, finalUrl: current, redirectChain: chain.length > 1 ? chain : [], responseTimeMs: Date.now() - startedAt };
    const next = normaliseUrl(location, current);
    if (!next) throw new Error(`Invalid redirect target from ${current}`);
    if (chain.includes(next)) throw new Error(`Redirect loop detected: ${[...chain, next].join(' → ')}`);
    chain.push(next);
    current = next;
  }
  throw new Error(`More than ${maximum} redirects: ${chain.join(' → ')}`);
}

async function inspectSitemaps(origin: string, listed: string[], userAgent: string): Promise<{ results: SitemapResult[]; pageUrls: string[] }> {
  const initial = [...new Set([...listed.map(url => normaliseUrl(url, origin)).filter((url): url is string => Boolean(url)), new URL('/sitemap.xml', origin).href])];
  const queue = [...initial];
  const visited = new Set<string>();
  const results: SitemapResult[] = [];
  const pageUrls = new Set<string>();
  while (queue.length && visited.size < 100) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    try {
      const { response, finalUrl } = await fetchWithRedirects(url, userAgent, 'application/xml,text/xml,*/*');
      if (!response.ok) {
        // Do not clutter the report with an absent conventional sitemap unless it was explicitly listed.
        if (listed.some(item => normaliseUrl(item, origin) === url)) results.push({ url, type: 'unknown', status: response.status, entries: 0, pageUrls: 0, childSitemaps: 0, error: `HTTP ${response.status}` });
        continue;
      }
      const xml = await response.text();
      const $ = cheerio.load(xml, { xmlMode: true });
      const type: SitemapResult['type'] = $('sitemapindex').length ? 'sitemapindex' : $('urlset').length ? 'urlset' : 'unknown';
      const locations = $('loc').map((_, element) => normaliseUrl($(element).text().trim(), finalUrl)).get().filter((item): item is string => Boolean(item));
      if (type === 'sitemapindex') {
        for (const child of locations) if (!visited.has(child)) queue.push(child);
      } else if (type === 'urlset') {
        for (const pageUrl of locations) if (sameHost(pageUrl, origin)) pageUrls.add(pageUrl);
      }
      results.push({ url: finalUrl, type, status: response.status, entries: locations.length, pageUrls: type === 'urlset' ? locations.length : 0, childSitemaps: type === 'sitemapindex' ? locations.length : 0, ...(type === 'unknown' ? { error: 'Unrecognized sitemap XML root' } : {}) });
    } catch (error) {
      results.push({ url, type: 'unknown', status: null, entries: 0, pageUrls: 0, childSitemaps: 0, error: String(error) });
    }
  }
  return { results, pageUrls: [...pageUrls] };
}

export async function crawlSite(input: AuditConfig, onProgress: ProgressReporter = () => {}): Promise<AuditReport> {
  validateConfig(input);
  const startUrl = normaliseUrl(input.startUrl)!;
  const origin = new URL(startUrl).origin;
  await onProgress({ phase: 'starting', message: 'Preparing crawl', fetched: 0, analyzed: 0, queued: 1, percent: 0 });
  const robotsInfo = await loadRobots(origin, input.userAgent);
  await onProgress({ phase: 'robots', message: 'robots.txt loaded and crawl rules applied', fetched: 0, analyzed: 0, queued: 1, percent: 1 });
  const robots = robotsInfo.parser;
  const sitemapInfo = await inspectSitemaps(origin, robotsInfo.sitemapUrls, input.userAgent);
  const queue = [startUrl, ...sitemapInfo.pageUrls.filter(url => url !== startUrl)];
  const queued = new Set(queue);
  const fetched = new Set<string>();
  const pages: PageResult[] = [];
  const analyzedUrls = new Set<string>();
  const redirects: AuditReport['redirects'] = [];
  const excluded: AuditReport['excludedPages'] = [];
  const configuredExclusions = input.excludePaths ?? [];
  await onProgress({ phase: 'sitemaps', message: `Discovered ${sitemapInfo.pageUrls.length} sitemap URLs`, fetched: 0, analyzed: 0, queued: queue.length, percent: input.maxPages ? 2 : null });

  while (queue.length && (input.maxPages === null || fetched.size < input.maxPages)) {
    const url = queue.shift()!;
    if (fetched.has(url)) continue;
    if (isExcludedUrl(url, configuredExclusions)) { excluded.push({ url, reason: 'Excluded by audit configuration' }); continue; }
    fetched.add(url);
    await onProgress({
      phase: 'crawling', message: `Fetching ${url}`, fetched: fetched.size, analyzed: pages.length, queued: queue.length,
      currentUrl: url,
      percent: input.maxPages ? Math.min(92, Math.round((fetched.size / input.maxPages) * 90) + 2) : (queue.length + fetched.size ? Math.min(92, Math.round((fetched.size / (fetched.size + queue.length)) * 90) + 2) : null)
    });
    if (robots.isAllowed(url, input.userAgent) === false) { excluded.push({ url, reason: 'Disallowed by robots.txt' }); continue; }
    if (input.delayMs) await sleep(input.delayMs);
    try {
      const { response, finalUrl, redirectChain, responseTimeMs } = await fetchWithRedirects(url, input.userAgent);
      if (redirectChain.length) redirects.push({ source: url, sourcePages: [], chain: redirectChain, finalUrl, finalStatus: response.status });
      if (!sameHost(finalUrl, startUrl)) { excluded.push({ url, reason: `Redirected outside the audited domain: ${finalUrl}`, status: response.status }); continue; }
      const contentType = response.headers.get('content-type') ?? '';
      if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) { excluded.push({ url: finalUrl, reason: 'Non-HTML content', status: response.status }); continue; }
      const html = await response.text();
      const page = extractPage(url, finalUrl, response.status, contentType, html, response.headers, redirectChain, responseTimeMs);
      if (input.analyzeImages !== false) await enrichImageRecommendations(page, input.imageAnalysis);
      else {
        page.imageRecommendations = [];
        page.findings = page.findings.filter(finding => !finding.rule.startsWith('image_') && finding.rule !== 'aio_multimodal');
      }
      if (input.analyzeSchema === false) {
        page.schemas = [];
        page.suggestedSchemas = [];
        page.findings = page.findings.filter(finding => !finding.rule.includes('schema'));
      }
      // Discover allowed same-host URLs even if the current page is non-indexable.
      for (const link of page.links) {
        if (link.internal && sameHost(link.url, startUrl) && !queued.has(link.url) && !fetched.has(link.url)) { queue.push(link.url); queued.add(link.url); }
      }
      if (!page.indexable) { excluded.push({ url: finalUrl, reason: `Non-indexable (${page.robotsDirectives.includes('noindex') ? 'noindex' : `HTTP ${response.status}`})`, status: response.status }); continue; }
      if (analyzedUrls.has(finalUrl)) continue;
      analyzedUrls.add(finalUrl);
      pages.push(page);
    } catch (error) { excluded.push({ url, reason: `Fetch error: ${String(error)}` }); }
  }

  if (input.pageSpeed) {
    for (const [index, page] of pages.entries()) {
      await onProgress({ phase: 'pagespeed', message: `Running PageSpeed for ${page.url}`, fetched: fetched.size, analyzed: pages.length, queued: 0, currentUrl: page.url, percent: 92 + Math.round(((index + 1) / Math.max(1, pages.length)) * 5) });
      page.pageSpeed = [await fetchPageSpeed(page.url, input.pageSpeedApiKey)];
    }
  }
  const pageByUrl = new Map(pages.map(page => [page.url, page]));
  for (const source of pages) {
    for (const destination of new Set(source.links.filter(link => link.internal).map(link => link.url))) {
      const target = pageByUrl.get(destination);
      if (target) target.incomingInternalLinks += 1;
    }
  }
  await onProgress({ phase: 'keywords', message: 'Scoring keyword targets and checking cannibalization', fetched: fetched.size, analyzed: pages.length, queued: 0, percent: 98 });
  const keywords = aggregateKeywords(pages, input.maxKeywords);
  if (input.serp) applyRankings(keywords, await getRankings(new HttpSerpProvider(input.serp), keywords, new URL(startUrl).hostname));
  const cannibalization = detectCannibalization(keywords);
  for (const redirect of redirects) redirect.sourcePages = pages.filter(page => page.links.some(link => link.url === redirect.source)).map(page => page.url);
  const failures = new Map(excluded.filter(item => item.status && item.status >= 400).map(item => [item.url, item]));
  const brokenLinks = input.reportBrokenLinks === false ? [] : pages.flatMap(page => page.links.filter(link => link.internal && failures.has(link.url)).map(link => {
    const failed = failures.get(link.url)!;
    return { sourcePage: page.url, anchorText: link.text || '[No anchor text]', destination: link.url, status: failed.status ?? null, error: failed.reason };
  }));
  const aiCrawlerAccess = ['OAI-SearchBot', 'Googlebot', 'Bingbot'].map(crawler => {
    const allowed = robots.isAllowed(startUrl, crawler) !== false;
    return { crawler, allowed, note: allowed ? 'Allowed to fetch the starting page by robots.txt.' : 'Blocked from the starting page by robots.txt.' };
  });
  const report: AuditReport = {
    domain: new URL(startUrl).hostname,
    config: {
      startUrl: input.startUrl, maxPages: input.maxPages, maxKeywords: input.maxKeywords,
      concurrency: input.concurrency, delayMs: input.delayMs, userAgent: input.userAgent,
      pageSpeed: input.pageSpeed, excludePaths: configuredExclusions, analyzeImages: input.analyzeImages !== false, reportBrokenLinks: input.reportBrokenLinks !== false, analyzeSchema: input.analyzeSchema !== false, serpConfigured: Boolean(input.serp), imageAnalysisConfigured: Boolean(input.imageAnalysis)
    },
    summary: { pagesFetched: fetched.size, indexablePagesAnalyzed: pages.length, excludedNonIndexable: excluded.length, keywordsIdentified: keywords.length, rankingsChecked: keywords.filter(k => k.ranking).length, sitemapPageUrls: sitemapInfo.pageUrls.length },
    sitemaps: sitemapInfo.results,
    redirects, brokenLinks,
    pages, excludedPages: excluded, keywords, cannibalization, aiCrawlerAccess, generatedAt: new Date().toISOString()
  };
  await onProgress({ phase: 'complete', message: 'Audit complete', fetched: fetched.size, analyzed: pages.length, queued: 0, percent: 100 });
  return report;
}
