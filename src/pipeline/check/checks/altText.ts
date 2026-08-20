import type { CheckDefinition, Finding } from '../../types.js';

function isGeneric(alt: string, genericValues: readonly string[]): boolean {
  const normalized = alt.trim().toLowerCase();
  if (genericValues.includes(normalized)) return true;
  // filename-as-alt, e.g. "img_1234.jpg" or "hero-banner.png"
  return /\.(jpe?g|png|gif|webp|svg|avif)$/i.test(normalized);
}

export const altTextCheck: CheckDefinition = {
  id: 'seo.alt-text',
  name: 'Image alt text',
  category: 'accessibility',
  run: ({ extracted, config }) => {
    if (extracted.images.length === 0) {
      return { checkId: 'seo.alt-text', status: 'pass', detail: 'No images found on the page.' };
    }

    const findings: Finding[] = [];
    for (const image of extracted.images) {
      const alt = image.alt;
      if (alt === null) {
        findings.push({
          checkId: 'seo.alt-text',
          status: 'fail',
          detail: `Image missing alt attribute entirely: ${image.src}`,
          data: { src: image.src },
        });
      } else if (isGeneric(alt, config.thresholds.genericAltTextValues)) {
        findings.push({
          checkId: 'seo.alt-text',
          status: 'warn',
          detail: `Image has empty or generic/boilerplate alt text ("${alt}"): ${image.src}`,
          data: { src: image.src, alt },
        });
      }
    }

    if (findings.length === 0) {
      return {
        checkId: 'seo.alt-text',
        status: 'pass',
        detail: `All ${extracted.images.length} image(s) have meaningful alt text.`,
      };
    }
    return findings;
  },
};
