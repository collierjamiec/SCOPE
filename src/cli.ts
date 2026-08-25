#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { crawlSite } from './crawler.js';
import { auditDocumentFilename, createAuditDocument } from './document.js';
import { imagesCsv, keywordsCsv, linksCsv, pagesCsv, technicalCsv } from './report.js';
import type { AuditConfig, SerpConfig } from './types.js';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
function flag(name: string): boolean { return process.argv.includes(`--${name}`); }

async function main() {
  if (flag('help') || process.argv.length === 2) {
    console.log(`Usage: npm run dev -- --url https://example.com [options]

Options:
  --max-pages N       Optional page limit; omitted or "all" crawls the whole site
  --max-keywords N    Domain keyword candidates, default 100, maximum 5000
  --max-rankings N    Licensed SERP checks, default 100, maximum 100
  --exclude PATHS     Comma-separated path prefixes to omit, e.g. /blog,/careers
  --out DIRECTORY     Output directory, default ./audit-output
  --pagespeed         Request mobile PageSpeed Insights data
  --no-images         Skip image optimization analysis
  --no-broken-links   Skip broken internal-link reporting
  --no-schema         Skip detected and suggested schema analysis
  --render-js         Render JavaScript-driven content with Playwright
  --non-interactive   Do not ask about licensed SERP API access

SERP credentials can be supplied interactively or with SERP_ENDPOINT and
SERP_API_KEY. The endpoint adapter contract is documented in README.md.`);
    return;
  }
  const startUrl = option('url');
  if (!startUrl) throw new Error('--url is required.');
  let serp: SerpConfig | undefined;
  const envEndpoint = process.env.SERP_ENDPOINT;
  const envKey = process.env.SERP_API_KEY;
  if (envEndpoint && envKey) {
    serp = { endpoint: envEndpoint, apiKey: envKey, country: process.env.SERP_COUNTRY, language: process.env.SERP_LANGUAGE, device: process.env.SERP_DEVICE === 'mobile' ? 'mobile' : 'desktop' };
  } else if (!flag('non-interactive') && process.stdin.isTTY) {
    const rl = createInterface({ input, output });
    const answer = (await rl.question('Do you have a licensed SERP API endpoint to check organic rankings? [y/N] ')).trim().toLowerCase();
    if (answer === 'y' || answer === 'yes') {
      const endpoint = (await rl.question('Provider adapter endpoint: ')).trim();
      const apiKey = (await rl.question('API key: ')).trim();
      if (endpoint && apiKey) serp = { endpoint, apiKey };
    }
    rl.close();
  }
  if (!serp) console.log('No SERP provider configured; rankings will be reported as unavailable.');
  const maxPagesOption = option('max-pages');
  const excludePaths = (option('exclude') ?? '').split(',').map(value => value.trim()).filter(Boolean);
  const config: AuditConfig = {
    startUrl, maxPages: !maxPagesOption || maxPagesOption.toLowerCase() === 'all' ? null : Number(maxPagesOption), maxKeywords: Number(option('max-keywords') ?? 100), maxRankings: Number(option('max-rankings') ?? 100),
    concurrency: 1, delayMs: Number(option('delay-ms') ?? 25), userAgent: 'OrganicSiteAuditor/0.1 (+respectful SEO audit)',
    pageSpeed: flag('pagespeed'), pageSpeedApiKey: process.env.PAGESPEED_API_KEY, serp,
    imageAnalysis: process.env.IMAGE_ANALYSIS_ENDPOINT && process.env.IMAGE_ANALYSIS_API_KEY ? { endpoint: process.env.IMAGE_ANALYSIS_ENDPOINT, apiKey: process.env.IMAGE_ANALYSIS_API_KEY } : undefined,
    excludePaths, analyzeImages: !flag('no-images'), reportBrokenLinks: !flag('no-broken-links'), analyzeSchema: !flag('no-schema'), renderJavaScript: flag('render-js')
  };
  console.log(`Crawling ${startUrl} (${config.maxPages === null ? 'all discoverable pages' : `maximum ${config.maxPages} pages`})...`);
  const report = await crawlSite(config, progress => console.log(`[${progress.phase}] ${progress.message} — ${progress.fetched} fetched, ${progress.analyzed} analyzed, ${progress.queued} queued`));
  const outputRoot = option('out') ?? 'audit-output';
  const safeDomain = report.domain.replace(/[^a-z0-9.-]+/gi, '_');
  const directory = `${outputRoot}/${safeDomain}`;
  await mkdir(directory, { recursive: true });
  const documentName = auditDocumentFilename(new Date(report.generatedAt));
  const documentBuffer = await createAuditDocument(report);
  await Promise.all([
    writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2)),
    writeFile(`${directory}/pages.csv`, pagesCsv(report)),
    writeFile(`${directory}/keywords.csv`, keywordsCsv(report)),
    writeFile(`${directory}/links.csv`, linksCsv(report)),
    writeFile(`${directory}/images.csv`, imagesCsv(report)),
    writeFile(`${directory}/technical.csv`, technicalCsv(report)),
    writeFile(`${directory}/${documentName}`, documentBuffer)
  ]);
  console.log(`Analyzed ${report.summary.indexablePagesAnalyzed} indexable pages; excluded ${report.summary.excludedNonIndexable}.`);
  console.log(`Identified ${report.summary.keywordsIdentified} keyword candidates and ${report.cannibalization.length} cannibalization flags.`);
  console.log(`Reports written to ${directory}/`);
  console.log(`Document: ${directory}/${documentName}`);
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
