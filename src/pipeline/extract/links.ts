import type { Page } from 'playwright';
import pLimit from 'p-limit';
import type { AppConfig } from '../../config/index.js';
import type { ExtractedLink } from '../types.js';
import type { ProgressReporter } from '../../utils/progress.js';
import { walkRedirects } from '../../utils/redirectWalker.js';
import { isHttpUrl, isInternalUrl, resolveUrl } from '../../utils/url.js';

export interface RawLink {
  href: string;
  anchorText: string;
  hasImageContent: boolean;
  imageAlt: string | null;
}

/**
 * DOM read only — no network I/O. Must run immediately after navigation, in the
 * same batch as the other page.evaluate() extractors (see extract/index.ts),
 * not after the slow network-bound checkLinkStatuses below: link-status checking
 * can take many seconds for pages with lots of links, and if the live page
 * navigates away in that window (client-side redirect, consent-wall bounce,
 * etc.) any page.evaluate() still pending fails with "Execution context was
 * destroyed".
 */
export async function extractLinkElements(page: Page): Promise<RawLink[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).map((el) => {
      const img = el.querySelector('img');
      return {
        href: el.getAttribute('href') ?? '',
        anchorText: el.textContent?.trim() ?? '',
        hasImageContent: img !== null,
        imageAlt: img?.getAttribute('alt') ?? null,
      };
    }),
  );
}

/** Network-only from here — safe to run after the page itself has moved on. */
export async function checkLinkStatuses(
  rawLinks: RawLink[],
  pageUrl: string,
  config: AppConfig,
  progress: ProgressReporter,
): Promise<ExtractedLink[]> {
  const candidates = rawLinks
    .map((raw) => {
      const resolvedUrl = resolveUrl(raw.href, pageUrl);
      return resolvedUrl && isHttpUrl(resolvedUrl) ? { ...raw, resolvedUrl } : null;
    })
    .filter((x): x is RawLink & { resolvedUrl: string } => x !== null);

  const limit = pLimit(config.thresholds.linkCheckConcurrency);
  let completed = 0;

  const results = await Promise.all(
    candidates.map((link) =>
      limit(async () => {
        const walk = await walkRedirects(link.resolvedUrl, {
          maxHops: config.thresholds.maxRedirectHops,
          timeoutMs: config.thresholds.linkCheckTimeoutMs,
        });
        completed += 1;
        progress.update('extract', 0.3 + 0.5 * (completed / candidates.length), `Checking links (${completed}/${candidates.length})…`);

        const result: ExtractedLink = {
          href: link.href,
          resolvedUrl: link.resolvedUrl,
          isInternal: isInternalUrl(link.resolvedUrl, pageUrl),
          anchorText: link.anchorText,
          hasImageContent: link.hasImageContent,
          imageAlt: link.imageAlt,
          finalStatus: walk.finalStatus,
          finalUrl: walk.finalUrl,
          redirectChain: walk.chain,
          checkError: walk.error,
        };
        return result;
      }),
    ),
  );

  return results;
}
