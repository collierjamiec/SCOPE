import type { CheckDefinition } from '../../types.js';

export const canonicalCheck: CheckDefinition = {
  id: 'seo.canonical',
  name: 'Canonical tag',
  category: 'seo',
  run: ({ extracted }) => {
    const { href, isSelfReferential } = extracted.metadata.canonical;
    if (!href) {
      return { checkId: 'seo.canonical', status: 'warn', detail: 'No canonical tag present.' };
    }
    if (isSelfReferential === false) {
      return {
        checkId: 'seo.canonical',
        status: 'warn',
        detail: `Canonical tag points away from this page (${extracted.url}) to: ${href}`,
        data: { href, pageUrl: extracted.url },
      };
    }
    return { checkId: 'seo.canonical', status: 'pass', detail: 'Canonical tag present and self-referential.' };
  },
};
