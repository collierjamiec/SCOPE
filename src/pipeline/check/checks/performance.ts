import type { CheckDefinition } from '../../types.js';

export const performanceCheck: CheckDefinition = {
  id: 'performance.mobile-load-speed',
  name: 'Mobile load speed',
  category: 'performance',
  run: ({ extracted, config }) => {
    const ms = extracted.technical.performance.mobileLoadMs;
    const budget = config.thresholds.mobileLoadBudgetMs;
    if (ms > budget) {
      return {
        checkId: 'performance.mobile-load-speed',
        status: 'fail',
        detail: `Mobile load took ${ms}ms under throttled conditions, exceeding the ${budget}ms budget.`,
        data: { mobileLoadMs: ms, budgetMs: budget },
      };
    }
    return {
      checkId: 'performance.mobile-load-speed',
      status: 'pass',
      detail: `Mobile load took ${ms}ms under throttled conditions, within the ${budget}ms budget.`,
      data: { mobileLoadMs: ms, budgetMs: budget },
    };
  },
};
