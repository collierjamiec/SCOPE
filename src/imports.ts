import type { KeywordCandidate, PageResult } from './types.js';

type Row = Record<string, string>;

function csvTable(input: string): string[][] {
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
  return table;
}

function parseCsv(input: string): Row[] {
  const table = csvTable(input);
  if (table.length < 2) return [];
  const normalize = (header: string) => header.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  const headerIndex = table.findIndex(candidate => {
    const cells = candidate.map(normalize);
    const dimension = cells.some(cell => ['query', 'queries', 'topqueries', 'page', 'pages', 'toppages', 'landingpage', 'landingpagequerystring', 'pagepath', 'pagepathquerystring', 'date'].includes(cell));
    const metric = cells.some(cell => ['clicks', 'impressions', 'sessions', 'activeusers', 'engagedsessions', 'engagementrate'].includes(cell));
    return dimension && metric;
  });
  if (headerIndex < 0 || headerIndex >= table.length - 1) return [];
  const headers = table[headerIndex].map(normalize);
  return table.slice(headerIndex + 1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ''])));
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
    if (!keyword) {
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

export function averageGscPosition(keywords: KeywordCandidate[]): number | undefined {
  const observed = keywords.filter(keyword => keyword.searchConsole && Number.isFinite(keyword.searchConsole.position));
  if (!observed.length) return undefined;
  const impressions = observed.reduce((total, keyword) => total + (keyword.searchConsole?.impressions ?? 0), 0);
  if (impressions > 0) return observed.reduce((total, keyword) => total + (keyword.searchConsole!.position * keyword.searchConsole!.impressions), 0) / impressions;
  return observed.reduce((total, keyword) => total + keyword.searchConsole!.position, 0) / observed.length;
}

export function detectGscDateRange(csvFiles: Array<string | undefined>): { start?: string; end?: string; label: string; source: 'Filters export' | 'Date dimension export' } | undefined {
  const filterRows = csvFiles.flatMap(csv => csv?.trim() ? csvTable(csv) : []);
  const filters = filterRows.find(row => row.length <= 2 && /^(?:date|date range)$/i.test(row[0]?.trim() ?? '') && row.slice(1).some(Boolean));
  const inlineFilter = filterRows.map(row => row.join(', ').trim()).map(value => value.match(/^(?:date|date range)\s*:\s*(.+)$/i)?.[1]).find(Boolean);
  if (filters) {
    const label = filters.slice(1).join(', ').trim();
    const candidates = label.match(/\b(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}\/\d{2,4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4})\b/gi) ?? [];
    const parsed = candidates.map(value => new Date(value)).filter(date => !Number.isNaN(date.valueOf())).sort((a, b) => a.valueOf() - b.valueOf());
    const iso = (date: Date) => date.toISOString().slice(0, 10);
    return parsed.length >= 2 ? { start: iso(parsed[0]), end: iso(parsed[parsed.length - 1]), label, source: 'Filters export' } : { label, source: 'Filters export' };
  }
  if (inlineFilter) return { label: inlineFilter, source: 'Filters export' };
  const dates = csvFiles.flatMap(csv => csv?.trim() ? parseCsv(csv).map(row => field(row, ['date'])).filter(Boolean) : [])
    .map(value => new Date(value))
    .filter(date => !Number.isNaN(date.valueOf()))
    .sort((a, b) => a.valueOf() - b.valueOf());
  if (!dates.length) return undefined;
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  const start = iso(dates[0]), end = iso(dates[dates.length - 1]);
  return { start, end, label: `${start} through ${end}`, source: 'Date dimension export' };
}

const compactDate = (value: string): string | undefined => {
  const match = value.trim().match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})$/); return match ? `${match[1]}-${match[2]}-${match[3]}` : undefined;
};

export function detectGa4DateRange(csv: string | undefined): { start?: string; end?: string; label: string; source: 'GA4 export metadata' | 'GA4 date dimension' } | undefined {
  if (!csv?.trim()) return undefined;
  const startRaw = csv.match(/^\s*#?\s*Start date\s*:\s*([^\r\n]+)/im)?.[1] ?? '';
  const endRaw = csv.match(/^\s*#?\s*End date\s*:\s*([^\r\n]+)/im)?.[1] ?? '';
  const start = compactDate(startRaw), end = compactDate(endRaw);
  if (start && end) return { start, end, label: `${start} through ${end}`, source: 'GA4 export metadata' };
  const label = csv.match(/^\s*#?\s*Date range\s*:\s*([^\r\n]+)/im)?.[1]?.trim();
  if (label) return { label, source: 'GA4 export metadata' };
  const dates = parseCsv(csv).map(row => compactDate(field(row, ['date']))).filter((value): value is string => Boolean(value)).sort();
  if (!dates.length) return undefined;
  return { start: dates[0], end: dates[dates.length - 1], label: `${dates[0]} through ${dates[dates.length - 1]}`, source: 'GA4 date dimension' };
}

export function applyGa4Export(pages: PageResult[], csv: string | undefined, origin: string): number {
  if (!csv?.trim()) return 0;
  const rows = parseCsv(csv); const pageMap = new Map(pages.map(page => [new URL(page.url).pathname.replace(/\/$/, '') || '/', page]));
  for (const row of rows) {
    const rawPath = field(row, ['landingpage', 'landingpagequerystring', 'pagepath', 'pagepathquerystring', 'page']); if (!rawPath || rawPath === '(not set)') continue;
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
