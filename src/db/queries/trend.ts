import type { Pool } from 'mysql2/promise';
import { getCrawlsForPage, type CrawlRow } from '../repositories/crawls.js';
import { getFindingsForCrawls, type FindingRow } from '../repositories/findings.js';
import type { FindingStatus } from '../../pipeline/types.js';

export interface FindingDiffEntry {
  checkId: string;
  previousStatus: FindingStatus | null;
  currentStatus: FindingStatus | null;
  detail: string;
}

export interface PageTrend {
  crawls: CrawlRow[];
  findingsByCrawlId: Map<number, FindingRow[]>;
  /** Findings whose status changed (or appeared/disappeared) between the two most recent crawls. */
  diffSinceLastCrawl: FindingDiffEntry[];
}

export async function getPageTrend(pool: Pool, pageId: number, limit = 20): Promise<PageTrend> {
  const crawls = await getCrawlsForPage(pool, pageId, limit);
  const findings = await getFindingsForCrawls(pool, crawls.map((c) => c.id));

  const findingsByCrawlId = new Map<number, FindingRow[]>();
  for (const crawl of crawls) findingsByCrawlId.set(crawl.id, []);
  for (const finding of findings) {
    findingsByCrawlId.get(finding.crawl_id)?.push(finding);
  }

  const diffSinceLastCrawl: FindingDiffEntry[] = [];
  // crawls[0] is most recent (ORDER BY crawled_at DESC)
  const current = crawls[0];
  const previous = crawls[1];
  if (current && previous) {
    const currentByCheck = new Map((findingsByCrawlId.get(current.id) ?? []).map((f) => [f.check_id, f]));
    const previousByCheck = new Map((findingsByCrawlId.get(previous.id) ?? []).map((f) => [f.check_id, f]));
    const allCheckIds = new Set([...currentByCheck.keys(), ...previousByCheck.keys()]);

    for (const checkId of allCheckIds) {
      const curr = currentByCheck.get(checkId);
      const prev = previousByCheck.get(checkId);
      if (curr?.status !== prev?.status) {
        diffSinceLastCrawl.push({
          checkId,
          previousStatus: prev?.status ?? null,
          currentStatus: curr?.status ?? null,
          detail: curr?.detail ?? prev?.detail ?? '',
        });
      }
    }
  }

  return { crawls, findingsByCrawlId, diffSinceLastCrawl };
}
