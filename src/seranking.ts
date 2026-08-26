import { chmod, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const baseUrl = 'https://api.seranking.com';

export interface SerankingCredentials { apiKey: string }
export interface SerankingProject { id: string; title: string; domain: string }
export interface SerankingSyncOptions {
  siteId: string;
  targetDomain: string;
  dateFrom: string;
  dateTo: string;
  market?: string;
  includeAnswerEvidence?: boolean;
  maximumAnswers?: number;
}

type Fetcher = typeof fetch;
type Json = Record<string, any>;

export function serankingCredentialPath(): string {
  return process.env.SCOPE_SERANKING_CREDENTIALS_FILE
    ?? join(process.env.SCOPE_DATA_DIR ?? resolve(process.cwd(), '.scope'), 'seranking.json');
}

export async function loadSerankingCredentials(): Promise<SerankingCredentials | undefined> {
  if (process.env.SERANKING_API_KEY) return { apiKey: process.env.SERANKING_API_KEY };
  try {
    const value = JSON.parse(await readFile(serankingCredentialPath(), 'utf8')) as SerankingCredentials;
    return value.apiKey ? value : undefined;
  } catch { return undefined; }
}

export async function saveSerankingCredentials(credentials: SerankingCredentials): Promise<void> {
  const path = serankingCredentialPath(), temporary = `${path}.${process.pid}.tmp`;
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(temporary, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600 });
  await chmod(temporary, 0o600); await rename(temporary, path); await chmod(path, 0o600);
}

export async function removeSerankingCredentials(): Promise<void> {
  try { await unlink(serankingCredentialPath()); } catch { /* Already absent. */ }
}

const message = (data: any, status: number) => String(data?.message ?? data?.error?.message ?? data?.error ?? `SE Ranking returned HTTP ${status}`).replace(/Token\s+\S+/gi, 'Token [redacted]');

