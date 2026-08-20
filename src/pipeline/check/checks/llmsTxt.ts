import type { CheckDefinition } from '../../types.js';

export const llmsTxtCheck: CheckDefinition = {
  id: 'geo.llms-txt',
  name: 'llms.txt presence',
  category: 'geo',
  run: ({ extracted }) => {
    if (extracted.technical.llmsTxt.present) {
      return { checkId: 'geo.llms-txt', status: 'pass', detail: 'llms.txt found at domain root.' };
    }
    return { checkId: 'geo.llms-txt', status: 'warn', detail: 'llms.txt not found at domain root.' };
  },
};
