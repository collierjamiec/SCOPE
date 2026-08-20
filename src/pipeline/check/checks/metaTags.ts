import type { CheckDefinition } from '../../types.js';

export const titleLengthCheck: CheckDefinition = {
  id: 'seo.title-length',
  name: 'Title tag length',
  category: 'seo',
  run: ({ extracted, config }) => {
    const title = extracted.metadata.title;
    if (!title) {
      return { checkId: 'seo.title-length', status: 'fail', detail: 'Missing <title> tag.' };
    }
    const { min, max } = config.thresholds.titleLength;
    const len = title.length;
    if (len < min || len > max) {
      return {
        checkId: 'seo.title-length',
        status: 'warn',
        detail: `Title is ${len} chars (recommended ${min}-${max}); likely truncated or too thin in SERPs.`,
        data: { length: len },
      };
    }
    return { checkId: 'seo.title-length', status: 'pass', detail: `Title length ${len} chars is within range.` };
  },
};

export const metaDescriptionCheck: CheckDefinition = {
  id: 'seo.meta-description-length',
  name: 'Meta description length',
  category: 'seo',
  run: ({ extracted, config }) => {
    const desc = extracted.metadata.metaDescription;
    if (!desc) {
      return { checkId: 'seo.meta-description-length', status: 'fail', detail: 'Missing meta description.' };
    }
    const { min, max } = config.thresholds.metaDescriptionLength;
    const len = desc.length;
    if (len < min || len > max) {
      return {
        checkId: 'seo.meta-description-length',
        status: 'warn',
        detail: `Meta description is ${len} chars (recommended ${min}-${max}); likely truncated or too thin in SERPs.`,
        data: { length: len },
      };
    }
    return {
      checkId: 'seo.meta-description-length',
      status: 'pass',
      detail: `Meta description length ${len} chars is within range.`,
    };
  },
};
