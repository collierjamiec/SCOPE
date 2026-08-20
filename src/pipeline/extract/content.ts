import type { Page } from 'playwright';
import type { ExtractedContent, ExtractedLink } from '../types.js';
import { getDomain } from '../../utils/url.js';

export interface ContentDomSignals {
  authorByline: string | null;
  structuralElementCount: number;
  bodyTextLength: number;
}

/**
 * DOM read only — must run immediately after navigation alongside the other
 * page.evaluate() extractors (see extract/index.ts), not after link-status
 * checking: that's a slow network-bound phase, and if the live page navigates
 * away while it's running (client-side redirect, consent-wall bounce, etc.)
 * any page.evaluate() still pending fails with "Execution context was
 * destroyed".
 */
export async function extractContentDomSignals(page: Page): Promise<ContentDomSignals> {
  return page.evaluate(() => {
    const authorSelectors = [
      '[rel="author"]',
      '[itemprop="author"]',
      '.author',
      '.byline',
      '.post-author',
      'meta[name="author"]',
    ];
    let authorByline: string | null = null;
    for (const sel of authorSelectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      authorByline = el.getAttribute('content') ?? el.textContent?.trim() ?? null;
      if (authorByline) break;
    }

    const structuralElementCount = document.querySelectorAll(
      'ul li, ol li, table, dl, blockquote, pre',
    ).length;

    const bodyTextLength = document.body?.innerText?.trim().length ?? 0;

    return { authorByline, structuralElementCount, bodyTextLength };
  });
}

/** Pure computation — no page access, safe to run after the page has moved on. */
export function buildContent(
  domSignals: ContentDomSignals,
  links: ExtractedLink[],
  schemaTypes: string[],
): ExtractedContent {
  const outboundDomains = Array.from(
    new Set(
      links
        .filter((l) => !l.isInternal)
        .map((l) => {
          try {
            return getDomain(l.resolvedUrl);
          } catch {
            return null;
          }
        })
        .filter((d): d is string => d !== null),
    ),
  );

  return {
    authorByline: domSignals.authorByline,
    hasPersonSchema: schemaTypes.includes('Person'),
    outboundDomains,
    structuralElementCount: domSignals.structuralElementCount,
    bodyTextLength: domSignals.bodyTextLength,
  };
}
