import type { KeywordCandidate, PageResult } from './types.js';

type Row = Record<string, string>;

function parseCsv(input: string): Row[] {
  const table: string[][] = []; let row: string[] = []; let value = ''; let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"' && quoted && input[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { row.push(value); value = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      row.push(value); if (row.some(cell => cell.trim())) table.push(row); row = []; value = '';
    } else value += character;
  }
  row.push(value); if (row.some(cell => cell.trim())) table.push(row);
  if (table.length < 2) return [];
  const headers = table[0].map(header => header.trim().toLowerCase().replace(/[^a-z0-9]+/g, ''));
  return table.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ''])));
}

const number = (value = '') => Number(value.replace(/[%,$]/g, '').replaceAll(',', '')) || 0;
const field = (row: Row, names: string[]) => names.map(name => row[name]).find(value => value !== undefined) ?? '';
const absolutePage = (page: string, origin: string) => { try { return new URL(page, origin).href; } catch { return page; } };

export function mergeGscExport(keywords: KeywordCandidate[], csv: string | undefined, maximum: number, origin: string): number {
  if (!csv?.trim()) return 0;
  const rows = parseCsv(csv); const byKeyword = new Map(keywords.map(keyword => [keyword.keyword.toLowerCase(), keyword]));
  for (const row of rows) {
    const phrase = field(row, ['query', 'queries', 'topqueries']).trim(); if (!phrase) continue;
    const page = absolutePage(field(row, ['page', 'pages', 'toppages']), origin);
    const clicks = number(field(row, ['clicks'])), impressions = number(field(row, ['impressions']));
    const ctrRaw = number(field(row, ['ctr'])); const ctr = field(row, ['ctr']).includes('%') ? ctrRaw / 100 : ctrRaw;
    const position = number(field(row, ['position', 'averageposition']));
    let keyword = byKeyword.get(phrase.toLowerCase());
    if (!keyword && byKeyword.size < maximum) {
      keyword = { keyword: phrase, score: 0, confidence: 1, pages: page ? [{ url: page, score: 0, evidence: ['Google Search Console export'] }] : [], ranking: null };
      keywords.push(keyword); byKeyword.set(phrase.toLowerCase(), keyword);
    }
    if (!keyword) continue;
    const existing = keyword.searchConsole ?? { clicks: 0, impressions: 0, ctr: 0, position: 0, pages: [] };
    const totalImpressions = existing.impressions + impressions;
    existing.position = totalImpressions ? ((existing.position * existing.impressions) + (position * impressions)) / totalImpressions : position;
    existing.clicks += clicks; existing.impressions = totalImpressions; existing.ctr = totalImpressions ? existing.clicks / totalImpressions : ctr;
    if (page && !existing.pages.includes(page)) existing.pages.push(page);
    keyword.searchConsole = existing;
  }
  return rows.length;
}

export function applyGa4Export(pages: PageResult[], csv: string | undefined, origin: string): number {
  if (!csv?.trim()) return 0;
  const rows = parseCsv(csv); const pageMap = new Map(pages.map(page => [new URL(page.url).pathname.replace(/\/$/, '') || '/', page]));
  for (const row of rows) {
    const rawPath = field(row, ['landingpage', 'landingpagequerystring', 'pagepath', 'pagepathquerystring', 'page']); if (!rawPath) continue;
    let path: string; try { path = new URL(rawPath, origin).pathname.replace(/\/$/, '') || '/'; } catch { continue; }
    const page = pageMap.get(path); if (!page) continue;
    page.analytics = {
      sessions: number(field(row, ['sessions'])), activeUsers: number(field(row, ['activeusers', 'users'])),
      engagedSessions: number(field(row, ['engagedsessions'])), engagementRate: number(field(row, ['engagementrate'])) / (field(row, ['engagementrate']).includes('%') ? 100 : 1),
      keyEvents: number(field(row, ['keyevents', 'conversions']))
    };
  }
  return rows.length;
}
