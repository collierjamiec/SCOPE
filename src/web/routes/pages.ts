import { Router } from 'express';
import type { AppConfig } from '../../config/index.js';
import { getPool } from '../../db/pool.js';
import { getProject } from '../../db/repositories/projects.js';
import { getPage } from '../../db/repositories/pages.js';
import { getPageTrend } from '../../db/queries/trend.js';
import { renderPageTrend } from '../../report-templates/pageTrend.js';

export function pagesRouter(config: AppConfig): Router {
  const router = Router();
  const pool = getPool(config);

  router.get('/projects/:projectId/pages/:pageId', async (req, res) => {
    const projectId = Number(req.params.projectId);
    const pageId = Number(req.params.pageId);

    const [project, page] = await Promise.all([getProject(pool, projectId), getPage(pool, pageId)]);
    if (!project || !page || page.project_id !== projectId) {
      res.status(404).send('Page not found');
      return;
    }

    const trend = await getPageTrend(pool, pageId);
    const rendered = renderPageTrend({
      project,
      page,
      trend,
      crawlUrl: (crawlId) => `/projects/${projectId}/pages/${pageId}/crawls/${crawlId}`,
    });
    res.send(String(rendered));
  });

  return router;
}
