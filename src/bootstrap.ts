#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import mariadb from 'mariadb';

try { process.loadEnvFile(); } catch { /* A first-run installation may not have an .env file. */ }

const localDatabaseUrl = 'mysql://scope:scope-local-change-me@127.0.0.1:3306/scope';
process.env.DATABASE_URL ||= localDatabaseUrl;

const connectionOptions = () => {
  const url = new URL(process.env.DATABASE_URL!);
  return { host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: url.pathname.replace(/^\//, ''), connectTimeout: 2500 };
};
const reachable = async () => {
  try { const connection = await mariadb.createConnection(connectionOptions()); await connection.end(); return true; }
  catch { return false; }
};
const run = (command: string, args: string[], timeout: number) => spawnSync(command, args, { cwd: process.cwd(), env: process.env, encoding: 'utf8', timeout, stdio: 'pipe' });

async function prepareHistory() {
  let connected = await reachable();
  if (!connected) {
    try {
      await access(resolve('docker-compose.yml'));
      const docker = run('docker', ['compose', 'up', '-d', 'mariadb'], 120_000);
      if (docker.status === 0) {
        for (let attempt = 0; attempt < 30 && !connected; attempt++) {
          await new Promise(resolveWait => setTimeout(resolveWait, 1_000));
          connected = await reachable();
        }
      }
    } catch { /* The UI will explain that Docker or an existing MariaDB service is required. */ }
  }
  if (!connected) {
    process.env.SCOPE_HISTORY_BOOTSTRAP_ERROR = 'MariaDB is not reachable. Install or start Docker Desktop, then restart SCOPE; SCOPE will create and migrate its local database automatically.';
    return;
  }
  const prismaCli = resolve('node_modules/prisma/build/index.js');
  const migration = run(process.execPath, [prismaCli, 'migrate', 'deploy'], 120_000);
  if (migration.status !== 0) process.env.SCOPE_HISTORY_BOOTSTRAP_ERROR = (migration.stderr || migration.stdout || 'Database migration failed.').trim();
}

await prepareHistory();
await import('./dashboard.js');
