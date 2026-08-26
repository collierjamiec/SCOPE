import type { PageSpeedResult } from './types.js';
import { chmod, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const pageSpeedKeyPath = () => process.env.SCOPE_PAGESPEED_KEY_FILE ?? join(process.env.SCOPE_DATA_DIR ?? resolve(process.cwd(), '.scope'), 'pagespeed.json');
export async function loadPageSpeedApiKey(): Promise<string | undefined> { try { return String(JSON.parse(await readFile(pageSpeedKeyPath(), 'utf8')).apiKey || '') || undefined; } catch { return undefined; } }
export async function savePageSpeedApiKey(apiKey: string): Promise<void> { const path = pageSpeedKeyPath(), temporary = `${path}.${process.pid}.tmp`; await mkdir(dirname(path), { recursive: true, mode: 0o700 }); await writeFile(temporary, `${JSON.stringify({ apiKey }, null, 2)}\n`, { mode: 0o600 }); await chmod(temporary, 0o600); await rename(temporary, path); await chmod(path, 0o600); }
export async function removePageSpeedApiKey(): Promise<void> { try { await unlink(pageSpeedKeyPath()); } catch { /* Already absent. */ } }

export function parsePageSpeedResponse(data: any): PageSpeedResult {
  const result: PageSpeedResult = { strategy: 'mobile', performance: null, accessibility: null, bestPractices: null, seo: null, metrics: {}, fieldMetrics: {} };
  const categories = data.lighthouseResult?.categories ?? {};
  result.performance = categories.performance?.score ?? null;
  result.accessibility = categories.accessibility?.score ?? null;
  result.bestPractices = categories['best-practices']?.score ?? null;
  result.seo = categories.seo?.score ?? null;
  const audits = data.lighthouseResult?.audits ?? {};
  for (const [name, id] of Object.entries({ lcp: 'largest-contentful-paint', cls: 'cumulative-layout-shift', tbt: 'total-blocking-time', fcp: 'first-contentful-paint', speedIndex: 'speed-index' })) {
    result.metrics[name] = audits[id]?.numericValue ?? null;
  }
  const field = data.loadingExperience?.metrics ?? {};
  for (const [name, id] of Object.entries({ lcp: 'LARGEST_CONTENTFUL_PAINT_MS', cls: 'CUMULATIVE_LAYOUT_SHIFT_SCORE', inp: 'INTERACTION_TO_NEXT_PAINT', fcp: 'FIRST_CONTENTFUL_PAINT_MS' })) {
    const metric = field[id];
    result.fieldMetrics![name] = { percentile: metric?.percentile ?? null, category: metric?.category ?? null };
  }
  return result;
}

type PageSpeedFetchOptions = { maxRetries?: number; sleep?: (milliseconds: number) => Promise<void>; signal?: AbortSignal };

const retryDelay = (response: Response, attempt: number): number => {
  const header = response.headers.get('retry-after');
  if (header) {
    const seconds = Number(header); if (Number.isFinite(seconds)) return Math.min(60_000, Math.max(1_000, seconds * 1000));
    const date = new Date(header).valueOf(); if (Number.isFinite(date)) return Math.min(60_000, Math.max(1_000, date - Date.now()));
  }
  return [2_000, 5_000, 15_000, 30_000][attempt] ?? 30_000;
};

export async function fetchPageSpeed(url: string, apiKey?: string, options: PageSpeedFetchOptions = {}): Promise<PageSpeedResult> {
  let result: PageSpeedResult = { strategy: 'mobile', performance: null, accessibility: null, bestPractices: null, seo: null, metrics: {}, fieldMetrics: {} };
  try {
    const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
    endpoint.searchParams.set('url', url);
    endpoint.searchParams.set('strategy', 'mobile');
    for (const category of ['performance', 'accessibility', 'best-practices', 'seo']) endpoint.searchParams.append('category', category);
    if (apiKey) endpoint.searchParams.set('key', apiKey);
    const maximumRetries = options.maxRetries ?? 3, sleep = options.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
    for (let attempt = 0; ; attempt += 1) {
      if (options.signal?.aborted) throw new DOMException('PageSpeed request cancelled', 'AbortError');
      const response = await fetch(endpoint, { signal: options.signal });
      if (response.ok) { result = parsePageSpeedResponse(await response.json()); break; }
      const retryable = response.status === 429 || [500, 502, 503, 504].includes(response.status);
      if (retryable && attempt < maximumRetries) {
        await Promise.race([sleep(retryDelay(response, attempt)), new Promise<void>(resolve => options.signal?.addEventListener('abort', () => resolve(), { once: true }))]);
        if (options.signal?.aborted) throw new DOMException('PageSpeed request cancelled', 'AbortError');
        continue;
      }
      if (response.status === 429) {
        result.errorCode = 'rate_limited';
        result.error = `Google PageSpeed quota or rate limit was exhausted (HTTP 429) after ${attempt + 1} attempt(s). Verify PAGESPEED_API_KEY quota or retry the audit later.`;
      } else {
        result.errorCode = 'http_error'; result.error = `PageSpeed returned HTTP ${response.status}.`;
      }
      break;
    }
  } catch (error) { result.errorCode = 'network_error'; result.error = `PageSpeed request failed: ${error instanceof Error ? error.message : String(error)}`; }
  return result;
}
