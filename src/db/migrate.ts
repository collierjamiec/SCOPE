import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import mysql from 'mysql2/promise';
import type { AppConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../docker/mariadb/init');

/**
 * Applies any docker/mariadb/init/NNN_*.sql not yet recorded in schema_migrations.
 * The init-mount only runs automatically on a container's first boot against an
 * empty data volume, so this is what applies later migrations to an existing DB.
 */
export async function runMigrations(config: AppConfig): Promise<void> {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  });

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(20) PRIMARY KEY,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const [rows] = await connection.query<mysql.RowDataPacket[]>('SELECT version FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.version as string));

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      const version = file.split('_')[0] ?? file;
      if (applied.has(version)) continue;

      logger.info(`Applying migration ${file}…`);
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      await connection.query(sql);
      await connection.query('INSERT IGNORE INTO schema_migrations (version) VALUES (?)', [version]);
      logger.info(`Applied ${file}.`);
    }
  } finally {
    await connection.end();
  }
}
