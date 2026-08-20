import type { AppConfig } from '../../config/index.js';
import type { CrawlResult, Stage } from '../types.js';
import type { ProgressReporter } from '../../utils/progress.js';
import { getPool } from '../../db/pool.js';
import { findOrCreateProjectByDomain } from '../../db/repositories/projects.js';
import { findOrCreatePage } from '../../db/repositories/pages.js';
import { insertCrawl } from '../../db/repositories/crawls.js';
import { insertFindings } from '../../db/repositories/findings.js';
import { getDomain } from '../../utils/url.js';

export interface StoreResult {
  projectId: number;
  pageId: number;
  crawlId: number;
}

export class StoreStage implements Stage<CrawlResult, StoreResult> {
  name = 'store' as const;

  async run({ extracted, findings }: CrawlResult, config: AppConfig, progress: ProgressReporter): Promise<StoreResult> {
    progress.startStage('store', 'Writing crawl to database…');
    const pool = getPool(config);
    const domain = getDomain(extracted.url);

    const projectId = await findOrCreateProjectByDomain(pool, domain);
    const pageId = await findOrCreatePage(pool, projectId, extracted.url);
    const crawlId = await insertCrawl(pool, pageId, extracted, findings);
    await insertFindings(pool, crawlId, findings);

    progress.finishStage('store');
    return { projectId, pageId, crawlId };
  }
}
