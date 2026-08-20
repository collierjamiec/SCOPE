import { describe, it, expect } from 'vitest';
import { titleLengthCheck } from '../src/pipeline/check/checks/metaTags.js';
import { altTextCheck } from '../src/pipeline/check/checks/altText.js';
import { imageFormatCheck } from '../src/pipeline/check/checks/imageFormat.js';
import { imageFilenameCheck } from '../src/pipeline/check/checks/imageFilename.js';
import { headingStructureCheck } from '../src/pipeline/check/checks/headingStructure.js';
import { schemaPresenceCheck } from '../src/pipeline/check/checks/schemaPresence.js';
import { indexabilityCheck } from '../src/pipeline/check/checks/indexability.js';
import { blockedPageCheck } from '../src/pipeline/check/checks/blockedPage.js';
import { mobileEmulationFallbackCheck } from '../src/pipeline/check/checks/mobileEmulationFallback.js';
import { authorshipCheck } from '../src/pipeline/check/checks/authorship.js';
import { anchorTextCheck } from '../src/pipeline/check/checks/anchorText.js';
import { imageDimensionsCheck } from '../src/pipeline/check/checks/imageDimensions.js';
import { makeExtractedData, makeImage, makeLink, testConfig } from './fixtures.js';
import type { Finding } from '../src/pipeline/types.js';

function asArray(result: Finding | Finding[] | null): Finding[] {
  if (!result) return [];
  return Array.isArray(result) ? result : [result];
}

describe('titleLengthCheck', () => {
  it('passes for a title within range', () => {
    const extracted = makeExtractedData();
    const result = titleLengthCheck.run({ extracted, config: testConfig });
    expect(asArray(result)[0]?.status).toBe('pass');
  });

  it('fails when the title is missing', () => {
    const extracted = makeExtractedData({ metadata: { ...makeExtractedData().metadata, title: null } });
    const result = titleLengthCheck.run({ extracted, config: testConfig });
    expect(asArray(result)[0]?.status).toBe('fail');
  });

  it('warns when the title is too short', () => {
    const extracted = makeExtractedData({ metadata: { ...makeExtractedData().metadata, title: 'Short' } });
    const result = titleLengthCheck.run({ extracted, config: testConfig });
    expect(asArray(result)[0]?.status).toBe('warn');
  });
});

describe('altTextCheck', () => {
  it('flags missing and generic alt text but not good alt text', () => {
    const extracted = makeExtractedData({
      images: [
        makeImage({ src: 'hero.jpg', alt: null }),
        makeImage({ src: 'chart.png', alt: 'image' }),
        makeImage({ src: 'diagram.png', alt: 'Quarterly revenue growth by region' }),
      ],
    });
    const findings = asArray(altTextCheck.run({ extracted, config: testConfig }));
    expect(findings).toHaveLength(2);
    expect(findings[0]?.status).toBe('fail');
    expect(findings[1]?.status).toBe('warn');
  });

  it('passes when there are no images', () => {
    const extracted = makeExtractedData({ images: [] });
    const findings = asArray(altTextCheck.run({ extracted, config: testConfig }));
    expect(findings[0]?.status).toBe('pass');
  });
});

describe('imageFormatCheck', () => {
  it('warns on legacy raster formats but passes next-gen ones', () => {
    const extracted = makeExtractedData({
      images: [
        makeImage({ src: 'hero.jpg', format: 'jpeg' }),
        makeImage({ src: 'icon.png', format: 'png' }),
        makeImage({ src: 'banner.webp', format: 'webp' }),
      ],
    });
    const findings = asArray(imageFormatCheck.run({ extracted, config: testConfig }));
    expect(findings).toHaveLength(2);
    expect(findings.every((f) => f.status === 'warn')).toBe(true);
    expect(findings.map((f) => f.data?.format)).toEqual(['jpeg', 'png']);
  });

  it('ignores SVGs and images with an undetermined format', () => {
    const extracted = makeExtractedData({
      images: [makeImage({ src: 'logo.svg', format: 'svg' }), makeImage({ src: 'data:...', format: null })],
    });
    const findings = asArray(imageFormatCheck.run({ extracted, config: testConfig }));
    expect(findings[0]?.status).toBe('pass');
  });

  it('passes when all raster images are already next-gen', () => {
    const extracted = makeExtractedData({ images: [makeImage({ src: 'a.avif', format: 'avif' })] });
    const findings = asArray(imageFormatCheck.run({ extracted, config: testConfig }));
    expect(findings[0]?.status).toBe('pass');
  });
});

