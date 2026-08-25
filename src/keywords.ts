import type { CannibalizationIssue, KeywordCandidate, PageResult, RankingResult } from './types.js';

const STOP = new Set(`a an and are as at be been but by can for from has have how i if in into is it its more not of on or our that the their this to was we what when where which who will with you your`.split(' '));

function tokens(text: string): string[] {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).map(v => v.replace(/^-|-$/g, '')).filter(v => v.length > 2 && !STOP.has(v) && !/^\d+$/.test(v));
}

function phrases(text: string, min = 1, max = 4): string[] {
  const words = tokens(text);
  const result: string[] = [];
  for (let n = min; n <= max; n++) for (let i = 0; i <= words.length - n; i++) result.push(words.slice(i, i + n).join(' '));
  return result;
}

export function extractKeywordSignals(title: string, description: string, h1s: string[], h2s: string[], body: string) {
  const scores = new Map<string, { score: number; evidence: Set<string> }>();
  const add = (source: string, weight: number, evidence: string, min: number, max: number) => {
    for (const phrase of phrases(source, min, max)) {
      const current = scores.get(phrase) ?? { score: 0, evidence: new Set<string>() };
      current.score += weight;
      current.evidence.add(evidence);
      scores.set(phrase, current);
    }
  };
  add(title, 8, 'title', 1, 4);
  add(h1s.join(' '), 7, 'H1', 1, 4);
  add(h2s.join(' '), 4, 'H2', 2, 4);
  add(description, 3, 'meta description', 2, 4);
  add(body.slice(0, 20000), 0.12, 'body content', 2, 4);
  return [...scores.entries()]
    .filter(([phrase, value]) => phrase.length >= 4 && value.score >= 2)
    .sort((a, b) => b[1].score - a[1].score || b[0].split(' ').length - a[0].split(' ').length)
    .slice(0, 40)
    .map(([phrase, value]) => ({ phrase, score: Number(value.score.toFixed(2)), evidence: [...value.evidence].join(', ') }));
}

export function aggregateKeywords(pages: PageResult[], maximum: number): KeywordCandidate[] {
  const all = new Map<string, KeywordCandidate>();
  for (const page of pages) {
    for (const signal of page.keywordSignals) {
      const keyword = signal.phrase;
      const existing = all.get(keyword) ?? { keyword, score: 0, confidence: 0, pages: [], ranking: null };
      existing.score += signal.score;
      const pageEntry = existing.pages.find(p => p.url === page.url);
      if (pageEntry) {
        pageEntry.score += signal.score;
        pageEntry.evidence.push(signal.evidence);
      } else existing.pages.push({ url: page.url, score: signal.score, evidence: [signal.evidence] });
      all.set(keyword, existing);
    }
  }
  const values = [...all.values()].filter(k => k.keyword.split(' ').length >= 2);
  for (const item of values) {
    item.pages.sort((a, b) => b.score - a.score);
    item.score = Number(item.score.toFixed(2));
    item.confidence = Number(Math.min(0.98, 0.3 + item.pages[0].score / 25).toFixed(2));
  }
  // Remove phrases that are weaker substrings of a more specific phrase.
  const sorted = values.sort((a, b) => b.score - a.score || b.keyword.length - a.keyword.length);
  const selected: KeywordCandidate[] = [];
  for (const item of sorted) {
    const duplicate = selected.some(chosen => chosen.keyword.includes(item.keyword) && chosen.pages[0]?.url === item.pages[0]?.url && chosen.score >= item.score * 0.75);
    if (!duplicate) selected.push(item);
    if (selected.length >= maximum) break;
  }
  return selected;
}

export function detectCannibalization(keywords: KeywordCandidate[]): CannibalizationIssue[] {
  return keywords.flatMap(keyword => {
    const contenders = keyword.pages.filter(page => page.score >= Math.max(5, keyword.pages[0].score * 0.65));
    if (contenders.length < 2) return [];
    const close = contenders[1].score >= contenders[0].score * 0.8;
    return [{
      keyword: keyword.keyword,
      severity: close ? 'likely' as const : 'possible' as const,
      pages: contenders.map(({ url, score }) => ({ url, score: Number(score.toFixed(2)) })),
      reason: close
        ? 'Multiple indexable pages have similarly strong on-page targeting signals.'
        : 'Multiple indexable pages have substantial on-page targeting signals; verify intent and ranking overlap.'
    }];
  });
}

export function applyRankings(keywords: KeywordCandidate[], rankings: Map<string, RankingResult>): void {
  for (const keyword of keywords) keyword.ranking = rankings.get(keyword.keyword) ?? null;
}
