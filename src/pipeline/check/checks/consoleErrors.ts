import type { CheckDefinition } from '../../types.js';

export const consoleErrorsCheck: CheckDefinition = {
  id: 'technical.console-errors',
  name: 'JavaScript console errors',
  category: 'technical',
  run: ({ extracted }) => {
    const errors = extracted.technical.consoleErrors.filter(
      (e) => e.type === 'error' || e.type === 'pageerror',
    );
    if (errors.length === 0) {
      return { checkId: 'technical.console-errors', status: 'pass', detail: 'No JavaScript console errors on load.' };
    }
    const preview = errors.slice(0, 5).map((e) => e.text).join(' | ');
    return {
      checkId: 'technical.console-errors',
      status: 'fail',
      detail: `${errors.length} JavaScript console error(s) on load: ${preview}${errors.length > 5 ? '…' : ''}`,
      data: { count: errors.length, errors: errors.slice(0, 20) },
    };
  },
};