async function request(path: string, credentials: SerankingCredentials, fetcher: Fetcher = fetch): Promise<any> {
  const response = await fetcher(`${baseUrl}${path}`, { headers: { authorization: `Token ${credentials.apiKey}`, accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(message(data, response.status));
  return data;
}

const array = (value: any): any[] => Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : Array.isArray(value?.items) ? value.items : Array.isArray(value?.results) ? value.results : [];
const number = (...values: unknown[]): number | null => {
  for (const value of values) { const parsed = Number(value); if (value !== '' && value !== null && value !== undefined && Number.isFinite(parsed)) return parsed; }
  return null;
};
const text = (...values: unknown[]): string => String(values.find(value => value !== '' && value !== null && value !== undefined) ?? '');

export async function testSerankingConnection(credentials: SerankingCredentials, fetcher: Fetcher = fetch): Promise<{ connected: true; subscription: any }> {
  return { connected: true, subscription: await request('/v1/account/subscription', credentials, fetcher) };
}

export async function listSerankingProjects(credentials: SerankingCredentials, fetcher: Fetcher = fetch): Promise<SerankingProject[]> {
  const data = await request('/v1/project-management/sites', credentials, fetcher);
  return array(data).map((item: Json) => ({
    id: text(item.id, item.site_id, item.siteId),
    title: text(item.title, item.name, item.domain, item.url),
    domain: text(item.domain, item.url, item.host, item.title)
  })).filter(item => item.id);
}

async function paginated(path: string, credentials: SerankingCredentials, fetcher: Fetcher, maximum = 10_000): Promise<any[]> {
  const rows: any[] = [];
  for (let offset = 0; offset < maximum; offset += 100) {
    const separator = path.includes('?') ? '&' : '?', data = await request(`${path}${separator}limit=100&offset=${offset}`, credentials, fetcher), batch = array(data);
    rows.push(...batch);
    if (batch.length < 100) break;
  }
  return rows.slice(0, maximum);
}

/**
 * Synchronizes AI Results Tracker observations. It intentionally excludes SE Ranking's
 * credit-metered Data API endpoints; SCOPE never spends provider credits implicitly.
 */
export async function syncSerankingAiVisibility(credentials: SerankingCredentials, options: SerankingSyncOptions, fetcher: Fetcher = fetch) {
  const engines = array(await request(`/v1/project-management/airt/llm?site_id=${encodeURIComponent(options.siteId)}`, credentials, fetcher));
  if (!engines.length) throw new Error('No AI Results Tracker engines were found for this SE Ranking project. Configure prompts and engines in SE Ranking first.');
  const normalizedRows: Array<Record<string, unknown>> = [], engineSummaries: Array<Record<string, unknown>> = [];
  const answerLimit = Math.min(100, Math.max(0, options.maximumAnswers ?? 25)); let answersFetched = 0;

  for (const engine of engines) {
    const llmId = text(engine.id, engine.llm_id, engine.llmId), platform = text(engine.name, engine.title, engine.llm, engine.engine, llmId);
    if (!llmId) continue;
    const query = `site_id=${encodeURIComponent(options.siteId)}&llm_id=${encodeURIComponent(llmId)}&date_from=${encodeURIComponent(options.dateFrom)}&date_to=${encodeURIComponent(options.dateTo)}`;
    const [statistics, prompts, rankings] = await Promise.all([
      request(`/v1/project-management/airt/llm/statistics?${query}&top=100`, credentials, fetcher),
      paginated(`/v1/project-management/airt/prompts?site_id=${encodeURIComponent(options.siteId)}&llm_id=${encodeURIComponent(llmId)}`, credentials, fetcher),
      paginated(`/v1/project-management/airt/prompts/rankings?${query}`, credentials, fetcher)
    ]);
    const promptsById = new Map(prompts.map((prompt: Json) => [text(prompt.id, prompt.prompt_id, prompt.prompt_llm_id), prompt]));
    const observed = rankings.length ? rankings : prompts;
    for (const item of observed) {
      const promptId = text(item.prompt_llm_id, item.prompt_id, item.id), prompt = promptsById.get(promptId) ?? item;
      const date = text(item.date, item.checked_at, item.created_at, options.dateTo).slice(0, 10);
      const row: Record<string, unknown> = {
        prompt: text(prompt.prompt, prompt.query, prompt.title, item.prompt), platform, engineId: llmId,
        date, position: number(item.position, item.rank, item.brand_position),
        visibility: number(item.visibility, item.visibility_score, item.share_of_voice, item.sov),
        mention: Boolean(item.mentioned ?? item.is_mentioned ?? item.brand_mentioned),
        citation: Boolean(item.cited ?? item.is_cited ?? item.has_source),
        citedUrl: text(item.url, item.cited_url, item.source_url), sentiment: text(item.sentiment, item.tone),
        evidenceClass: 'third_party_observed', provider: 'SE Ranking API'
      };
      if (options.includeAnswerEvidence && promptId && answersFetched < answerLimit) {
        try {
          const answer = await request(`/v1/project-management/airt/prompts/answer?site_id=${encodeURIComponent(options.siteId)}&llm_id=${encodeURIComponent(llmId)}&prompt_llm_id=${encodeURIComponent(promptId)}&date=${encodeURIComponent(date || options.dateTo)}`, credentials, fetcher);
          const sources = array(answer?.sources), brands = array(answer?.brands);
          row.answerText = text(answer?.text, answer?.answer);
          row.sources = sources.map(source => ({ url: text(source.url, source.link), position: number(source.position, source.rank) }));
          row.brands = brands.map(brand => ({ name: text(brand.name, brand.brand), position: number(brand.position, brand.rank) }));
          row.citation = sources.length > 0; row.mention = brands.length > 0 || row.mention;
          if (!row.citedUrl && sources[0]) row.citedUrl = text(sources[0].url, sources[0].link);
          answersFetched += 1;
        } catch (error) { row.answerEvidenceError = error instanceof Error ? error.message : String(error); }
      }
      normalizedRows.push(row);
    }
    engineSummaries.push({ engineId: llmId, platform, promptCount: new Set(observed.map(item => text(item.prompt_llm_id, item.prompt_id, item.id))).size, statistics });
  }
  const prompts = new Set(normalizedRows.map(row => String(row.prompt ?? '').toLowerCase()).filter(Boolean));
  const cited = normalizedRows.filter(row => row.citation || row.citedUrl), mentioned = normalizedRows.filter(row => row.mention);
  const visibility = normalizedRows.map(row => number(row.visibility)).filter((value): value is number => value !== null);
  return {
    rows: normalizedRows,
    metrics: {
      datasetKind: 'seranking_ai_results_tracker', promptCount: prompts.size, citationCount: cited.length,
      citedPromptRate: prompts.size ? new Set(cited.map(row => String(row.prompt).toLowerCase())).size / prompts.size : null,
      mentionCount: mentioned.length, averageVisibility: visibility.length ? visibility.reduce((sum, value) => sum + value, 0) / visibility.length : null,
      platforms: [...new Set(normalizedRows.map(row => String(row.platform ?? '')).filter(Boolean))], engines: engineSummaries,
      answersFetched, sourceAuthority: 'third_party_provider', methodologyNote: 'SE Ranking observations and modeled metrics; not Google first-party analytics.'
    },
    market: options.market ?? '', reportStart: options.dateFrom, reportEnd: options.dateTo
  };
}
