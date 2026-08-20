import type { Page } from 'playwright';
import type { ExtractedMetadata } from '../types.js';

export async function extractMetadata(page: Page, pageUrl: string): Promise<ExtractedMetadata> {
  const raw = await page.evaluate(() => {
    // Assigned via member-expression, not `const fn = () => {}` — tsx/esbuild's keepNames
    // wraps named const/let function bindings in a `__name()` helper call for stack traces,
    // and since page.evaluate serializes only this callback's own source text (not the
    // module-level `__name` helper) to run in the browser, that wrapping throws
    // "ReferenceError: __name is not defined" in-page. Plain assignment avoids the wrap.
    const helpers = {} as {
      meta: (name: string) => string | null;
      metaProp: (prop: string) => string | null;
    };
    helpers.meta = (name) => document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? null;
    helpers.metaProp = (prop) =>
      document.querySelector(`meta[property="${prop}"]`)?.getAttribute('content') ?? null;
    const meta = helpers.meta;
    const metaProp = helpers.metaProp;

    const publishDateSelectors = [
      'time[datetime]',
      '[itemprop="datePublished"]',
      '[itemprop="datePublished"] time',
      '.published-date',
      '.publish-date',
      '.post-date',
    ];
    let publishDate: string | null = metaProp('article:published_time');
    if (!publishDate) {
      for (const sel of publishDateSelectors) {
        const el = document.querySelector(sel);
        if (!el) continue;
        publishDate = el.getAttribute('datetime') ?? el.textContent?.trim() ?? null;
        if (publishDate) break;
      }
    }

    const canonicalHref = document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null;
    const robotsRaw = meta('robots');

    return {
      title: document.querySelector('title')?.textContent?.trim() ?? null,
      metaDescription: meta('description'),
      og: {
        title: metaProp('og:title'),
        description: metaProp('og:description'),
        image: metaProp('og:image'),
      },
      twitter: {
        card: meta('twitter:card'),
        title: meta('twitter:title'),
        description: meta('twitter:description'),
        image: meta('twitter:image'),
      },
      canonicalHref,
      robotsRaw,
      viewportPresent: document.querySelector('meta[name="viewport"]') !== null,
      publishDate,
    };
  });

  const robotsRaw = raw.robotsRaw?.toLowerCase() ?? null;
  const index = robotsRaw ? !robotsRaw.includes('noindex') : true;
  const follow = robotsRaw ? !robotsRaw.includes('nofollow') : true;

  let isSelfReferential: boolean | null = null;
  if (raw.canonicalHref) {
    try {
      // Compare normalized forms on both sides — new URL() always normalizes
      // (e.g. adds the implicit "/" path on a bare origin), so comparing its
      // output against a raw, un-normalized pageUrl string produces false
      // "points elsewhere" mismatches for URLs that are actually identical
      // (e.g. "https://example.com" vs "https://example.com/").
      const resolved = new URL(raw.canonicalHref, pageUrl).toString();
      const normalizedPageUrl = new URL(pageUrl).toString();
      isSelfReferential = resolved === normalizedPageUrl;
    } catch {
      isSelfReferential = null;
    }
  }

  return {
    title: raw.title,
    metaDescription: raw.metaDescription,
    og: raw.og,
    twitter: raw.twitter,
    canonical: { href: raw.canonicalHref, isSelfReferential },
    robotsMeta: { index, follow, raw: raw.robotsRaw },
    viewportPresent: raw.viewportPresent,
    publishDate: raw.publishDate,
  };
}
