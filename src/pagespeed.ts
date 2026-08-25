import type { PageSpeedResult } from './types.js';

export async function fetchPageSpeed(url: string, apiKey?: string): Promise<PageSpeedResult> {
  const result: PageSpeedResult = { strategy: 'mobile', performance: null, accessibility: null, bestPractices: null, seo: null, metrics: {} };
  try {
    const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
    endpoint.searchParams.set('url', url);
    endpoint.searchParams.set('strategy', 'mobile');
    for (const category of ['performance', 'accessibility', 'best-practices', 'seo']) endpoint.searchParams.append('category', category);
    if (apiKey) endpoint.searchParams.set('key', apiKey);
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`PageSpeed returned HTTP ${response.status}`);
    const data = await response.json() as any;
    const categories = data.lighthouseResult?.categories ?? {};
    result.performance = categories.performance?.score ?? null;
    result.accessibility = categories.accessibility?.score ?? null;
    result.bestPractices = categories['best-practices']?.score ?? null;
    result.seo = categories.seo?.score ?? null;
    const audits = data.lighthouseResult?.audits ?? {};
    for (const [name, id] of Object.entries({ lcp: 'largest-contentful-paint', cls: 'cumulative-layout-shift', tbt: 'total-blocking-time', fcp: 'first-contentful-paint', speedIndex: 'speed-index' })) {
      result.metrics[name] = audits[id]?.numericValue ?? null;
    }
  } catch (error) { result.error = String(error); }
  return result;
}
