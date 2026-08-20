import { config } from '../src/config/index.js';
import type { ExtractedData, ExtractedImage, ExtractedLink, ImageFormat } from '../src/pipeline/types.js';

export function makeImage(overrides: Partial<ExtractedImage> & { src: string }): ExtractedImage {
  const format: ImageFormat | null = overrides.format ?? null;
  return {
    resolvedSrc: overrides.resolvedSrc ?? new URL(overrides.src, 'https://example.com/page').toString(),
    alt: overrides.alt ?? null,
    format,
    isNextGenFormat: format === null ? null : config.thresholds.nextGenImageFormats.includes(format),
    width: overrides.width ?? null,
    height: overrides.height ?? null,
    ...overrides,
  };
}

export function makeLink(overrides: Partial<ExtractedLink> & { resolvedUrl: string }): ExtractedLink {
  return {
    href: overrides.href ?? overrides.resolvedUrl,
    isInternal: overrides.isInternal ?? true,
    anchorText: overrides.anchorText ?? '',
    hasImageContent: overrides.hasImageContent ?? false,
    imageAlt: overrides.imageAlt ?? null,
    finalStatus: overrides.finalStatus ?? 200,
    finalUrl: overrides.finalUrl ?? overrides.resolvedUrl,
    redirectChain: overrides.redirectChain ?? [],
    checkError: overrides.checkError ?? null,
    ...overrides,
  };
}

export function makeExtractedData(overrides: Partial<ExtractedData> = {}): ExtractedData {
  return {
    url: 'https://example.com/page',
    fetchedAt: new Date().toISOString(),
    metadata: {
      title: 'A Perfectly Reasonable Title',
      metaDescription: 'A meta description that is a healthy, reasonable length for search snippets.',
      og: { title: null, description: null, image: null },
      twitter: { card: null, title: null, description: null, image: null },
      canonical: { href: 'https://example.com/page', isSelfReferential: true },
      robotsMeta: { index: true, follow: true, raw: null },
      viewportPresent: true,
      publishDate: null,
    },
    headings: [{ level: 1, text: 'Main Heading' }],
    images: [],
    schema: { detectedTypes: [], raw: [], parseErrors: [] },
    links: [],
    technical: {
      isHttps: true,
      mixedContentResources: [],
      robotsTxt: { fetched: true, blocksUrl: false },
      sitemap: { fetched: true, present: true, urlListed: true },
      llmsTxt: { present: false },
      consoleErrors: [],
      performance: {
        mobileLoadMs: 2000,
        ttfbMs: 100,
        domContentLoadedMs: 1500,
        loadEventMs: 2000,
        fcpMs: 900,
        lcpMs: 1800,
        cls: 0.02,
      },
      httpStatus: 200,
      pageRedirectChain: [],
      renderMode: { mobileBlocked: false, finalModeIsMobile: true },
    },
    content: {
      authorByline: null,
      hasPersonSchema: false,
      outboundDomains: [],
      structuralElementCount: 0,
      bodyTextLength: 500,
    },
    ...overrides,
  };
}

export const testConfig = config;
