import type { CheckDefinition, Finding } from '../../types.js';
import type { ExtractedLink } from '../../types.js';

/**
 * The text a screen reader/crawler would treat as this link's accessible name:
 * real anchor text if present, otherwise the alt text of a wrapped image (an
 * image-only link, e.g. a logo linking home, is legitimate — its alt text is
 * the effective anchor text, not a missing one).
 */
function effectiveAnchorText(link: ExtractedLink): string {
  if (link.anchorText.trim()) return link.anchorText.trim();
  if (link.hasImageContent && link.imageAlt?.trim()) return link.imageAlt.trim();
  return '';
}

export const anchorTextCheck: CheckDefinition = {
  id: 'seo.generic-anchor-text',
  name: 'Generic or missing internal link anchor text',
  category: 'seo',
  run: ({ extracted, config }) => {
    const generic = config.thresholds.genericAnchorTextPhrases;
    const findings: Finding[] = [];

    for (const link of extracted.links) {
      if (!link.isInternal) continue;
      const effective = effectiveAnchorText(link);

      if (!effective) {
        findings.push({
          checkId: 'seo.generic-anchor-text',
          status: 'warn',
          detail: link.hasImageContent
            ? `Internal link to ${link.resolvedUrl} is an image link with no alt text — it has no accessible name for screen readers or search engines. Element: <a href="${link.href}"><img alt=""></a>`
            : `Internal link to ${link.resolvedUrl} has no anchor text (likely an icon-only link or JS-driven control) — it has no accessible name. Element: <a href="${link.href}"></a>`,
          data: { url: link.resolvedUrl, href: link.href, hasImageContent: link.hasImageContent },
        });
        continue;
      }

      if (generic.includes(effective.toLowerCase())) {
        findings.push({
          checkId: 'seo.generic-anchor-text',
          status: 'warn',
          detail: `Internal link to ${link.resolvedUrl} uses generic anchor text "${effective}".`,
          data: { url: link.resolvedUrl, anchorText: effective },
        });
      }
    }

    if (findings.length === 0) {
      return {
        checkId: 'seo.generic-anchor-text',
        status: 'pass',
        detail: 'No generic or missing anchor text found on internal links.',
      };
    }
    return findings;
  },
};
