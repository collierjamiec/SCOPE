import { Router } from 'express';
import type { AppConfig } from '../../config/index.js';
import { getPool } from '../../db/pool.js';
import { getProject } from '../../db/repositories/projects.js';
import { getPage } from '../../db/repositories/pages.js';
import { getCrawl } from '../../db/repositories/crawls.js';
import { getFindingsForCrawl } from '../../db/repositories/findings.js';
import { renderCrawlReport } from '../../report-templates/crawlReport.js';

export function crawlsRouter(config: AppConfig): Router {
  const router = Router();
  const pool = getPool(config);

  router.get('/projects/:projectId/pages/:pageId/crawls/:crawlId', async (req, res) => {
    const projectId = Number(req.params.projectId);
    const pageId = Number(req.params.pageId);
    const crawlId = Number(req.params.crawlId);

    const [project, page, crawl] = await Promise.all([
      getProject(pool, projectId),
      getPage(pool, pageId),
      getCrawl(pool, crawlId),
    ]);
    if (!project || !page || !crawl || page.project_id !== projectId || crawl.page_id !== pageId) {
      res.status(404).send('Crawl not found');
      return;
    }

    const findings = await getFindingsForCrawl(pool, crawlId);
    const rendered = renderCrawlReport({ project, page, crawl, findings, config });
    res.send(String(rendered));
  });

  return router;
}
