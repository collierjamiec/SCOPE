import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { ExtractedData, Finding, FindingStatus } from '../../pipeline/types.js';

/** overall_status is never 'info' — info findings are situational, not something to roll up as a problem. */
export type OverallStatus = Exclude<FindingStatus, 'info'>;

export interface CrawlRow {
  id: number;
  page_id: number;
  crawled_at: Date;
  raw_data: ExtractedData;
  overall_status: OverallStatus;
  pass_count: number;
  info_count: number;
  warn_count: number;
  fail_count: number;
  mobile_load_ms: number | null;
  http_status: number | null;
}

export function computeOverallStatus(findings: Finding[]): OverallStatus {
  if (findings.some((f) => f.status === 'fail')) return 'fail';
  if (findings.some((f) => f.status === 'warn')) return 'warn';
  return 'pass';
}

export async function insertCrawl(
  pool: Pool,
  pageId: number,
  extracted: ExtractedData,
  findings: Finding[],
): Promise<number> {
  const overallStatus = computeOverallStatus(findings);
  const passCount = findings.filter((f) => f.status === 'pass').length;
  const infoCount = findings.filter((f) => f.status === 'info').length;
  const warnCount = findings.filter((f) => f.status === 'warn').length;
  const failCount = findings.filter((f) => f.status === 'fail').length;

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO crawls
      (page_id, raw_data, overall_status, pass_count, info_count, warn_count, fail_count, mobile_load_ms, http_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      pageId,
      JSON.stringify(extracted),
      overallStatus,
      passCount,
      infoCount,
      warnCount,
      failCount,
      extracted.technical.performance.mobileLoadMs,
      extracted.technical.httpStatus,
    ],
  );
  return result.insertId;
}

function parseRow(row: RowDataPacket): CrawlRow {
  return {
    ...(row as unknown as CrawlRow),
    raw_data: typeof row.raw_data === 'string' ? JSON.parse(row.raw_data) : row.raw_data,
  };
}

export async function getCrawl(pool: Pool, crawlId: number): Promise<CrawlRow | null> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM crawls WHERE id = ?', [crawlId]);
  return rows[0] ? parseRow(rows[0]) : null;
}

export async function getCrawlsForPage(pool: Pool, pageId: number, limit = 20): Promise<CrawlRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM crawls WHERE page_id = ? ORDER BY crawled_at DESC LIMIT ?',
    [pageId, limit],
  );
  return rows.map(parseRow);
}

/** Latest crawl per page for every page in a project — the basis for rollup views. */
export async function getLatestCrawlsForProject(pool: Pool, projectId: number): Promise<CrawlRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
    WITH latest AS (
      SELECT c.*, ROW_NUMBER() OVER (PARTITION BY c.page_id ORDER BY c.crawled_at DESC) AS rn
      FROM crawls c
      JOIN pages p ON p.id = c.page_id
      WHERE p.project_id = ?
    )
    SELECT * FROM latest WHERE rn = 1
    `,
    [projectId],
  );
  return rows.map(parseRow);
}
