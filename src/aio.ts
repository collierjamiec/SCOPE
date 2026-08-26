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
  directAnswerPairs?: number;
  definitionPassages?: number;
  comparisonStructures?: number;
  attributedQuotes?: number;
  unattributedQuotes?: number;
  numericClaims?: number;
  originalDataClaims?: number;
  vagueClaims?: number;
  recognizablePrimarySources?: number;
  volatileClaims?: number;
  contentAgeDays?: number | null;
  dataRichImages?: number;
  dataRichImagesWithContext?: number;
  hasClaimSchema?: boolean;
  hasDatasetSchema?: boolean;
  hasCitationProperty?: boolean;
  fleschKincaidGrade?: number | null;
  averageWordsPerSentence?: number;
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

  const wordCount = input.text.split(/\s+/).filter(Boolean).length;
  const hasQuestionCoverage = input.questionHeadings.length >= 2;
  const followUpTerms = input.h2s.join(' ').match(/price|cost|compare|alternative|benefit|process|how|why|who|when|requirement|limitation|next step/gi) ?? [];
  let intentCoverage = 0;
  if (wordCount >= 500) intentCoverage += 5;
  if (input.h2s.length >= 3) intentCoverage += 4;
  if (hasQuestionCoverage) intentCoverage += 3;
  if (followUpTerms.length) intentCoverage += 3;
  // Editorial pages can demonstrate broad intent coverage through substantial,
  // well-sectioned treatment without forcing artificial commercial or FAQ headings.
  if (input.h2s.length >= 8) intentCoverage += 2;
  intentCoverage = clamp(intentCoverage, 15);
  const intentEvidence = `${wordCount} words across ${input.h2s.length} H2 sections; ${input.questionHeadings.length} question-led headings; ${followUpTerms.length} explicit follow-up topic signal${followUpTerms.length === 1 ? '' : 's'} in H2s.`;
  const intentRecommendation = wordCount < 500
    ? 'Expand the page only where needed to answer the primary intent with original, useful detail.'
    : input.h2s.length < 3
      ? 'Organize the content into descriptive sections that reflect the reader’s main questions or tasks.'
      : !hasQuestionCoverage && !followUpTerms.length
        ? 'Add a section that directly answers a realistic follow-up question for this specific topic, if the existing sections do not already answer it.'
        : 'Review the page for one material reader question or next step that is not already answered; add it only when it improves the page.';
  indicators.push({ key: 'intent_coverage', label: 'Intent and follow-up coverage', status: intentCoverage >= 11 ? 'pass' : 'opportunity', evidence: intentEvidence, recommendation: intentCoverage < 11 ? intentRecommendation : undefined });

  const freshness = clamp((input.hasPublishedDate ? 2 : 0) + (input.hasModifiedDate ? 2 : 0) + (input.lastModified ? 1 : 0), 5);
  indicators.push({ key: 'freshness', label: 'Freshness signals', status: freshness >= 3 ? 'pass' : 'opportunity', evidence: `Published date ${input.hasPublishedDate ? 'found' : 'not found'}; modified date ${input.hasModifiedDate ? 'found' : 'not found'}; HTTP Last-Modified ${input.lastModified ?? 'not supplied'}.`, recommendation: freshness < 3 ? 'Expose credible published/updated dates and keep sitemap or HTTP freshness signals aligned.' : undefined });

  const altCoverage = input.imageCount ? (input.imageCount - input.imagesMissingAltText) / input.imageCount : 1;
  const multimodal = clamp(altCoverage * 5, 5);
  indicators.push({ key: 'multimodal', label: 'Multimodal accessibility', status: multimodal >= 4 ? 'pass' : 'opportunity', evidence: input.imageCount ? `${input.imageCount - input.imagesMissingAltText} of ${input.imageCount} images have non-empty alt text.` : 'No images detected.', recommendation: multimodal < 4 ? 'Describe informative images accurately and provide text summaries for charts, diagrams, and video.' : undefined });

  const directAnswerPairs = input.directAnswerPairs ?? 0;
  indicators.push({ key: 'answer_shape', label: 'Answer-shaped passages', status: input.questionHeadings.length && !directAnswerPairs ? 'opportunity' : 'pass', evidence: `${directAnswerPairs} question heading${directAnswerPairs === 1 ? '' : 's'} followed by a concise, self-contained answer; ${input.questionHeadings.length} question-led headings total.`, recommendation: input.questionHeadings.length && !directAnswerPairs ? 'Answer the question immediately in a clear standalone passage, then expand naturally for the reader. Do not sacrifice useful human context merely to shorten the answer.' : undefined });

  const definitionPassages = input.definitionPassages ?? 0, comparisonStructures = input.comparisonStructures ?? 0;
  const expectsDefinition = /\bwhat (?:is|are|does)|definition|meaning\b/i.test(`${input.title} ${input.h1s.join(' ')}`), expectsComparison = /\b(?:vs\.?|versus|compare|comparison|difference|alternatives?)\b/i.test(`${input.title} ${input.h1s.join(' ')} ${input.h2s.join(' ')}`);
  indicators.push({ key: 'definition_comparison', label: 'Definition and comparison clarity', status: (expectsDefinition && !definitionPassages) || (expectsComparison && !comparisonStructures) ? 'opportunity' : 'pass', evidence: `${definitionPassages} definition passage${definitionPassages === 1 ? '' : 's'} and ${comparisonStructures} comparison structure${comparisonStructures === 1 ? '' : 's'} detected.`, recommendation: expectsDefinition && !definitionPassages ? 'State the core definition plainly near the relevant heading, using language that remains natural and useful to a person.' : expectsComparison && !comparisonStructures ? 'Make the decision criteria and meaningful differences explicit; use a table or list only when it improves comprehension.' : undefined });

  const attributedQuotes = input.attributedQuotes ?? 0, unattributedQuotes = input.unattributedQuotes ?? 0;
  indicators.push({ key: 'expert_attribution', label: 'Named expert attribution', status: unattributedQuotes > 0 ? 'opportunity' : 'pass', evidence: `${attributedQuotes} explicitly attributed quote${attributedQuotes === 1 ? '' : 's'} and ${unattributedQuotes} unattributed block quote${unattributedQuotes === 1 ? '' : 's'} detected.`, recommendation: unattributedQuotes ? 'Identify the quoted person and relevant credential in visible copy when that attribution is accurate and useful.' : undefined });

  const numericClaims = input.numericClaims ?? 0, originalDataClaims = input.originalDataClaims ?? 0, vagueClaims = input.vagueClaims ?? 0;
  indicators.push({ key: 'numerical_specificity', label: 'Numerical specificity', status: vagueClaims ? 'opportunity' : 'pass', evidence: `${numericClaims} quantitative claim${numericClaims === 1 ? '' : 's'}, including ${originalDataClaims} possible site-original data claim${originalDataClaims === 1 ? '' : 's'}; ${vagueClaims} vague outcome statement${vagueClaims === 1 ? '' : 's'} without a number.`, recommendation: vagueClaims ? 'Where verified measurements exist, replace vague outcome language with the exact value, denominator, period, and methodology. Never invent precision.' : undefined });

  const recognizablePrimarySources = input.recognizablePrimarySources ?? 0;
  indicators.push({ key: 'source_provenance', label: 'Citation source proximity', status: input.citedClaimCount > 0 && recognizablePrimarySources === 0 ? 'opportunity' : 'pass', evidence: `${input.citedClaimCount} citation-adjacent numeric claim${input.citedClaimCount === 1 ? '' : 's'} and ${recognizablePrimarySources} link${recognizablePrimarySources === 1 ? '' : 's'} to a recognizable primary-source destination or persistent research identifier.`, recommendation: input.citedClaimCount > 0 && !recognizablePrimarySources ? 'Review citations and link to the original study, dataset, government source, or persistent identifier when available. SCOPE cannot prove source primacy from the page alone.' : undefined });

  const volatileClaims = input.volatileClaims ?? 0, datedEnough = input.contentAgeDays !== null && input.contentAgeDays !== undefined && input.contentAgeDays <= 365;
  indicators.push({ key: 'volatile_fact_freshness', label: 'Volatile-fact freshness', status: volatileClaims && !datedEnough ? 'opportunity' : 'pass', evidence: `${volatileClaims} potentially time-sensitive quantitative claim${volatileClaims === 1 ? '' : 's'}; content age ${input.contentAgeDays === null || input.contentAgeDays === undefined ? 'not established' : `${input.contentAgeDays} days`}.`, recommendation: volatileClaims && !datedEnough ? 'Verify time-sensitive figures, show the applicable period and source, and update the visible date only when the content was materially reviewed.' : undefined });

  const dataRichImages = input.dataRichImages ?? 0, dataRichImagesWithContext = input.dataRichImagesWithContext ?? 0;
  indicators.push({ key: 'multimodal_citation', label: 'Data-rich image context', status: dataRichImages > dataRichImagesWithContext ? 'opportunity' : 'pass', evidence: `${dataRichImagesWithContext} of ${dataRichImages} detected charts, graphs, infographics, or data images have descriptive alt text or a useful caption.`, recommendation: dataRichImages > dataRichImagesWithContext ? 'Add a human-readable caption or nearby text explaining what the visual shows; alt text should convey the useful result without keyword stuffing.' : undefined });

  const schemaEvidence = originalDataClaims || input.citedClaimCount;
  indicators.push({ key: 'claim_schema_support', label: 'Structured citation support', status: schemaEvidence && !input.hasClaimSchema && !input.hasDatasetSchema && !input.hasCitationProperty ? 'opportunity' : 'pass', evidence: `${originalDataClaims} possible original-data claim${originalDataClaims === 1 ? '' : 's'}; Claim schema ${input.hasClaimSchema ? 'present' : 'not detected'}, Dataset schema ${input.hasDatasetSchema ? 'present' : 'not detected'}, citation property ${input.hasCitationProperty ? 'present' : 'not detected'}.`, recommendation: schemaEvidence && !input.hasClaimSchema && !input.hasDatasetSchema && !input.hasCitationProperty ? 'If the page genuinely publishes a dataset or a clearly scoped factual claim, review Dataset or Claim markup; for cited CreativeWork content, consider the citation property. These Schema.org signals are contextual descriptions, not guaranteed rich results or AI citations.' : undefined });

  const difficult = (input.fleschKincaidGrade ?? 0) > 14 || (input.averageWordsPerSentence ?? 0) > 30;
  indicators.push({ key: 'human_first', label: 'Human-first readability guardrail', status: difficult ? 'opportunity' : 'pass', evidence: `Grade level ${input.fleschKincaidGrade ?? 'not available'}; average sentence length ${input.averageWordsPerSentence ?? 'not available'} words.`, recommendation: difficult ? 'Improve clarity for the intended human audience before optimizing passage structure. Reject machine-oriented formatting that makes the page repetitive, fragmented, or less useful.' : undefined });

  const score = accessibility + extractability + evidence + entityClarity + intentCoverage + freshness + multimodal;
  const label = score >= 85 ? 'strong' : score >= 70 ? 'generally_ready' : score >= 50 ? 'partial' : 'significant_barriers';
  return { score, label, dimensions: { accessibility, extractability, evidence, entityClarity, intentCoverage, freshness, multimodal }, questionsDetected: input.questionHeadings.slice(0, 12), answerPassages, indicators, advancedSignals: { directAnswerPairs, definitionPassages, comparisonStructures, attributedQuotes, unattributedQuotes, numericClaims, originalDataClaims, vagueClaims, recognizablePrimarySources, volatileClaims, dataRichImages, dataRichImagesWithContext }, visibilityMeasured: false };
}
