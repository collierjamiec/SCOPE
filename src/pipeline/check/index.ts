import type { AppConfig } from '../../config/index.js';
import type { ExtractedData, Finding, Stage } from '../types.js';
import type { ProgressReporter } from '../../utils/progress.js';
import { CHECK_REGISTRY } from './registry.js';

export class CheckStage implements Stage<ExtractedData, Finding[]> {
  name = 'check' as const;

  async run(extracted: ExtractedData, config: AppConfig, progress: ProgressReporter): Promise<Finding[]> {
    progress.startStage('check', `Running ${CHECK_REGISTRY.length} checks…`);
    const results: Finding[] = [];

    for (const [index, check] of CHECK_REGISTRY.entries()) {
      progress.update('check', index / CHECK_REGISTRY.length, `Running check: ${check.name}`);
      try {
        const out = check.run({ extracted, config });
        if (out) results.push(...(Array.isArray(out) ? out : [out]));
      } catch (err) {
        // One bad check must not kill the crawl.
        results.push({
          checkId: check.id,
          status: 'fail',
          detail: `Check "${check.name}" errored: ${err instanceof Error ? err.message : 'Unknown error'}`,
        });
      }
    }

    progress.finishStage('check');
    return results;
  }
}
