import { XMLParser } from 'fast-xml-parser';
import { originOf } from './url.js';
import { discardBody } from './http.js';

export interface SitemapResult {
  fetched: boolean;
  present: boolean;
  urlListed: boolean | null;
}

function collectLocs(node: unknown, out: string[]): void {
  if (!node || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  if (typeof obj.loc === 'string') out.push(obj.loc);

  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      for (const item of value) collectLocs(item, out);
    } else if (typeof value === 'object') {
      collectLocs(value, out);
    }
  }
}

/**
 * Checks the top-level sitemap.xml at the domain root. Does not recurse into
 * nested sitemaps referenced by a sitemap index — sufficient for a single-page
 * v1 audit; a v3 full-site crawler would want the recursive version.
 */
export async function checkSitemap(url: string, timeoutMs: number): Promise<SitemapResult> {
  const sitemapUrl = `${originOf(url)}/sitemap.xml`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(sitemapUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      await discardBody(res);
      return { fetched: true, present: false, urlListed: null };
    }
    const body = await res.text();
    const parser = new XMLParser();
    const parsed: unknown = parser.parse(body);
    const locs: string[] = [];
    collectLocs(parsed, locs);
    return { fetched: true, present: true, urlListed: locs.includes(url) };
  } catch {
    clearTimeout(timer);
    return { fetched: false, present: false, urlListed: null };
  }
}
