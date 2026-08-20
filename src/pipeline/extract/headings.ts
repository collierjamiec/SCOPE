import type { Page } from 'playwright';
import type { ExtractedHeading } from '../types.js';

export async function extractHeadings(page: Page): Promise<ExtractedHeading[]> {
  return page.evaluate(() => {
    // querySelectorAll always returns matches in document order regardless of
    // selector complexity, so combining real h1-h6 with ARIA role="heading"
    // (used by component-based sites that style a <div>/<span> as a heading
    // instead of a semantic tag) still yields one correctly-ordered list.
    const nodes = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]'));
    return nodes.map((el) => {
      const tag = el.tagName.toLowerCase();
      const isSemanticHeading = /^h[1-6]$/.test(tag);
      let level: number;
      if (isSemanticHeading) {
        level = Number(tag.substring(1));
      } else {
        const ariaLevel = el.getAttribute('aria-level');
        // ARIA spec default for role="heading" with no aria-level is 2.
        level = ariaLevel && /^\d+$/.test(ariaLevel) ? Number(ariaLevel) : 2;
      }
      return { level: Math.min(6, Math.max(1, level)) as 1 | 2 | 3 | 4 | 5 | 6, text: el.textContent?.trim() ?? '' };
    });
  });
}
