#!/usr/bin/env node
import { Command } from 'commander';
import { runAudit } from './commands/audit.js';
import { runServe } from './commands/serve.js';
import { config } from '../config/index.js';
import { runMigrations } from '../db/migrate.js';
import { closePool } from '../db/pool.js';
import { logger } from '../utils/logger.js';

const program = new Command();

program.name('seo-geo-crawler').description('Rule-based SEO/GEO page audit tool').version('1.0.0');

program
  .command('audit')
  .description('Fetch, extract, check, store, and report on a single URL')
  .requiredOption('--url <url>', 'the URL to audit')
  .option('--report-out <path>', 'file path for the rendered HTML report')
  .action(async (opts: { url: string; reportOut?: string }) => {
    try {
      await runAudit({ url: opts.url, reportOut: opts.reportOut });
    } catch (err) {
      logger.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
    // One-shot command: exit explicitly once work is done rather than waiting
    // for Node's event loop to drain — a stray open handle (e.g. an
    // unconsumed fetch response body, see utils/http.ts) can otherwise leave
    // the process alive for a remote server's keep-alive timeout after all
    // output has already been printed.
    process.exit(process.exitCode ?? 0);
  });

program
  .command('migrate')
  .description('Apply any pending database migrations')
  .action(async () => {
    try {
      await runMigrations(config);
      logger.info('Migrations up to date.');
    } catch (err) {
      logger.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    } finally {
      await closePool();
    }
    process.exit(process.exitCode ?? 0);
  });

program
  .command('web')
  .description('Start the local web viewer for stored reports')
  .action(() => {
    runServe();
  });

await program.parseAsync(process.argv);
