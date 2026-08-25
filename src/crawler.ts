import { createRequire } from 'node:module';
import * as cheerio from 'cheerio';
import type { AuditConfig, AuditReport, ExternalPageResult, PageResult, SitemapResult } from './types.js';
import { extractPage } from './extract.js';
import { aggregateKeywords, applyRankings, detectCannibalization } from './keywords.js';
import { applyGa4Export, detectGscDateRange, mergeGscExport } from './imports.js';
import { fetchPageSpeed } from './pagespeed.js';
import { getRankings, HttpSerpProvider } from './serp.js';
import { enrichImageRecommendations } from './image-analysis.js';
import { normaliseUrl, sameHost } from './util.js';
import { buildPriorities } from './priorities.js';
import { resolve } from 'node:path';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const require = createRequire(import.meta.url);
const robotsParser = require('robots-parser') as (url: string, body: string) => {
  isAllowed(url: string, userAgent?: string): boolean | undefined;
  getSitemaps(): string[];
};

export interface CrawlProgress {
  phase: 'starting' | 'robots' | 'sitemaps' | 'crawling' | 'external' | 'pagespeed' | 'keywords' | 'complete';
  message: string;
  fetched: number;
  analyzed: number;
  queued: number;
  currentUrl?: string;
  percent: number | null;
}

export type ProgressReporter = (progress: CrawlProgress) => void | Promise<void>;
export interface CrawlControl { isPaused(): boolean; isCancelled(): boolean }

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

const trackingParameters = /^(utm_.+|gclid|fbclid|msclkid|dclid|mc_cid|mc_eid|share|replytocom)$/i;
export function safeCrawlUrl(url: string, stripTracking = true): string {
  const candidate = new URL(url);
  candidate.hash = '';
  if (stripTracking) for (const key of [...candidate.searchParams.keys()]) if (trackingParameters.test(key)) candidate.searchParams.delete(key);
  candidate.searchParams.sort();
  return candidate.href;
}

const urlDepth = (url: string) => new URL(url).pathname.split('/').filter(Boolean).length;
const pathBucket = (url: string) => new URL(url).pathname.split('/').filter(Boolean)[0] ?? '/';
export function isArchiveUrl(url: string): boolean {
  const candidate = new URL(url);
  return /^\/(tag|category|author)(\/|$)/i.test(candidate.pathname)
    || /\/page\/\d+\/?$/i.test(candidate.pathname)
    || /\/feed\/?$/i.test(candidate.pathname)
    || candidate.searchParams.has('s');
}

export function needsJavaScriptRendering(html: string): boolean {
  const $ = cheerio.load(html);
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const meaningfulStructure = $('h1,h2,main,article').length > 0;
  const discoverableLinks = $('a[href]').length >= 3;
  const metadata = $('title').text().trim() || $('meta[name="description"]').attr('content')?.trim();
  // Server-rendered CMS pages already expose everything needed for an SEO audit.
  // Browser rendering is reserved for thin application shells whose content is populated by JavaScript.
  return bodyText.length < 400 || !meaningfulStructure || !discoverableLinks || !metadata;
}

export function isGatedAuthenticationFlow(source: string, finalUrl: string, chain: string[] = []): boolean {
  const sourceUrl = new URL(source);
  const destination = new URL(finalUrl);
  const patreonUnlock = /(^|\/)patreon-flow\/?$/i.test(sourceUrl.pathname)
    || [...sourceUrl.searchParams.keys()].some(key => /^patreon-(?:unlock|login|final)/i.test(key));
  const patreonAuthentication = [destination, ...chain.map(url => new URL(url))]
    .some(url => /(^|\.)patreon\.com$/i.test(url.hostname) && /\/(?:login|oauth2)(?:\/|$)/i.test(url.pathname));
  if (patreonUnlock && patreonAuthentication) return true;

  const sourceSignalsAuthentication = /\/(?:login|sign-?in|oauth|authorize|checkout|subscribe|membership|members|unlock)(?:\/|$)/i.test(sourceUrl.pathname)
    || [...sourceUrl.searchParams.keys()].some(key => /(?:login|auth|oauth|unlock|return|redirect)/i.test(key));
  const destinationIsAuthentication = /\/(?:login|sign-?in|oauth2?|authorize|checkout|subscribe|membership)(?:\/|$)/i.test(destination.pathname);
  return sourceUrl.hostname !== destination.hostname && sourceSignalsAuthentication && destinationIsAuthentication;
}

