import type { KeywordCandidate, RankingResult, SerpConfig } from './types.js';
import { mapLimit } from './util.js';

export interface SerpProvider {
  name: string;
  lookup(keyword: string, domain: string): Promise<RankingResult>;
}

/**
 * Generic licensed-provider adapter. The configured endpoint receives a POST body
 * and must return { position: number|null, rankingUrl: string|null }.
 * This deliberately avoids coupling the crawler to one vendor's license.
 */
export class HttpSerpProvider implements SerpProvider {
  name = 'licensed-http-provider';
  constructor(private config: SerpConfig) {}
  async lookup(keyword: string, domain: string): Promise<RankingResult> {
    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.config.apiKey}` },
      body: JSON.stringify({ keyword, domain, country: this.config.country ?? 'us', language: this.config.language ?? 'en', device: this.config.device ?? 'desktop', organicOnly: true })
    });
    if (!response.ok) throw new Error(`SERP provider returned HTTP ${response.status}`);
    const data = await response.json() as { position?: number | null; rankingUrl?: string | null };
    return {
      position: data.position ?? null, rankingUrl: data.rankingUrl ?? null,
      checkedAt: new Date().toISOString(), country: this.config.country ?? 'us',
      language: this.config.language ?? 'en', device: this.config.device ?? 'desktop', provider: this.name
    };
  }
}

export async function getRankings(provider: SerpProvider, keywords: KeywordCandidate[], domain: string): Promise<Map<string, RankingResult>> {
  const rows = await mapLimit(keywords, 3, async keyword => {
    try { return [keyword.keyword, await provider.lookup(keyword.keyword, domain)] as const; }
    catch { return [keyword.keyword, null] as const; }
  });
  return new Map(rows.filter((row): row is readonly [string, RankingResult] => row[1] !== null));
}
