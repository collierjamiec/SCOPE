import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import cliProgress from 'cli-progress';
import { config } from '../../config/index.js';
import { FetchRenderStage } from '../../pipeline/fetchRender/index.js';
import { ExtractStage } from '../../pipeline/extract/index.js';
import { CheckStage } from '../../pipeline/check/index.js';
import { StoreStage } from '../../pipeline/store/index.js';
import { ReportStage } from '../../pipeline/report/index.js';
import { ProgressReporter } from '../../utils/progress.js';
import { logger } from '../../utils/logger.js';
import { closePool } from '../../db/pool.js';
import { buildReportFilename } from '../../utils/reportFilename.js';

export interface AuditOptions {
  url: string;
  reportOut?: string;
}

export async function runAudit(options: AuditOptions): Promise<void> {
  new URL(options.url); // throws with a clear message if not a valid absolute URL

  const bar = new cliProgress.SingleBar(
    { format: '[{bar}] {percentage}% | {message}', hideCursor: true, clearOnComplete: false },
    cliProgress.Presets.shades_classic,
  );
  bar.start(100, 0, { message: 'Starting…' });

  const progress = new ProgressReporter();
  progress.on('progress', ({ percent, message }) => bar.update(percent, { message }));

  try {
    const fetchRender = new FetchRenderStage();
    const extract = new ExtractStage();
    const check = new CheckStage();
    const store = new StoreStage();
    const report = new ReportStage();

    const fetched = await fetchRender.run(options.url, config, progress);
    const extracted = await extract.run(fetched, config, progress);
    const findings = await check.run(extracted, config, progress);
    const stored = await store.run({ extracted, findings }, config, progress);
    const rendered = await report.run(stored, config, progress);

    progress.done('Audit complete.');
    bar.update(100, { message: 'Audit complete.' });
    bar.stop();

    const outPath =
      options.reportOut ?? path.join('reports', buildReportFilename(options.url, new Date(), stored.crawlId));
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, String(rendered), 'utf8');

    const passCount = findings.filter((f) => f.status === 'pass').length;
    const warnCount = findings.filter((f) => f.status === 'warn').length;
    const failCount = findings.filter((f) => f.status === 'fail').length;

    logger.info('');
    logger.info(`Audit summary for ${options.url}`);
    logger.info(`  pass: ${passCount}  warn: ${warnCount}  fail: ${failCount}`);
    logger.info(`  report written to: ${outPath}`);
    logger.info(`  project id: ${stored.projectId}  page id: ${stored.pageId}  crawl id: ${stored.crawlId}`);
  } catch (err) {
    bar.stop();
    throw err;
  } finally {
    await closePool();
  }
}
