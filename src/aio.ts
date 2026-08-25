import type { AioAssessment, AioIndicator } from './types.js';

export interface AioInput {
  title: string;
  metaDescription: string;
  h1s: string[];
  h2s: string[];
  text: string;
  robotsDirectives: string[];
  schemaTypes: string[];
  externalLinkCount: number;
  imageCount: number;
  imagesMissingAltText: number;
  hasAuthor: boolean;
  hasPublishedDate: boolean;
  hasModifiedDate: boolean;
  lastModified: string | null;
  listCount: number;
  tableCount: number;
  questionHeadings: string[];
  citedClaimCount: number;
}

const clamp = (value: number, maximum: number) => Math.max(0, Math.min(maximum, Math.round(value)));

export function assessAio(input: AioInput): AioAssessment {
  const indicators: AioIndicator[] = [];
  const blockedSnippet = input.robotsDirectives.includes('nosnippet') || input.robotsDirectives.some(rule => /^max-snippet:0$/.test(rule));
  const firstPassage = input.text.split(/(?<=[.!?])\s+/).find(sentence => sentence.length >= 45 && sentence.length <= 320) ?? '';
  const answerPassages = input.text.split(/(?<=[.!?])\s+/).filter(sentence => sentence.length >= 45 && sentence.length <= 320).slice(0, 5);
  const accessibility = blockedSnippet ? 4 : 20;
  indicators.push({ key: 'snippet_access', label: 'AI/snippet reuse controls', status: blockedSnippet ? 'blocked' : 'pass', evidence: blockedSnippet ? 'nosnippet or max-snippet:0 restricts reusable answer text.' : 'No page-level directive blocks normal snippet extraction.', recommendation: blockedSnippet ? 'Review whether restrictive snippet controls are intentional.' : undefined });

  let extractability = 0;
  if (firstPassage) extractability += 6;
  if (input.h2s.length >= 2) extractability += 5;
  if (input.questionHeadings.length) extractability += 4;
  if (input.listCount || input.tableCount) extractability += 5;
  extractability = clamp(extractability, 20);
  indicators.push({ key: 'answer_extractability', label: 'Answer extractability', status: extractability >= 14 ? 'pass' : 'opportunity', evidence: `${input.h2s.length} H2s, ${input.questionHeadings.length} question headings, ${input.listCount} lists, and ${input.tableCount} tables detected.`, recommendation: extractability < 14 ? 'Add descriptive question-led sections, concise direct answers, and scannable lists or tables where appropriate.' : undefined });

  let evidence = 0;
  if (input.externalLinkCount) evidence += 5;
  if (input.citedClaimCount) evidence += 5;
  if (input.hasAuthor) evidence += 5;
  if (input.hasPublishedDate || input.hasModifiedDate) evidence += 5;
  evidence = clamp(evidence, 20);
  indicators.push({ key: 'evidence', label: 'Evidence and citation readiness', status: evidence >= 15 ? 'pass' : 'opportunity', evidence: `${input.externalLinkCount} external sources, ${input.citedClaimCount} citation-adjacent numeric claims; author ${input.hasAuthor ? 'present' : 'not detected'}; date ${input.hasPublishedDate || input.hasModifiedDate ? 'present' : 'not detected'}.`, recommendation: evidence < 15 ? 'Add named authorship, visible dates, primary-source citations, and support for quantitative claims.' : undefined });

  let entityClarity = 0;
  if (input.title && input.h1s.length) entityClarity += 6;
  if (input.schemaTypes.length) entityClarity += 5;
  if (input.metaDescription) entityClarity += 2;
  if (/organization|service|product|person|localbusiness|article/i.test(input.schemaTypes.join(' '))) entityClarity += 2;
  entityClarity = clamp(entityClarity, 15);
  indicators.push({ key: 'entity_clarity', label: 'Entity and semantic clarity', status: entityClarity >= 11 ? 'pass' : 'opportunity', evidence: `${input.schemaTypes.length ? `Schema types: ${input.schemaTypes.join(', ')}` : 'No declared schema types'}; title/H1 alignment ${input.title && input.h1s.length ? 'available' : 'incomplete'}.`, recommendation: entityClarity < 11 ? 'Clarify the principal organization, service, product, person, or place in visible copy and matching structured data.' : undefined });

  let intentCoverage = 0;
  if (input.text.split(/\s+/).length >= 500) intentCoverage += 5;
  if (input.h2s.length >= 3) intentCoverage += 4;
  if (input.questionHeadings.length >= 2) intentCoverage += 3;
  if (/price|cost|compare|alternative|benefit|process|how|why|who|when|requirement/i.test(input.h2s.join(' '))) intentCoverage += 3;
  intentCoverage = clamp(intentCoverage, 15);
  indicators.push({ key: 'intent_coverage', label: 'Intent and follow-up coverage', status: intentCoverage >= 11 ? 'pass' : 'opportunity', evidence: `${input.text.split(/\s+/).filter(Boolean).length} words across ${input.h2s.length} H2 sections.`, recommendation: intentCoverage < 11 ? 'Cover likely follow-up questions, decision criteria, limitations, alternatives, process, and next steps.' : undefined });

  const freshness = clamp((input.hasPublishedDate ? 2 : 0) + (input.hasModifiedDate ? 2 : 0) + (input.lastModified ? 1 : 0), 5);
  indicators.push({ key: 'freshness', label: 'Freshness signals', status: freshness >= 3 ? 'pass' : 'opportunity', evidence: `Published date ${input.hasPublishedDate ? 'found' : 'not found'}; modified date ${input.hasModifiedDate ? 'found' : 'not found'}; HTTP Last-Modified ${input.lastModified ?? 'not supplied'}.`, recommendation: freshness < 3 ? 'Expose credible published/updated dates and keep sitemap or HTTP freshness signals aligned.' : undefined });

  const altCoverage = input.imageCount ? (input.imageCount - input.imagesMissingAltText) / input.imageCount : 1;
  const multimodal = clamp(altCoverage * 5, 5);
  indicators.push({ key: 'multimodal', label: 'Multimodal accessibility', status: multimodal >= 4 ? 'pass' : 'opportunity', evidence: input.imageCount ? `${input.imageCount - input.imagesMissingAltText} of ${input.imageCount} images have non-empty alt text.` : 'No images detected.', recommendation: multimodal < 4 ? 'Describe informative images accurately and provide text summaries for charts, diagrams, and video.' : undefined });

  const score = accessibility + extractability + evidence + entityClarity + intentCoverage + freshness + multimodal;
  const label = score >= 85 ? 'strong' : score >= 70 ? 'generally_ready' : score >= 50 ? 'partial' : 'significant_barriers';
  return { score, label, dimensions: { accessibility, extractability, evidence, entityClarity, intentCoverage, freshness, multimodal }, questionsDetected: input.questionHeadings.slice(0, 12), answerPassages, indicators, visibilityMeasured: false };
}
