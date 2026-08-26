type DatasetType = 'competitive_seo' | 'ai_visibility';
type Row = Record<string, string>;

const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
const numeric = (value = '') => { const parsed = Number(value.replace(/[%,$£€\s]/g, '').replaceAll(',', '')); return Number.isFinite(parsed) ? parsed : null; };
const first = (row: Row, names: string[]) => names.map(name => row[normalize(name)]).find(value => value !== undefined && value !== '') ?? '';

function table(csv: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], value = '', quoted = false;
  for (let index = 0; index < csv.length; index++) {
    const character = csv[index];
    if (character === '"' && quoted && csv[index + 1] === '"') { value += '"'; index++; }
    else if (character === '"') quoted = !quoted;
    else if ((character === ',' || character === '\t') && !quoted) { row.push(value); value = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) { if (character === '\r' && csv[index + 1] === '\n') index++; row.push(value); if (row.some(cell => cell.trim())) rows.push(row); row = []; value = ''; }
    else value += character;
  }
  row.push(value); if (row.some(cell => cell.trim())) rows.push(row); return rows;
}

export function parseIntelligenceCsv(csv: string, datasetType: DatasetType) {
  const data = table(csv); if (data.length < 2) throw new Error('The file does not contain a header and data rows.');
  const headerIndex = data.findIndex(candidate => candidate.some(cell => /keyword|query|prompt|position|traffic|citation|mention|visibility|share.of.voice/i.test(cell)));
  if (headerIndex < 0) throw new Error('SCOPE could not identify keyword, traffic, prompt, citation, mention, or visibility columns.');
  const headers = data[headerIndex].map(normalize), rows = data.slice(headerIndex + 1).filter(values => values.some(Boolean)).slice(0, 25_000).map(values => Object.fromEntries(headers.map((header, index) => [header || `column${index + 1}`, values[index]?.trim() ?? ''])));
  if (datasetType === 'competitive_seo') {
    const normalized = rows.map(row => ({ keyword: first(row, ['keyword','query','phrase']), url: first(row, ['url','ranking url','landing page','page']), position: numeric(first(row, ['position','current position','rank'])), previousPosition: numeric(first(row, ['previous position','previousposition','position previous'])), estimatedTraffic: numeric(first(row, ['traffic','estimated traffic','estimatedtraffic','traffic sum'])), volume: numeric(first(row, ['volume','search volume','searchvolume'])), difficulty: numeric(first(row, ['difficulty','keyword difficulty','kd'])), trafficValue: numeric(first(row, ['traffic value','traffic cost','cost','price'])) }));
    const positioned = normalized.filter(row => row.position !== null), keywords = new Set(normalized.map(row => row.keyword.toLowerCase()).filter(Boolean));
    return { rows: normalized, metrics: { keywordCount: keywords.size, averagePosition: positioned.length ? positioned.reduce((sum, row) => sum + row.position!, 0) / positioned.length : null, top10Keywords: positioned.filter(row => row.position! <= 10).length, top100Keywords: positioned.filter(row => row.position! <= 100).length, estimatedTraffic: normalized.reduce((sum, row) => sum + (row.estimatedTraffic ?? 0), 0), trafficValue: normalized.reduce((sum, row) => sum + (row.trafficValue ?? 0), 0) } };
  }
  const normalized = rows.map(row => ({ prompt: first(row, ['prompt','query','question','keyword']), platform: first(row, ['platform','engine','model','llm','source']), citedUrl: first(row, ['cited url','citation url','url','source url']), citation: first(row, ['citation','cited','is cited']), mention: first(row, ['mention','mentioned','brand mention']), position: numeric(first(row, ['position','rank','citation position'])), visibility: numeric(first(row, ['visibility','visibility score','share of voice','ai share of voice','sov'])), sentiment: first(row, ['sentiment','tone']) }));
  const prompts = new Set(normalized.map(row => row.prompt.toLowerCase()).filter(Boolean)), cited = normalized.filter(row => row.citedUrl || /yes|true|1/i.test(row.citation)), mentioned = normalized.filter(row => /yes|true|1/i.test(row.mention) || row.mention.length > 3), visibility = normalized.map(row => row.visibility).filter((value): value is number => value !== null);
  return { rows: normalized, metrics: { promptCount: prompts.size, citationCount: cited.length, citedPromptRate: prompts.size ? cited.length / prompts.size : null, mentionCount: mentioned.length, averageVisibility: visibility.length ? visibility.reduce((sum, value) => sum + value, 0) / visibility.length : null, platforms: [...new Set(normalized.map(row => row.platform).filter(Boolean))] } };
}
