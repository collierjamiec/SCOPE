import type { Pool } from 'mysql2/promise';
import type { AppConfig } from '../../config/index.js';
import { getLatestCrawlsForProject, type CrawlRow } from '../repositories/crawls.js';
import { getFindingsForCrawls, countFindingsByCheck } from '../repositories/findings.js';
import { getPage, type PageRow } from '../repositories/pages.js';

export interface SchemaGap {
  type: string;
  label: string;
  missingPageCount: number;
}

export interface ProjectRollup {
  totalPages: number;
  statusCounts: { pass: number; warn: number; fail: number };
  avgMobileLoadMs: number | null;
  totalBrokenLinks: number;
  totalLongRedirectChains: number;
  schemaGaps: SchemaGap[];
  latestCrawls: Array<{ page: PageRow; crawl: CrawlRow }>;
}

export async function getProjectRollup(pool: Pool, projectId: number, config: AppConfig): Promise<ProjectRollup> {
  const latestCrawls = await getLatestCrawlsForProject(pool, projectId);
  const crawlIds = latestCrawls.map((c) => c.id);

  const statusCounts = { pass: 0, warn: 0, fail: 0 };
  let loadSum = 0;
  let loadCount = 0;
  for (const crawl of latestCrawls) {
    statusCounts[crawl.overall_status] += 1;
    if (crawl.mobile_load_ms !== null) {
      loadSum += crawl.mobile_load_ms;
      loadCount += 1;
    }
  }

  const [totalBrokenLinks, totalLongRedirectChains, findings] = await Promise.all([
    countFindingsByCheck(pool, crawlIds, 'technical.broken-link', 'fail'),
    countFindingsByCheck(pool, crawlIds, 'technical.long-redirect-chain', 'warn'),
    getFindingsForCrawls(pool, crawlIds),
  ]);

  const schemaGaps: SchemaGap[] = config.schemaChecklist.map((entry) => {
    const checkId = `geo.schema-${entry.type.toLowerCase()}`;
    const missingPageCount = findings.filter((f) => f.check_id === checkId && f.status !== 'pass').length;
    return { type: entry.type, label: entry.label, missingPageCount };
  });

  const pagesWithCrawls = await Promise.all(
    latestCrawls.map(async (crawl) => ({ page: await getPage(pool, crawl.page_id), crawl })),
  );

  return {
    totalPages: latestCrawls.length,
    statusCounts,
    avgMobileLoadMs: loadCount > 0 ? Math.round(loadSum / loadCount) : null,
    totalBrokenLinks,
    totalLongRedirectChains,
    schemaGaps,
    latestCrawls: pagesWithCrawls.filter((x): x is { page: PageRow; crawl: CrawlRow } => x.page !== null),
  };
}
