import express from 'express';
import type { AppConfig } from '../config/index.js';
import { projectsRouter } from './routes/projects.js';
import { pagesRouter } from './routes/pages.js';
import { crawlsRouter } from './routes/crawls.js';
import { logger } from '../utils/logger.js';

export function startWebServer(config: AppConfig): void {
  const app = express();

  app.use(projectsRouter(config));
  app.use(pagesRouter(config));
  app.use(crawlsRouter(config));

  app.listen(config.webPort, () => {
    logger.info(`Web viewer listening on http://localhost:${config.webPort}`);
  });
}