describe('imageFilenameCheck', () => {
  it('flags a hash-like filename but not a descriptive one', () => {
    const extracted = makeExtractedData({
      images: [
        makeImage({ src: 'https://example.com/media/asdifojasidng.webp', format: 'webp' }),
        makeImage({ src: 'https://example.com/media/red-running-shoes.webp', format: 'webp' }),
      ],
    });
    const findings = asArray(imageFilenameCheck.run({ extracted, config: testConfig }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.status).toBe('warn');
    expect(findings[0]?.data?.filename).toBe('asdifojasidng.webp');
  });

  it('flags UUID and hex-hash filenames', () => {
    const extracted = makeExtractedData({
      images: [
        makeImage({ src: 'https://example.com/media/a1b2c3d4-e5f6-7890-abcd-ef1234567890.png', format: 'png' }),
        makeImage({ src: 'https://example.com/media/9f86d081884c7d659a2feaa0c55ad015.png', format: 'png' }),
      ],
    });
    const findings = asArray(imageFilenameCheck.run({ extracted, config: testConfig }));
    expect(findings).toHaveLength(2);
  });

  it('passes when there are no images', () => {
    const extracted = makeExtractedData({ images: [] });
    const findings = asArray(imageFilenameCheck.run({ extracted, config: testConfig }));
    expect(findings[0]?.status).toBe('pass');
  });
});

describe('headingStructureCheck', () => {
  it('fails when there is no H1', () => {
    const extracted = makeExtractedData({ headings: [{ level: 2, text: 'Subheading' }] });
    const findings = asArray(headingStructureCheck.run({ extracted, config: testConfig }));
    const h1Finding = findings.find((f) => f.checkId === 'seo.h1-presence');
    expect(h1Finding?.status).toBe('fail');
  });

  it('warns when heading levels skip', () => {
    const extracted = makeExtractedData({
      headings: [
        { level: 1, text: 'Title' },
        { level: 3, text: 'Skipped to H3' },
      ],
    });
    const findings = asArray(headingStructureCheck.run({ extracted, config: testConfig }));
    const nestingFinding = findings.find((f) => f.checkId === 'seo.heading-nesting');
    expect(nestingFinding?.status).toBe('warn');
  });
});

describe('schemaPresenceCheck', () => {
  it('maps the schema checklist to pass/info per configured type', () => {
    const extracted = makeExtractedData({
      schema: { detectedTypes: ['FAQPage'], raw: [], parseErrors: [] },
    });
    const findings = asArray(schemaPresenceCheck.run({ extracted, config: testConfig }));
    const faq = findings.find((f) => f.checkId === 'geo.schema-faqpage');
    const review = findings.find((f) => f.checkId === 'geo.schema-review');
    expect(faq?.status).toBe('pass');
    // info, not warn: not every page needs every schema type on the checklist
    expect(review?.status).toBe('info');
  });
});

describe('indexabilityCheck', () => {
  it('passes with no blockers', () => {
    const extracted = makeExtractedData();
    const result = indexabilityCheck.run({ extracted, config: testConfig });
    expect(asArray(result)[0]?.status).toBe('pass');
  });

  it('fails when robots.txt blocks the URL', () => {
    const base = makeExtractedData();
    const extracted = makeExtractedData({
      technical: { ...base.technical, robotsTxt: { fetched: true, blocksUrl: true } },
    });
    const result = indexabilityCheck.run({ extracted, config: testConfig });
    expect(asArray(result)[0]?.status).toBe('fail');
  });
});

describe('blockedPageCheck', () => {
  it('fails on a Cloudflare-style challenge page (403 + telltale title + thin body)', () => {
    const base = makeExtractedData();
    const extracted = makeExtractedData({
      metadata: { ...base.metadata, title: 'Checking your browser...', metaDescription: null },
      headings: [{ level: 1, text: 'Checking your browser before accessing example.com' }],
      images: [],
      content: { ...base.content, bodyTextLength: 58 },
      technical: { ...base.technical, httpStatus: 403 },
    });
    const result = blockedPageCheck.run({ extracted, config: testConfig });
    expect(asArray(result)[0]?.status).toBe('fail');
  });

  it('warns when only the title looks like a challenge page but status is normal', () => {
    const base = makeExtractedData();
    const extracted = makeExtractedData({
      metadata: { ...base.metadata, title: 'Just a moment...' },
      technical: { ...base.technical, httpStatus: 200 },
    });
    const result = blockedPageCheck.run({ extracted, config: testConfig });
    expect(asArray(result)[0]?.status).toBe('warn');
  });

  it('passes a normal page', () => {
    const extracted = makeExtractedData();
    const result = blockedPageCheck.run({ extracted, config: testConfig });
    expect(asArray(result)[0]?.status).toBe('pass');
  });

  it('fails on a thin page with a blocked-range status even without a telltale title', () => {
    // documents that the heuristic doesn't require a matching title — a 403/429/503
    // status combined with a near-empty page (no headings/images, <200 chars of text)
    // is enough on its own, since that shape is itself unusual for a real page.
    const base = makeExtractedData();
    const extracted = makeExtractedData({
      headings: [],
      images: [],
      content: { ...base.content, bodyTextLength: 50 },
      technical: { ...base.technical, httpStatus: 403 },
    });
    const result = blockedPageCheck.run({ extracted, config: testConfig });
    expect(asArray(result)[0]?.status).toBe('fail');
  });

  it('does not fail on a normal page that merely happens to return 403', () => {
    const base = makeExtractedData();
    const extracted = makeExtractedData({
      technical: { ...base.technical, httpStatus: 403 },
    });
    const result = blockedPageCheck.run({ extracted, config: testConfig });
    expect(asArray(result)[0]?.status).toBe('pass');
  });
});

describe('mobileEmulationFallbackCheck', () => {
  it('warns when mobile was blocked and the crawl fell back to desktop', () => {
    const base = makeExtractedData();
    const extracted = makeExtractedData({
      technical: { ...base.technical, renderMode: { mobileBlocked: true, finalModeIsMobile: false } },
    });
    const result = mobileEmulationFallbackCheck.run({ extracted, config: testConfig });
    expect(asArray(result)[0]?.status).toBe('warn');
  });

  it('passes when the mobile crawl succeeded normally', () => {
    const extracted = makeExtractedData();
    const result = mobileEmulationFallbackCheck.run({ extracted, config: testConfig });
    expect(asArray(result)[0]?.status).toBe('pass');
  });
});

describe('authorshipCheck', () => {
  it('fails when there is no byline, no Person schema, and no entity-establishing schema', () => {
    const extracted = makeExtractedData();
    const result = authorshipCheck.run({ extracted, config: testConfig });
    expect(asArray(result)[0]?.status).toBe('fail');
  });

  it('downgrades to info when Organization schema establishes the page entity', () => {
    const extracted = makeExtractedData({
      schema: { detectedTypes: ['Organization'], raw: [], parseErrors: [] },
    });
    const result = authorshipCheck.run({ extracted, config: testConfig });
    expect(asArray(result)[0]?.status).toBe('info');
  });

  it('passes when byline and Person schema are both present', () => {
    const base = makeExtractedData();
    const extracted = makeExtractedData({
      content: { ...base.content, authorByline: 'Jane Doe', hasPersonSchema: true },
    });
    const result = authorshipCheck.run({ extracted, config: testConfig });
    expect(asArray(result)[0]?.status).toBe('pass');
  });
});

describe('anchorTextCheck', () => {
  it('flags an internal link with no text and no image', () => {
    const extracted = makeExtractedData({
      links: [makeLink({ resolvedUrl: 'https://example.com/page/target', anchorText: '' })],
    });
    const findings = asArray(anchorTextCheck.run({ extracted, config: testConfig }));
    expect(findings[0]?.status).toBe('warn');
    expect(findings[0]?.detail).toMatch(/no anchor text/);
  });

  it('flags an image-only internal link with no alt text', () => {
    const extracted = makeExtractedData({
      links: [
        makeLink({
          resolvedUrl: 'https://example.com/',
          anchorText: '',
          hasImageContent: true,
          imageAlt: null,
        }),
      ],
    });
    const findings = asArray(anchorTextCheck.run({ extracted, config: testConfig }));
    expect(findings[0]?.status).toBe('warn');
    expect(findings[0]?.detail).toMatch(/image link with no alt text/);
  });

  it('does not flag an image-only internal link that has descriptive alt text', () => {
    const extracted = makeExtractedData({
      links: [
        makeLink({
          resolvedUrl: 'https://example.com/',
          anchorText: '',
          hasImageContent: true,
          imageAlt: 'Example Co. logo — home',
        }),
      ],
    });
    const findings = asArray(anchorTextCheck.run({ extracted, config: testConfig }));
    expect(findings[0]?.status).toBe('pass');
  });

  it('flags generic anchor text phrases', () => {
    const extracted = makeExtractedData({
      links: [makeLink({ resolvedUrl: 'https://example.com/page/target', anchorText: 'Click here' })],
    });
    const findings = asArray(anchorTextCheck.run({ extracted, config: testConfig }));
    expect(findings[0]?.status).toBe('warn');
  });

  it('ignores external links', () => {
    const extracted = makeExtractedData({
      links: [makeLink({ resolvedUrl: 'https://other-site.com/', anchorText: '', isInternal: false })],
    });
    const findings = asArray(anchorTextCheck.run({ extracted, config: testConfig }));
    expect(findings[0]?.status).toBe('pass');
  });
});

describe('imageDimensionsCheck', () => {
  it('flags images missing explicit width/height', () => {
    const extracted = makeExtractedData({
      images: [makeImage({ src: 'hero.jpg', format: 'jpeg', width: null, height: null })],
    });
    const findings = asArray(imageDimensionsCheck.run({ extracted, config: testConfig }));
    expect(findings[0]?.status).toBe('warn');
  });

  it('passes images with explicit width/height', () => {
    const extracted = makeExtractedData({
      images: [makeImage({ src: 'hero.jpg', format: 'jpeg', width: 800, height: 600 })],
    });
    const findings = asArray(imageDimensionsCheck.run({ extracted, config: testConfig }));
    expect(findings[0]?.status).toBe('pass');
  });

  it('does not flag SVGs missing width/height', () => {
    const extracted = makeExtractedData({
      images: [makeImage({ src: 'logo.svg', format: 'svg', width: null, height: null })],
    });
    const findings = asArray(imageDimensionsCheck.run({ extracted, config: testConfig }));
    expect(findings[0]?.status).toBe('pass');
  });
});
