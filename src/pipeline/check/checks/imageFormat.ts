import type { CheckDefinition, Finding } from '../../types.js';

export const imageFormatCheck: CheckDefinition = {
  id: 'performance.image-next-gen-format',
  name: 'Next-gen image formats',
  category: 'performance',
  run: ({ extracted }) => {
    const findings: Finding[] = [];
    let checked = 0;

    for (const image of extracted.images) {
      // SVG is vector, not a "next-gen raster format" concern; null means undetermined
      // (e.g. a data: URI with no matching response) and isn't held against the page.
      if (image.format === null || image.format === 'svg') continue;
      checked += 1;

      if (!image.isNextGenFormat) {
        findings.push({
          checkId: 'performance.image-next-gen-format',
          status: 'warn',
          detail: `Image is served as ${image.format.toUpperCase()}, not a next-gen format (WebP/AVIF): ${image.src}`,
          data: { src: image.src, format: image.format },
        });
      }
    }

    if (findings.length === 0) {
      return {
        checkId: 'performance.image-next-gen-format',
        status: 'pass',
        detail:
          checked > 0
            ? `All ${checked} raster image(s) already use next-gen formats (WebP/AVIF).`
            : 'No raster images with a determinable format to check.',
      };
    }
    return findings;
  },
};
