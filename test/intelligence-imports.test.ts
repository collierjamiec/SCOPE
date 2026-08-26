import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIntelligenceCsv } from '../src/intelligence-imports.js';

test('normalizes competitive SEO exports without calling estimates first-party traffic', () => {
  const result = parseIntelligenceCsv('Keyword,Position,URL,Estimated Traffic,Search Volume\nseo audit,4,https://competitor.test/a,120,1000\nwebsite crawler,12,https://competitor.test/b,40,500', 'competitive_seo');
  assert.equal(result.metrics.keywordCount, 2);
  assert.equal(result.metrics.top10Keywords, 1);
  assert.equal(result.metrics.estimatedTraffic, 160);
});

test('normalizes AI visibility exports across prompt and citation fields', () => {
  const result = parseIntelligenceCsv('Prompt,Platform,Citation URL,Mention,Share of Voice\nbest seo tool,ChatGPT,https://example.test/,yes,24\nseo crawler,Google AI Overviews,,,10', 'ai_visibility');
  assert.equal(result.metrics.promptCount, 2);
  assert.equal(result.metrics.citationCount, 1);
  assert.equal(result.metrics.mentionCount, 1);
  assert.deepEqual(result.metrics.platforms, ['ChatGPT', 'Google AI Overviews']);
});

test('parses SE Ranking detailed exports with metadata and dated position columns', () => {
  const csv = '"Google USA, interface language: English"\nKeyword,URL,"Content Score","Search vol.","Website SERP Features","Found SERP Features",Clicks,2026-08-25,2026-08-26\nGeneral,--,,11880,"AI Overview","Sitelinks, AI Overview",,85,85\n"queer resilience",https://example.test/,-,90,"AI Overview","People also ask, AI Overview",0,49,48\n"queer healing",https://example.test/healing,-,40,,,2,18,12';
  const result = parseIntelligenceCsv(csv, 'competitive_seo');
  assert.equal(result.metrics.keywordCount, 2);
  assert.equal(result.metrics.currentPositionDate, '2026-08-26');
  assert.equal(result.metrics.previousPositionDate, '2026-08-25');
  assert.equal(result.metrics.improvedKeywords, 2);
  assert.equal(result.metrics.aiOverviewKeywords, 1);
  assert.equal(result.rows[0].volume, 90);
  assert.equal(result.rows[0].position, 48);
});

test('parses SE Ranking history exports using the latest two dated columns', () => {
  const csv = '"Google USA, interface language: English"\nKeyword,Url,"Search vol.",2026-07-27,Dynamics,URL,2026-08-26,Dynamics,URL\n"queer healing",,40,67,-47,https://example.test/resources/,18,49,https://example.test/healing/';
  const result = parseIntelligenceCsv(csv, 'competitive_seo');
  assert.equal(result.rows[0].previousPosition, 67);
  assert.equal(result.rows[0].position, 18);
  assert.equal(result.rows[0].url, 'https://example.test/healing/');
});

test('parses SE Ranking competitor position matrices as modeled competitive evidence', () => {
  const csv = 'qu_competitors_overall_2026-07-26--2026-08-26\nKeyword,"Search vol.",www.competitor.test,another.test,qu\n"Google USA",37100,99,98,79\nGeneral,11880,99,97,85\n"queer resilience",90,11,-,48\n"queer healing",40,8,22,18\n"queer community",100,26,9,-';
  const result = parseIntelligenceCsv(csv, 'competitive_seo');
  assert.equal(result.metrics.datasetKind, 'competitor_position_matrix');
  assert.equal(result.metrics.keywordCount, 3);
  assert.equal(result.metrics.competitorCount, 2);
  assert.deepEqual(result.metrics.competitors[0], { domain: 'competitor.test', candidateType: 'market_candidate', rankingKeywords: 3, top10Keywords: 1, averagePosition: 15, sharedKeywords: 2, competitorOnlyKeywords: 1, sourceOnlyKeywords: 0, competitorWins: 2, sourceWins: 0 });
});

test('parses SE Ranking Share of Voice exports and separates the source domain', () => {
  const csv = '"source.test, Google USA, 2026-08-25 - 2026-08-26"\nDomain,"URLs in the Top 20",Dynamics,"Keywords in the Top 20",Dynamics,"Share of Voice",Dynamics,"Traffic forecast",Dynamics\nwww.competitor.test,2,0,11,1,17.46,-1.07,3987.84,-36.05\nsource.test,13,0,37,8,0.17,0.01,38.13,3.65\n\n"Other competitors"\nDomain,"Share of Voice",Dynamics,"Traffic forecast",Dynamics\n1415,18,-1.91,4110.68,-213.3';
  const result = parseIntelligenceCsv(csv, 'competitive_seo');
  assert.equal(result.metrics.datasetKind, 'share_of_voice');
  assert.equal(result.metrics.sourceDomain, 'source.test');
  assert.equal(result.metrics.sourceShareOfVoice, 0.17);
  assert.equal(result.metrics.competitorCount, 1);
  assert.deepEqual(result.metrics.competitors[0], { domain: 'competitor.test', top20Urls: 2, top20Keywords: 11, shareOfVoice: 17.46, trafficForecast: 3987.84, candidateType: 'market_candidate' });
});

test('labels broad platforms separately from market competitor candidates', () => {
  const csv = '"source.test, Google USA, 2026-08-25 - 2026-08-26"\nDomain,"URLs in the Top 20",Dynamics,"Keywords in the Top 20",Dynamics,"Share of Voice",Dynamics,"Traffic forecast",Dynamics\nwww.instagram.com,2,0,11,1,17.46,-1.07,3987.84,-36.05\nsource.test,13,0,37,8,0.17,0.01,38.13,3.65';
  const result = parseIntelligenceCsv(csv, 'competitive_seo');
  assert.equal(result.metrics.competitors[0].candidateType, 'platform_or_reference');
});
