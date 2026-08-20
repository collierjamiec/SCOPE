import { Router } from 'express';
import type { AppConfig } from '../../config/index.js';
import { getPool } from '../../db/pool.js';
import { listProjects, getProject } from '../../db/repositories/projects.js';
import { getProjectRollup } from '../../db/queries/rollup.js';
import { renderProjectList } from '../../report-templates/projectList.js';
import { renderProjectRollup } from '../../report-templates/projectRollup.js';

export function projectsRouter(config: AppConfig): Router {
  const router = Router();
  const pool = getPool(config);

  router.get('/', async (_req, res) => {
    const projects = await listProjects(pool);
    const rendered = renderProjectList({ projects, projectUrl: (id) => `/projects/${id}` });
    res.send(String(rendered));
  });

  router.get('/projects/:projectId', async (req, res) => {
    const projectId = Number(req.params.projectId);
    const project = await getProject(pool, projectId);
    if (!project) {
      res.status(404).send('Project not found');
      return;
    }
    const rollup = await getProjectRollup(pool, projectId, config);
    const rendered = renderProjectRollup({
      project,
      rollup,
      pageUrl: (pageId) => `/projects/${projectId}/pages/${pageId}`,
    });
    res.send(String(rendered));
  });

  return router;
}
