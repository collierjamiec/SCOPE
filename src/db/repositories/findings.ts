import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { Finding, FindingStatus } from '../../pipeline/types.js';

export interface FindingRow {
  id: number;
  crawl_id: number;
  check_id: string;
  status: FindingStatus;
  detail: string;
  data: Record<string, unknown> | null;
}

export async function insertFindings(pool: Pool, crawlId: number, findings: Finding[]): Promise<void> {
  if (findings.length === 0) return;

  const values = findings.map((f) => [crawlId, f.checkId, f.status, f.detail, f.data ? JSON.stringify(f.data) : null]);
  await pool.query('INSERT INTO findings (crawl_id, check_id, status, detail, data) VALUES ?', [values]);
}

function parseRow(row: RowDataPacket): FindingRow {
  return {
    ...(row as unknown as FindingRow),
    data: row.data ? (typeof row.data === 'string' ? JSON.parse(row.data) : row.data) : null,
  };
}

export async function getFindingsForCrawl(pool: Pool, crawlId: number): Promise<FindingRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM findings WHERE crawl_id = ?', [crawlId]);
  return rows.map(parseRow);
}

export async function getFindingsForCrawls(pool: Pool, crawlIds: number[]): Promise<FindingRow[]> {
  if (crawlIds.length === 0) return [];
  const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM findings WHERE crawl_id IN (?)', [crawlIds]);
  return rows.map(parseRow);
}

/** Sitewide count of a specific check's failing/warning instances across a set of crawls. */
export async function countFindingsByCheck(
  pool: Pool,
  crawlIds: number[],
  checkId: string,
  status: FindingStatus,
): Promise<number> {
  if (crawlIds.length === 0) return 0;
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS n FROM findings WHERE crawl_id IN (?) AND check_id = ? AND status = ?',
    [crawlIds, checkId, status],
  );
  return Number(rows[0]?.n ?? 0);
}