export function isTrailingSlashOnlyRedirect(source: string, finalUrl: string): boolean {
  const from = new URL(source);
  const to = new URL(finalUrl);
  const trimSlash = (path: string) => path.length > 1 ? path.replace(/\/+$/, '') : path;
  return from.origin === to.origin
    && from.search === to.search
    && trimSlash(from.pathname) === trimSlash(to.pathname)
    && from.pathname !== to.pathname;
}

export function validateConfig(config: AuditConfig): void {
  const url = new URL(config.startUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Start URL must use HTTP or HTTPS.');
  if (config.maxPages !== null && (!Number.isInteger(config.maxPages) || config.maxPages < 1)) throw new Error('maxPages must be null (unlimited) or a positive integer.');
  if (!Number.isInteger(config.maxKeywords) || config.maxKeywords < 1 || config.maxKeywords > 5000) throw new Error('maxKeywords must be an integer between 1 and 5000.');
  if (config.maxRankings !== undefined && (!Number.isInteger(config.maxRankings) || config.maxRankings < 0 || config.maxRankings > 100)) throw new Error('maxRankings must be an integer between 0 and 100.');
  if (config.maxDepth !== undefined && config.maxDepth !== null && (!Number.isInteger(config.maxDepth) || config.maxDepth < 0 || config.maxDepth > 50)) throw new Error('maxDepth must be null or an integer between 0 and 50.');
  if (config.maxUrlsPerPath !== undefined && (!Number.isInteger(config.maxUrlsPerPath) || config.maxUrlsPerPath < 10)) throw new Error('maxUrlsPerPath must be at least 10.');
  if (config.externalCrawlDepth !== undefined && (!Number.isInteger(config.externalCrawlDepth) || config.externalCrawlDepth < 0 || config.externalCrawlDepth > 3)) throw new Error('externalCrawlDepth must be an integer between 0 and 3.');
  if (config.maxExternalPages !== undefined && (!Number.isInteger(config.maxExternalPages) || config.maxExternalPages < 1 || config.maxExternalPages > 5000)) throw new Error('maxExternalPages must be between 1 and 5000.');
}

const safeExternalTarget = (url: string) => {
  const host = new URL(url).hostname.toLowerCase();
  return host !== 'localhost' && host !== '0.0.0.0' && host !== '::1'
    && !/^127\./.test(host) && !/^10\./.test(host) && !/^192\.168\./.test(host)
    && !/^169\.254\./.test(host) && !/^172\.(1[6-9]|2\d|3[01])\./.test(host);
};

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
    let next: string;
    try {
      const target = new URL(location, current);
      if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Unsupported redirect protocol');
      target.hash = '';
      next = target.href;
    } catch { throw new Error(`Invalid redirect target from ${current}`); }
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

export async function crawlSite(input: AuditConfig, onProgress: ProgressReporter = () => {}, control: CrawlControl = { isPaused: () => false, isCancelled: () => false }): Promise<AuditReport> {
  validateConfig(input);
  const startUrl = normaliseUrl(input.startUrl)!;
  const origin = new URL(startUrl).origin;
  await onProgress({ phase: 'starting', message: 'Preparing crawl', fetched: 0, analyzed: 0, queued: 1, percent: 0 });
  const robotsInfo = await loadRobots(origin, input.userAgent);
  await onProgress({ phase: 'robots', message: 'robots.txt loaded and crawl rules applied', fetched: 0, analyzed: 0, queued: 1, percent: 1 });
  const robots = robotsInfo.parser;
  const sitemapInfo = await inspectSitemaps(origin, robotsInfo.sitemapUrls, input.userAgent);
  const clean = (url: string) => safeCrawlUrl(url, input.stripTrackingParameters !== false);
  const queue = [startUrl, ...sitemapInfo.pageUrls.filter(url => url !== startUrl)].map(clean);
  const queued = new Set(queue);
  const fetched = new Set<string>();
  const pages: PageResult[] = [];
  const analyzedUrls = new Set<string>();
  const redirects: AuditReport['redirects'] = [];
  const excluded: AuditReport['excludedPages'] = [];
  const configuredExclusions = input.excludePaths ?? [];
  const pathCounts = new Map<string, number>();
  let renderedBrowser: import('playwright').Browser | undefined;
  let browserLaunch: Promise<import('playwright').Browser> | undefined;
  let activeRenders = 0;
  const renderWaiters: Array<() => void> = [];
  const acquireRenderSlot = async () => {
    if (activeRenders >= 2) await new Promise<void>(resolve => renderWaiters.push(resolve));
    activeRenders += 1;
  };
  const releaseRenderSlot = () => {
    activeRenders -= 1;
    renderWaiters.shift()?.();
  };
  const renderedHtml = async (url: string) => {
    await acquireRenderSlot();
    let page: import('playwright').Page | undefined;
    try {
      process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve('.playwright-browsers');
      if (!browserLaunch) browserLaunch = import('playwright').then(({ chromium }) => chromium.launch({ headless: true }));
      renderedBrowser = await browserLaunch;
      page = await renderedBrowser.newPage({ userAgent: input.userAgent });
      await page.route('**/*', route => {
        const request = route.request();
        const host = new URL(request.url()).hostname;
        const expendable = ['image', 'media', 'font'].includes(request.resourceType());
        const tracker = /(^|\.)(google-analytics\.com|googletagmanager\.com|doubleclick\.net|facebook\.net|hotjar\.com|clarity\.ms|segment\.io|segment\.com)$/i.test(host);
        return expendable || tracker ? route.abort() : route.continue();
      });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      await page.waitForTimeout(150);
      return await page.content();
    } finally {
      await page?.close().catch(() => undefined);
      releaseRenderSlot();
    }
  };
  await onProgress({ phase: 'sitemaps', message: `Discovered ${sitemapInfo.pageUrls.length} sitemap URLs`, fetched: 0, analyzed: 0, queued: queue.length, percent: input.maxPages ? 2 : null });

  const processUrl = async (url: string) => {
    if (fetched.has(url) || control.isCancelled()) return;
    if (isExcludedUrl(url, configuredExclusions)) { excluded.push({ url, reason: 'Excluded by audit configuration' }); return; }
    if (input.excludeArchives && isArchiveUrl(url)) { excluded.push({ url, reason: 'Excluded common archive URL' }); return; }
    if (input.maxDepth !== null && urlDepth(url) > (input.maxDepth ?? 12)) { excluded.push({ url, reason: `Crawl safety: URL depth exceeds ${input.maxDepth ?? 12}` }); return; }
    const bucket = pathBucket(url), bucketCount = pathCounts.get(bucket) ?? 0;
    if (bucketCount >= (input.maxUrlsPerPath ?? 2000)) { excluded.push({ url, reason: `Crawl safety: more than ${input.maxUrlsPerPath ?? 2000} URLs in /${bucket === '/' ? '' : bucket}` }); return; }
    pathCounts.set(bucket, bucketCount + 1);
    fetched.add(url);
    await onProgress({
      phase: 'crawling', message: `Fetching ${url}`, fetched: fetched.size, analyzed: pages.length, queued: queue.length,
      currentUrl: url,
      percent: input.maxPages ? Math.min(92, Math.round((fetched.size / input.maxPages) * 90) + 2) : (queue.length + fetched.size ? Math.min(92, Math.round((fetched.size / (fetched.size + queue.length)) * 90) + 2) : null)
    });
    if (robots.isAllowed(url, input.userAgent) === false) { excluded.push({ url, reason: 'Disallowed by robots.txt' }); return; }
    if (input.delayMs) await sleep(input.delayMs);
    try {
      const { response, finalUrl, redirectChain, responseTimeMs } = await fetchWithRedirects(url, input.userAgent);
      const gatedAuthentication = isGatedAuthenticationFlow(url, finalUrl, redirectChain);
      if (redirectChain.length && !isTrailingSlashOnlyRedirect(url, finalUrl)) redirects.push({ source: url, sourcePages: [], chain: redirectChain, finalUrl, finalStatus: response.status, classification: gatedAuthentication ? 'gated_authentication_flow' : 'redirect' });
      if (!sameHost(finalUrl, startUrl)) {
        excluded.push(gatedAuthentication
          ? { url, reason: `Intentional gated/authentication flow; the destination provider response is not treated as a broken link. Final destination: ${finalUrl}` }
          : { url, reason: `Redirected outside the audited domain: ${finalUrl}`, status: response.status });
        return;
      }
      const contentType = response.headers.get('content-type') ?? '';
      if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) { excluded.push({ url: finalUrl, reason: 'Non-HTML content', status: response.status }); return; }
      const rawHtml = await response.text();
      let html = rawHtml, renderError = '';
      if (input.renderJavaScript && needsJavaScriptRendering(rawHtml)) try { html = await renderedHtml(finalUrl); } catch (error) { renderError = String(error); }
      const page = extractPage(url, finalUrl, response.status, contentType, html, response.headers, redirectChain, responseTimeMs);
      if (renderError) page.findings.push({ category: 'seo', severity: 'warning', rule: 'javascript_render_failed', message: `JavaScript rendering failed; raw HTML was analyzed. ${renderError}` });
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
      if (!input.sitemapOnly) for (const link of page.links) {
          const destination = clean(link.url);
          if (link.internal && sameHost(destination, startUrl) && !queued.has(destination) && !fetched.has(destination)) { queue.push(destination); queued.add(destination); }
        }
      if (!page.indexable) { excluded.push({ url: finalUrl, reason: `Non-indexable (${page.robotsDirectives.includes('noindex') ? 'noindex' : `HTTP ${response.status}`})`, status: response.status }); return; }
      if (analyzedUrls.has(finalUrl)) return;
      analyzedUrls.add(finalUrl);
      pages.push(page);
    } catch (error) { excluded.push({ url, reason: `Fetch error: ${String(error)}` }); }
  };

  while (queue.length && (input.maxPages === null || fetched.size < input.maxPages)) {
    while (control.isPaused() && !control.isCancelled()) { await onProgress({ phase: 'crawling', message: 'Crawl paused', fetched: fetched.size, analyzed: pages.length, queued: queue.length, percent: null }); await sleep(250); }
    if (control.isCancelled()) break;
    const remaining = input.maxPages === null ? queue.length : Math.min(queue.length, input.maxPages - fetched.size);
    const batch = queue.splice(0, Math.min(Math.max(1, input.concurrency), remaining));
    await Promise.all(batch.map(processUrl));
  }

  const externalPages: ExternalPageResult[] = [];
  const externalDepth = input.externalCrawlDepth ?? 0;
  if (externalDepth > 0 && !control.isCancelled()) {
    const externalLimit = input.maxExternalPages ?? 500;
    const externalQueue: Array<{ url: string; depth: number; sourcePages: Set<string> }> = [];
    const externalQueued = new Map<string, { url: string; depth: number; sourcePages: Set<string> }>();
    const enqueueExternal = (url: string, depth: number, sourcePage: string) => {
      if (depth > externalDepth || sameHost(url, startUrl) || !safeExternalTarget(url)) return;
      const normalized = safeCrawlUrl(url, input.stripTrackingParameters !== false);
      const existing = externalQueued.get(normalized);
      if (existing) { existing.sourcePages.add(sourcePage); return; }
      const item = { url: normalized, depth, sourcePages: new Set([sourcePage]) };
      externalQueued.set(normalized, item); externalQueue.push(item);
    };
    for (const page of pages) for (const link of page.links.filter(link => !link.internal)) enqueueExternal(link.url, 1, page.url);
    const externalRobots = new Map<string, Awaited<ReturnType<typeof loadRobots>>>();
    while (externalQueue.length && externalPages.length < externalLimit && !control.isCancelled()) {
      const batch = externalQueue.splice(0, Math.min(input.concurrency, externalLimit - externalPages.length));
      await Promise.all(batch.map(async item => {
        const targetOrigin = new URL(item.url).origin;
        let rules = externalRobots.get(targetOrigin);
        if (!rules) { rules = await loadRobots(targetOrigin, input.userAgent); externalRobots.set(targetOrigin, rules); }
        const allowed = rules.parser.isAllowed(item.url, input.userAgent) !== false;
        await onProgress({ phase: 'external', message: `Checking external link ${item.url}`, fetched: fetched.size, analyzed: pages.length, queued: externalQueue.length, currentUrl: item.url, percent: null });
        if (!allowed) { externalPages.push({ url: item.url, finalUrl: item.url, depth: item.depth, status: null, contentType: '', responseTimeMs: null, redirectChain: [], sourcePages: [...item.sourcePages], robotsAllowed: false, error: 'Disallowed by external robots.txt' }); return; }
        try {
          const result = await fetchWithRedirects(item.url, input.userAgent);
          const contentType = result.response.headers.get('content-type') ?? '';
          externalPages.push({ url: item.url, finalUrl: result.finalUrl, depth: item.depth, status: result.response.status, contentType, responseTimeMs: result.responseTimeMs, redirectChain: result.redirectChain, sourcePages: [...item.sourcePages], robotsAllowed: true });
          if (item.depth < externalDepth && result.response.ok && /text\/html|application\/xhtml\+xml/i.test(contentType)) {
            const html = await result.response.text(); const $ = cheerio.load(html);
            for (const href of $('a[href]').map((_, element) => normaliseUrl($(element).attr('href') ?? '', result.finalUrl)).get().filter(Boolean)) enqueueExternal(href, item.depth + 1, item.url);
          }
        } catch (error) { externalPages.push({ url: item.url, finalUrl: item.url, depth: item.depth, status: null, contentType: '', responseTimeMs: null, redirectChain: [], sourcePages: [...item.sourcePages], robotsAllowed: true, error: String(error) }); }
      }));
    }
  }

  if (input.pageSpeed && !control.isCancelled()) {
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
  const standardGscFiles = input.gscCsvFiles?.length ? input.gscCsvFiles : input.gscCsv ? [input.gscCsv] : [];
  const combinedGscFiles = [input.gscQueryPageCsv, ...standardGscFiles.filter(csv => /(?:^|,)\s*(?:page|top pages)\s*(?:,|$)/im.test(csv) && /(?:^|,)\s*(?:query|top queries)\s*(?:,|$)/im.test(csv))].filter((csv): csv is string => Boolean(csv));
  const selectedGscFiles = combinedGscFiles.length ? combinedGscFiles : standardGscFiles;
  const gscRows = selectedGscFiles.reduce((total, csv) => total + mergeGscExport(keywords, csv, input.maxKeywords, startUrl), 0);
  keywords.sort((a, b) => Number(Boolean(b.searchConsole)) - Number(Boolean(a.searchConsole))
    || (b.searchConsole?.impressions ?? 0) - (a.searchConsole?.impressions ?? 0)
    || b.score - a.score
    || a.keyword.localeCompare(b.keyword));
  if (keywords.length > input.maxKeywords) keywords.splice(input.maxKeywords);
  const gscDateRange = detectGscDateRange([input.gscQueryPageCsv, ...standardGscFiles]);
  const ga4Rows = applyGa4Export(pages, input.ga4Csv, startUrl);
  const rankingCandidates = keywords.slice(0, input.maxRankings ?? 100);
  if (input.serp && rankingCandidates.length) applyRankings(rankingCandidates, await getRankings(new HttpSerpProvider(input.serp), rankingCandidates, new URL(startUrl).hostname));
  const cannibalization = detectCannibalization(keywords);
  for (const redirect of redirects) redirect.sourcePages = pages.filter(page => page.links.some(link => link.url === redirect.source)).map(page => page.url);
  const failures = new Map(excluded.filter(item => item.status && item.status >= 400 && !item.reason.startsWith('Intentional gated/authentication flow')).map(item => [item.url, item]));
  const brokenLinks = input.reportBrokenLinks === false ? [] : pages.flatMap(page => page.links.filter(link => link.internal && failures.has(link.url)).map(link => {
    const failed = failures.get(link.url)!;
    return { sourcePage: page.url, anchorText: link.text || '[No anchor text]', destination: link.url, status: failed.status ?? null, error: failed.reason };
  }));
  const crawlerNotes: Record<string, string> = {
    'OAI-SearchBot': 'Controls eligibility for content to be surfaced in ChatGPT search answers.',
    GPTBot: 'Controls whether content may be crawled for potential use in training OpenAI generative AI foundation models; this is independent from ChatGPT search.',
    'ChatGPT-User': 'Represents user-initiated ChatGPT visits; allowing it does not control ChatGPT search inclusion.',
    Googlebot: 'Controls Google Search crawling.',
    Bingbot: 'Controls Bing Search crawling.'
  };
  const aiCrawlerAccess = ['OAI-SearchBot', 'GPTBot', 'ChatGPT-User', 'Googlebot', 'Bingbot'].map(crawler => {
    const allowed = robots.isAllowed(startUrl, crawler) !== false;
    return { crawler, allowed, note: `${allowed ? 'Allowed' : 'Blocked'} on the starting page by robots.txt. ${crawlerNotes[crawler]}` };
  });
  const report: AuditReport = {
    domain: new URL(startUrl).hostname,
    config: {
      startUrl: input.startUrl, maxPages: input.maxPages, maxKeywords: input.maxKeywords, maxRankings: input.maxRankings ?? 100,
      concurrency: input.concurrency, delayMs: input.delayMs, userAgent: input.userAgent,
      pageSpeed: input.pageSpeed, excludePaths: configuredExclusions, maxDepth: input.maxDepth ?? 12, maxUrlsPerPath: input.maxUrlsPerPath ?? 2000, stripTrackingParameters: input.stripTrackingParameters !== false, renderJavaScript: Boolean(input.renderJavaScript), sitemapOnly: Boolean(input.sitemapOnly), excludeArchives: Boolean(input.excludeArchives), externalCrawlDepth: externalDepth, maxExternalPages: input.maxExternalPages ?? 500, analyzeImages: input.analyzeImages !== false, reportBrokenLinks: input.reportBrokenLinks !== false, analyzeSchema: input.analyzeSchema !== false, serpConfigured: Boolean(input.serp), imageAnalysisConfigured: Boolean(input.imageAnalysis)
    },
    summary: { pagesFetched: fetched.size, indexablePagesAnalyzed: pages.length, excludedNonIndexable: excluded.length, keywordsIdentified: keywords.length, rankingsChecked: keywords.filter(k => k.ranking).length, sitemapPageUrls: sitemapInfo.pageUrls.length },
    sitemaps: sitemapInfo.results,
    redirects, brokenLinks, externalPages,
    pages, excludedPages: excluded, keywords, cannibalization, aiCrawlerAccess, importedData: { gscRows, ga4Rows, gscKeywords: keywords.filter(keyword => keyword.searchConsole).length, ga4MatchedPages: pages.filter(page => page.analytics).length, gscDateRange }, priorities: buildPriorities(pages), generatedAt: new Date().toISOString(), partial: control.isCancelled()
  };
  await renderedBrowser?.close();
  await onProgress({ phase: 'complete', message: 'Audit complete', fetched: fetched.size, analyzed: pages.length, queued: 0, percent: 100 });
  return report;
}
