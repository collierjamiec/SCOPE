import type { PageSpeedResult } from './types.js';

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

export async function fetchPageSpeed(url: string, apiKey?: string): Promise<PageSpeedResult> {
  let result: PageSpeedResult = { strategy: 'mobile', performance: null, accessibility: null, bestPractices: null, seo: null, metrics: {}, fieldMetrics: {} };
  try {
    const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
    endpoint.searchParams.set('url', url);
    endpoint.searchParams.set('strategy', 'mobile');
    for (const category of ['performance', 'accessibility', 'best-practices', 'seo']) endpoint.searchParams.append('category', category);
    if (apiKey) endpoint.searchParams.set('key', apiKey);
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`PageSpeed returned HTTP ${response.status}`);
    result = parsePageSpeedResponse(await response.json());
  } catch (error) { result.error = String(error); }
  return result;
}
