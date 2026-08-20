import type { CheckDefinition } from '../../types.js';

export const contentStructureCheck: CheckDefinition = {
  id: 'geo.content-structure',
  name: 'Structured content format',
  category: 'geo',
  run: ({ extracted, config }) => {
    const count = extracted.content.structuralElementCount;
    const min = config.thresholds.minStructuralElements;
    if (count < min) {
      return {
        checkId: 'geo.content-structure',
        status: 'warn',
        detail: `Page reads as one undifferentiated text block (${count} structural element(s) found; ${min}+ expected) — no genuine lists/tables/short-answer blocks detected.`,
        data: { structuralElementCount: count },
      };
    }
    return {
      checkId: 'geo.content-structure',
      status: 'pass',
      detail: `Page has extractable structure (${count} list/table/blockquote elements found).`,
      data: { structuralElementCount: count },
    };
  },
};
