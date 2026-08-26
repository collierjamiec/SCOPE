import { normalizeDomain } from './util.js';

type DatasetType = 'competitive_seo' | 'ai_visibility';
type Row = Record<string, string>;

const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
const numeric = (value = '') => { const cleaned = value.replace(/[%,$£€\s]/g, '').replaceAll(',', ''); if (!cleaned || cleaned === '-') return null; const parsed = Number(cleaned); return Number.isFinite(parsed) ? parsed : null; };
const first = (row: Row, names: string[]) => names.map(name => row[normalize(name)]).find(value => value !== undefined && value !== '') ?? '';
const candidateType = (domain: string) => /^(?:instagram|facebook|wikipedia|imdb|youtube|linkedin|x|twitter|reddit|pinterest|tiktok)\./i.test(domain) ? 'platform_or_reference' : 'market_candidate';

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
  const rawHeaders = data[headerIndex], headers = rawHeaders.map(normalize), datedColumns = rawHeaders
    .map((header, index) => ({ header: header.trim(), key: headers[index] }))
    .filter(column => /^\d{4}-\d{2}-\d{2}$/.test(column.header))
    .sort((a, b) => a.header.localeCompare(b.header));
  const rows = data.slice(headerIndex + 1).filter(values => values.some(Boolean)).slice(0, 25_000).map(values => Object.fromEntries(headers.map((header, index) => [header || `column${index + 1}`, values[index]?.trim() ?? ''])));
  if (datasetType === 'competitive_seo') {
    const shareOfVoiceIndex = rawHeaders.findIndex(header => /share of voice/i.test(header));
    const domainIndex = rawHeaders.findIndex(header => /^domain$/i.test(header.trim()));
    if (shareOfVoiceIndex >= 0 && domainIndex >= 0) {
      const top20UrlsIndex = rawHeaders.findIndex(header => /urls in the top 20/i.test(header));
      const top20KeywordsIndex = rawHeaders.findIndex(header => /keywords in the top 20/i.test(header));
      const trafficForecastIndex = rawHeaders.findIndex(header => /traffic forecast/i.test(header));
      const rawRows = data.slice(headerIndex + 1).filter(values => values[domainIndex] && !/^other competitors$|^total traffic forecast$/i.test(values[domainIndex].trim()));
      const normalized = rawRows.map(values => ({
        domain: normalizeDomain(values[domainIndex].trim()),
        top20Urls: numeric(values[top20UrlsIndex]),
        top20Keywords: numeric(values[top20KeywordsIndex]),
        shareOfVoice: numeric(values[shareOfVoiceIndex]),
        trafficForecast: numeric(values[trafficForecastIndex]),
        candidateType: candidateType(normalizeDomain(values[domainIndex].trim()))
      })).filter(row => /(?:^|\.)[a-z0-9-]+\.[a-z]{2,}$/i.test(row.domain));
      const preamble = data.slice(0, headerIndex).flat().join(' '), dates = (preamble.match(/\d{4}-\d{2}-\d{2}/g) ?? []).sort();
      const sourceMatch = preamble.match(/(?:^|["\s])((?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+)/i)?.[1];
      const sourceDomain = sourceMatch ? normalizeDomain(sourceMatch) : null;
      const source = normalized.find(row => row.domain === sourceDomain) ?? null;
      const competitors = normalized.filter(row => row.domain !== sourceDomain);
      return { rows: normalized, metrics: { datasetKind: 'share_of_voice', sourceDomain, competitorCount: competitors.length, competitors, sourceShareOfVoice: source?.shareOfVoice ?? null, sourceTop20Keywords: source?.top20Keywords ?? null, sourceTrafficForecast: source?.trafficForecast ?? null, reportStart: dates[0] ?? null, reportEnd: dates.at(-1) ?? null } };
    }
    const domainColumns = rawHeaders.map((header, index) => ({ header: header.trim(), key: headers[index] })).filter(column => /(?:^|\.)[a-z0-9-]+\.[a-z]{2,}$/i.test(column.header));
    if (domainColumns.length >= 2 && !headers.some(header => ['position','currentposition','rank'].includes(header))) {
      const sourceColumn = rawHeaders.length - 1, sourceHeader = rawHeaders[sourceColumn].trim(), sourceKey = headers[sourceColumn], competitorColumns = domainColumns.filter(column => column.key !== sourceKey).map(column => ({ ...column, header: normalizeDomain(column.header) }));
      const keywordRows = rows.filter(row => { const keyword = first(row, ['keyword','query','phrase']).toLowerCase(); return keyword && keyword !== 'general' && !/^google\b/.test(keyword); });
      const matrixRows = keywordRows.flatMap(row => {
        const keyword = first(row, ['keyword','query','phrase']), volume = numeric(first(row, ['volume','search volume','searchvolume','search vol'])), sourcePosition = numeric(row[sourceKey]);
        return competitorColumns.map(column => { const competitorPosition = numeric(row[column.key]); return { keyword, volume, sourceDomainLabel: sourceHeader, sourcePosition, competitor: column.header, competitorPosition, relation: sourcePosition !== null && competitorPosition !== null ? 'shared' : competitorPosition !== null ? 'competitor_only' : sourcePosition !== null ? 'source_only' : 'unranked' }; });
      });
      const competitors = competitorColumns.map(column => {
        const relevant = matrixRows.filter(row => row.competitor === column.header), positioned = relevant.filter(row => row.competitorPosition !== null), shared = relevant.filter(row => row.relation === 'shared');
        return { domain: column.header, candidateType: candidateType(column.header), rankingKeywords: positioned.length, top10Keywords: positioned.filter(row => row.competitorPosition! <= 10).length, averagePosition: positioned.length ? positioned.reduce((sum, row) => sum + row.competitorPosition!, 0) / positioned.length : null, sharedKeywords: shared.length, competitorOnlyKeywords: relevant.filter(row => row.relation === 'competitor_only').length, sourceOnlyKeywords: relevant.filter(row => row.relation === 'source_only').length, competitorWins: shared.filter(row => row.competitorPosition! < row.sourcePosition!).length, sourceWins: shared.filter(row => row.sourcePosition! < row.competitorPosition!).length };
      });
      const dates = (data.slice(0, headerIndex).flat().join(' ').match(/\d{4}-\d{2}-\d{2}/g) ?? []).sort();
      return { rows: matrixRows, metrics: { datasetKind: 'competitor_position_matrix', keywordCount: keywordRows.length, competitorCount: competitors.length, sourceColumn: sourceHeader, competitors, reportStart: dates[0] ?? null, reportEnd: dates.at(-1) ?? null } };
    }
    const latest = datedColumns.at(-1), previous = datedColumns.at(-2);
    const normalized = rows.map(row => ({
      keyword: first(row, ['keyword','query','phrase']),
      url: first(row, ['url','ranking url','landing page','page']),
      position: numeric(first(row, ['position','current position','rank'])) ?? numeric(latest ? row[latest.key] : ''),
      previousPosition: numeric(first(row, ['previous position','previousposition','position previous'])) ?? numeric(previous ? row[previous.key] : ''),
      estimatedTraffic: numeric(first(row, ['traffic','estimated traffic','estimatedtraffic','traffic sum'])),
      volume: numeric(first(row, ['volume','search volume','searchvolume','search vol'])),
      difficulty: numeric(first(row, ['difficulty','keyword difficulty','kd'])),
      trafficValue: numeric(first(row, ['traffic value','traffic cost','cost','price'])),
      clicks: numeric(first(row, ['clicks'])),
      websiteSerpFeatures: first(row, ['website serp features']),
      foundSerpFeatures: first(row, ['found serp features']),
      currentDate: latest?.header ?? '', previousDate: previous?.header ?? ''
    })).filter(row => row.keyword && row.keyword.toLowerCase() !== 'general');
    const positioned = normalized.filter(row => row.position !== null), keywords = new Set(normalized.map(row => row.keyword.toLowerCase()).filter(Boolean));
    const comparable = positioned.filter(row => row.previousPosition !== null), improved = comparable.filter(row => row.position! < row.previousPosition!), declined = comparable.filter(row => row.position! > row.previousPosition!);
    return { rows: normalized, metrics: { keywordCount: keywords.size, averagePosition: positioned.length ? positioned.reduce((sum, row) => sum + row.position!, 0) / positioned.length : null, top10Keywords: positioned.filter(row => row.position! <= 10).length, top100Keywords: positioned.filter(row => row.position! <= 100).length, improvedKeywords: improved.length, declinedKeywords: declined.length, unchangedKeywords: comparable.length - improved.length - declined.length, estimatedTraffic: normalized.reduce((sum, row) => sum + (row.estimatedTraffic ?? 0), 0), trafficValue: normalized.reduce((sum, row) => sum + (row.trafficValue ?? 0), 0), currentPositionDate: latest?.header ?? null, previousPositionDate: previous?.header ?? null, aiOverviewKeywords: normalized.filter(row => /ai overview/i.test(`${row.websiteSerpFeatures} ${row.foundSerpFeatures}`)).length } };
  }
  const normalized = rows.map(row => ({ prompt: first(row, ['prompt','query','question','keyword']), platform: first(row, ['platform','engine','model','llm','source']), citedUrl: first(row, ['cited url','citation url','url','source url']), citation: first(row, ['citation','cited','is cited']), mention: first(row, ['mention','mentioned','brand mention']), position: numeric(first(row, ['position','rank','citation position'])), visibility: numeric(first(row, ['visibility','visibility score','share of voice','ai share of voice','sov'])), sentiment: first(row, ['sentiment','tone']) }));
  const prompts = new Set(normalized.map(row => row.prompt.toLowerCase()).filter(Boolean)), cited = normalized.filter(row => row.citedUrl || /yes|true|1/i.test(row.citation)), mentioned = normalized.filter(row => /yes|true|1/i.test(row.mention) || row.mention.length > 3), visibility = normalized.map(row => row.visibility).filter((value): value is number => value !== null);
  return { rows: normalized, metrics: { promptCount: prompts.size, citationCount: cited.length, citedPromptRate: prompts.size ? cited.length / prompts.size : null, mentionCount: mentioned.length, averageVisibility: visibility.length ? visibility.reduce((sum, value) => sum + value, 0) / visibility.length : null, platforms: [...new Set(normalized.map(row => row.platform).filter(Boolean))] } };
}
