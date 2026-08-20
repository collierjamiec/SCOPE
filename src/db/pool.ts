import mysql from 'mysql2/promise';
import type { AppConfig } from '../config/index.js';

let pool: mysql.Pool | null = null;

export function getPool(config: AppConfig): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true,
      // The MariaDB container's clock runs in UTC regardless of the host's
      // timezone (its `default-time-zone` is SYSTEM, i.e. the container OS,
      // which is UTC) — so CURRENT_TIMESTAMP/NOW() write UTC wall-clock
      // digits into DATETIME columns. Telling mysql2 to treat those digits
      // as UTC on read (rather than local time) makes every JS Date it
      // constructs represent the correct moment, so .toLocaleString() etc.
      // then correctly convert to whatever timezone this Node process runs
      // in — the fix belongs here, not in the container's OS config, since
      // it works regardless of what machine/timezone the DB or app run on.
      timezone: 'Z',
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
