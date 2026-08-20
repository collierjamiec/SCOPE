import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { hashUrl } from '../../utils/url.js';

export interface PageRow {
  id: number;
  project_id: number;
  url: string;
  url_hash: string;
  first_seen_at: Date;
}

export async function findOrCreatePage(pool: Pool, projectId: number, url: string): Promise<number> {
  const urlHash = hashUrl(url);
  const [existing] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM pages WHERE project_id = ? AND url_hash = ?',
    [projectId, urlHash],
  );
  if (existing.length > 0) return existing[0]!.id as number;

  const [result] = await pool.query<ResultSetHeader>(
    'INSERT INTO pages (project_id, url, url_hash) VALUES (?, ?, ?)',
    [projectId, url, urlHash],
  );
  return result.insertId;
}

export async function getPage(pool: Pool, pageId: number): Promise<PageRow | null> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM pages WHERE id = ?', [pageId]);
  return (rows[0] as PageRow | undefined) ?? null;
}

export interface PageListEntry extends PageRow {
  crawl_count: number;
  last_crawled_at: Date | null;
  last_overall_status: 'pass' | 'warn' | 'fail' | null;
}

export async function listPagesForProject(pool: Pool, projectId: number): Promise<PageListEntry[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
    SELECT
      pg.*,
      COUNT(c.id) AS crawl_count,
      MAX(c.crawled_at) AS last_crawled_at,
      (
        SELECT c2.overall_status FROM crawls c2
        WHERE c2.page_id = pg.id ORDER BY c2.crawled_at DESC LIMIT 1
      ) AS last_overall_status
    FROM pages pg
    LEFT JOIN crawls c ON c.page_id = pg.id
    WHERE pg.project_id = ?
    GROUP BY pg.id
    ORDER BY pg.url ASC
    `,
    [projectId],
  );
  return rows as PageListEntry[];
}
