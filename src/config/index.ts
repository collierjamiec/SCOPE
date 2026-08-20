import 'dotenv/config';
import { z } from 'zod';
import { thresholds, type Thresholds } from './thresholds.js';
import { schemaChecklist, type SchemaChecklistEntry } from './schemaChecklist.js';

const envSchema = z.object({
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().default('seo_geo_crawler'),
  DB_USER: z.string().default('crawler'),
  DB_PASSWORD: z.string().default('crawlerpass'),
  WEB_PORT: z.coerce.number().int().positive().default(4000),
  NAVIGATION_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
});

export interface AppConfig {
  db: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  webPort: number;
  thresholds: Thresholds;
  schemaChecklist: SchemaChecklistEntry[];
}

function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }
  const env = parsed.data;

  const effectiveThresholds: Thresholds = env.NAVIGATION_TIMEOUT_MS
    ? { ...thresholds, navigationTimeoutMs: env.NAVIGATION_TIMEOUT_MS }
    : thresholds;

  return {
    db: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
    },
    webPort: env.WEB_PORT,
    thresholds: effectiveThresholds,
    schemaChecklist,
  };
}

export const config: AppConfig = loadConfig();
