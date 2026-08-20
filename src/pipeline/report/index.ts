import type { AppConfig } from '../../config/index.js';
import type { Stage } from '../types.js';
import type { ProgressReporter } from '../../utils/progress.js';
import type { StoreResult } from '../store/index.js';
import type { Html } from '../../report-templates/html.js';
import { getPool } from '../../db/pool.js';
import { getProject } from '../../db/repositories/projects.js';
import { getPage } from '../../db/repositories/pages.js';
import { getCrawl } from '../../db/repositories/crawls.js';
import { getFindingsForCrawl } from '../../db/repositories/findings.js';
import { renderCrawlReport } from '../../report-templates/crawlReport.js';

/**
 * Read-only: always re-queries storage rather than reusing the in-memory crawl
 * result, so a report is provably reproducible from stored data alone — the
 * same code path a historical/regenerated report or the web viewer uses.
 */
export class ReportStage implements Stage<StoreResult, Html> {
  name = 'report' as const;

  async run({ projectId, pageId, crawlId }: StoreResult, config: AppConfig, progress: ProgressReporter): Promise<Html> {
    progress.startStage('report', 'Reading crawl back from storage…');
    const pool = getPool(config);

    const [project, page, crawl, findings] = await Promise.all([
      getProject(pool, projectId),
      getPage(pool, pageId),
      getCrawl(pool, crawlId),
      getFindingsForCrawl(pool, crawlId),
    ]);

    if (!project || !page || !crawl) {
      throw new Error(`Could not re-read stored crawl ${crawlId} for reporting.`);
    }

    progress.update('report', 0.7, 'Rendering HTML report…');
    const rendered = renderCrawlReport({ project, page, crawl, findings, config });
    progress.finishStage('report');
    return rendered;
  }
}
