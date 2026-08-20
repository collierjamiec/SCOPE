import type { CheckDefinition, Finding } from '../../types.js';

/**
 * Explicit width/height attributes let the browser reserve layout space before
 * an image loads, which is what actually prevents Cumulative Layout Shift —
 * best practice per Lighthouse and modern SEO/performance guidance alike.
 */
export const imageDimensionsCheck: CheckDefinition = {
  id: 'performance.image-dimensions',
  name: 'Explicit image dimensions',
  category: 'performance',
  run: ({ extracted }) => {
    const findings: Finding[] = [];

    for (const image of extracted.images) {
      if (image.format === 'svg') continue; // SVGs commonly scale via viewBox/CSS without fixed attrs
      if (image.width === null || image.height === null) {
        findings.push({
          checkId: 'performance.image-dimensions',
          status: 'warn',
          detail: `Image is missing explicit width/height attributes, which can cause layout shift while it loads: ${image.src}`,
          data: { src: image.src },
        });
      }
    }

    if (findings.length === 0) {
      return {
        checkId: 'performance.image-dimensions',
        status: 'pass',
        detail:
          extracted.images.length > 0
            ? `All ${extracted.images.length} image(s) specify explicit width/height.`
            : 'No images found on the page.',
      };
    }
    return findings;
  },
};
