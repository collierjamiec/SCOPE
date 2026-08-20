import type { CheckDefinition, Finding } from '../../types.js';

export const indexabilityCheck: CheckDefinition = {
  id: 'seo.indexability',
  name: 'Indexability',
  category: 'seo',
  run: ({ extracted }) => {
    const reasons: string[] = [];

    if (!extracted.metadata.robotsMeta.index) {
      reasons.push('meta robots tag sets noindex');
    }
    if (extracted.metadata.canonical.isSelfReferential === false) {
      reasons.push('canonical tag points away from this URL');
    }
    if (extracted.technical.robotsTxt.blocksUrl) {
      reasons.push('robots.txt disallows this URL');
    }

    if (reasons.length > 0) {
      const finding: Finding = {
        checkId: 'seo.indexability',
        status: 'fail',
        detail: `Page may not be indexable: ${reasons.join('; ')}.`,
        data: { reasons },
      };
      return finding;
    }
    return { checkId: 'seo.indexability', status: 'pass', detail: 'No indexability blockers detected.' };
  },
};
