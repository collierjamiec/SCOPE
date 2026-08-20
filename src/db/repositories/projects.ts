import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export interface ProjectRow {
  id: number;
  domain: string;
  created_at: Date;
}

export async function findOrCreateProjectByDomain(pool: Pool, domain: string): Promise<number> {
  const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM projects WHERE domain = ?', [domain]);
  if (existing.length > 0) return existing[0]!.id as number;

  const [result] = await pool.query<ResultSetHeader>('INSERT INTO projects (domain) VALUES (?)', [domain]);
  return result.insertId;
}

export async function getProject(pool: Pool, projectId: number): Promise<ProjectRow | null> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM projects WHERE id = ?', [projectId]);
  return (rows[0] as ProjectRow | undefined) ?? null;
}

export interface ProjectListEntry extends ProjectRow {
  page_count: number;
  last_crawled_at: Date | null;
}

export async function listProjects(pool: Pool): Promise<ProjectListEntry[]> {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      p.*,
      COUNT(DISTINCT pg.id) AS page_count,
      MAX(c.crawled_at) AS last_crawled_at
    FROM projects p
    LEFT JOIN pages pg ON pg.project_id = p.id
    LEFT JOIN crawls c ON c.page_id = pg.id
    GROUP BY p.id
    ORDER BY p.domain ASC
  `);
  return rows as ProjectListEntry[];
}
