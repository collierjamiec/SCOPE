import type { RedirectHop } from '../pipeline/types.js';
import { isHttpUrl } from './url.js';
import { discardBody } from './http.js';

export interface RedirectWalkResult {
  finalStatus: number | null;
  finalUrl: string;
  chain: RedirectHop[];
  error: string | null;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Node's built-in fetch auto-follows redirects and only exposes the final URL,
 * which can't satisfy "full redirect chain per hop". This walks manually with
 * `redirect: 'manual'`, reading Location headers hop by hop.
 */
export async function walkRedirects(
  startUrl: string,
  opts: { maxHops: number; timeoutMs: number },
): Promise<RedirectWalkResult> {
  const chain: RedirectHop[] = [];
  let currentUrl = startUrl;

  for (let hop = 0; hop <= opts.maxHops; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    try {
      const res = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': 'seo-geo-crawler/1.0 (+audit)' },
      });
      clearTimeout(timer);
      // Only status/headers are used below, never the body — release the
      // connection immediately rather than leaving it open on the pool.
      await discardBody(res);

      if (REDIRECT_STATUSES.has(res.status)) {
        chain.push({ url: currentUrl, status: res.status });
        const location = res.headers.get('location');
        if (!location) {
          return { finalStatus: res.status, finalUrl: currentUrl, chain, error: 'Redirect with no Location header' };
        }
        const next = new URL(location, currentUrl).toString();
        if (!isHttpUrl(next)) {
          return { finalStatus: res.status, finalUrl: currentUrl, chain, error: `Redirected to non-http(s) URL: ${next}` };
        }
        currentUrl = next;
        continue;
      }

      return { finalStatus: res.status, finalUrl: currentUrl, chain, error: null };
    } catch (err) {
      clearTimeout(timer);
      return {
        finalStatus: null,
        finalUrl: currentUrl,
        chain,
        error: err instanceof Error ? err.message : 'Unknown fetch error',
      };
    }
  }

  return { finalStatus: null, finalUrl: currentUrl, chain, error: `Exceeded ${opts.maxHops} redirect hops` };
}
