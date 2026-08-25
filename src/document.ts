import {
  AlignmentType, BorderStyle, Document, HeadingLevel,
  Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType
} from 'docx';
import type { AuditReport, Finding, PageResult } from './types.js';

const BLUE = '2E74B5';
const DARK_BLUE = '1F4D78';
const NAVY = '0B2545';
const MUTED = '667085';
const LIGHT = 'F2F4F7';
const PALE_BLUE = 'E8EEF5';
const RED = '9B1C1C';
const GOLD = '7A5A00';
const GREEN = '246B45';
const TABLE_WIDTH = 9360;

function text(value: unknown): string {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function clip(value: string, max = 1500): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function dateLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
}

function tableCell(value: unknown, width: number, options: { bold?: boolean; fill?: string; color?: string; center?: boolean } = {}): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: options.fill ? { fill: options.fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: 'center',
    children: [new Paragraph({
      alignment: options.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { before: 0, after: 0, line: 260 },
      children: [new TextRun({ text: clip(text(value)), bold: options.bold, color: options.color, size: 19, font: 'Arial' })]
    })]
  });
}

function dataTable(headers: string[], rows: unknown[][], widths: number[]): Table {
  const borders = { style: BorderStyle.SINGLE, size: 2, color: 'D0D5DD' };
  return new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    layout: 'fixed',
    borders: { top: borders, bottom: borders, left: borders, right: borders, insideHorizontal: borders, insideVertical: borders },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((header, index) => tableCell(header, widths[index], { bold: true, fill: LIGHT, color: NAVY })) }),
      ...rows.map(row => new TableRow({ children: row.map((value, index) => tableCell(value, widths[index])) }))
    ]
  });
}

function heading(value: string, level: 1 | 2 | 3, pageBreakBefore = false): Paragraph {
  const headingLevel = level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
  return new Paragraph({ text: value, heading: headingLevel, keepNext: true, pageBreakBefore });
}

function body(value: string, options: { boldLabel?: string; color?: string } = {}): Paragraph {
  const children: TextRun[] = [];
  if (options.boldLabel) children.push(new TextRun({ text: `${options.boldLabel}: `, bold: true, color: NAVY }));
  children.push(new TextRun({ text: value, color: options.color }));
  return new Paragraph({ spacing: { after: 120, line: 264 }, children });
}

function bullet(value: string, level = 0): Paragraph {
  return new Paragraph({ text: value, numbering: { reference: 'audit-bullets', level }, spacing: { after: 80, line: 280 } });
}

function horizontalRule(): Paragraph {
  return new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, color: 'D0D5DD', size: 5, space: 1 } }, spacing: { before: 120, after: 120 } });
}

function domainLinkRows(report: AuditReport, internal: boolean): Array<[string, string]> {
  const grouped = new Map<string, { anchor: string; destination: string; occurrences: number }>();
  const social = (url: string) => { try { return /(?:facebook\.com|reddit\.com|bsky\.app|threads\.net|twitter\.com|x\.com|linkedin\.com|pinterest\.com)/i.test(new URL(url).hostname); } catch { return false; } };
  for (const link of report.pages.flatMap(page => page.links).filter(item => item.internal === internal && !/^skip (?:to )?(?:main )?content$/i.test(item.text) && !social(item.url))) {
    const anchor = link.text || '[No accessible name]';
    const key = `${anchor}\u0000${link.url}`;
    const current = grouped.get(key) ?? { anchor, destination: link.url, occurrences: 0 };
    current.occurrences += 1;
    grouped.set(key, current);
  }
  return [...grouped.values()]
    .sort((a, b) => a.destination.localeCompare(b.destination) || a.anchor.localeCompare(b.anchor))
    .map(item => [`${item.anchor} (${item.occurrences}×)`, item.destination]);
}

function pairedLinkTable(rows: Array<[string, string]>): Table {
  const paired: unknown[][] = [];
  for (let index = 0; index < rows.length; index += 2) {
    paired.push([rows[index][0], rows[index][1], rows[index + 1]?.[0] ?? '', rows[index + 1]?.[1] ?? '']);
  }
  return dataTable(['Anchor (occurrences)', 'Destination', 'Anchor (occurrences)', 'Destination'], paired, [1800, 2880, 1800, 2880]);
}

function severityColor(severity: Finding['severity']): string {
  return severity === 'critical' ? RED : severity === 'warning' ? GOLD : BLUE;
}

function pageSection(page: PageResult, index: number, config: AuditReport['config']): Array<Paragraph | Table> {
  const children: Array<Paragraph | Table> = [
    heading(`${index + 1}. ${page.title || 'Untitled page'}`, 2),
    body(page.url, { boldLabel: 'URL' }),
    dataTable(
      ['Measurement', 'Value', 'Measurement', 'Value'],
      [
        ['HTTP / response', `${page.status} / ${page.responseTimeMs ?? 'n/a'} ms`, 'Redirect hops', page.redirectChain.length ? page.redirectChain.length - 1 : 0],
        ['Title length', `${page.titleCharacters} characters`, 'Description length', `${page.metaDescriptionCharacters} characters`],
        ['Content', `${page.wordCount.toLocaleString()} words`, 'Headings', `${page.h1s.length} H1 / ${page.h2s.length} H2`],
        ['Readability', `Grade ${page.contentMetrics.fleschKincaidGrade ?? 'n/a'} / ease ${page.contentMetrics.fleschReadingEase ?? 'n/a'}`, 'Reading time', `${page.contentMetrics.readingTimeMinutes} minutes`],
        ['Sentences / paragraphs', `${page.contentMetrics.sentenceCount} / ${page.contentMetrics.paragraphCount}`, 'Text / HTML ratio', `${page.contentMetrics.textToHtmlRatio}%`],
        ['Unique links', `${page.internalLinkCount} internal / ${page.externalLinkCount} external`, 'Incoming / depth', `${page.incomingInternalLinks} / ${page.clickDepth ?? 'unreachable'}${page.orphan ? ' (orphan)' : ''}`],
        ['Images', `${page.imageCount} total / ${page.imagesMissingAltText} missing alt text`, 'Language / viewport', `${page.htmlLang ?? 'missing'} / ${page.hasViewportMeta ? 'present' : 'missing'}`],
        ['Canonical', page.canonical ?? 'Missing', 'Canonical match', page.canonicalMatchesUrl === null ? 'n/a' : page.canonicalMatchesUrl ? 'Yes' : 'No']
      ],
      [1750, 2930, 1750, 2930]
    ),
    body(page.title || 'Missing', { boldLabel: 'SEO title' }),
    body(page.metaDescription || 'Missing', { boldLabel: 'Meta description' }),
    body(page.h1s.join(' | ') || 'Missing', { boldLabel: 'H1' }),
    body(page.h2s.join(' | ') || 'None detected', { boldLabel: 'H2s' }),
    body(page.primaryCta ? `${page.primaryCta.text} → ${page.primaryCta.url} (${Math.round(page.primaryCta.confidence * 100)}% confidence)` : 'Not confidently detected', { boldLabel: 'Primary CTA' })
  ];
  if (config.analyzeSchema !== false) {
    children.push(heading('Detected Schema JSON-LD', 3));
    if (!page.schemas.length) children.push(body('None detected.'));
    for (const schema of page.schemas) {
      children.push(body(schema.validJson ? `Valid: ${schema.types.join(', ') || 'Type not declared'}` : `Invalid JSON: ${schema.error ?? 'Unable to parse'}`));
      for (const issue of schema.validationIssues ?? []) children.push(bullet(`Structured-data property issue: ${issue}. Add the property only when it is supported by visible page content.`));
    }
    children.push(horizontalRule(), heading('Suggested Schema', 3));
    if (!page.suggestedSchemas?.length) children.push(body('No additional schema type was confidently suggested from the visible page content.'));
    else for (const schema of page.suggestedSchemas) children.push(bullet(`${schema.type} (${schema.confidence} confidence) — ${schema.reason}`));
  }
  if (page.aio) {
    children.push(heading(`AIO Answer Readiness — ${page.aio.score}/100`, 3));
    children.push(body(`Readiness: ${page.aio.label.replaceAll('_', ' ')}. AI visibility is not measured without platform citation or referral data.`));
    children.push(dataTable(
      ['Access', 'Extractability', 'Evidence', 'Entity clarity', 'Intent coverage', 'Freshness', 'Multimodal'],
      [[page.aio.dimensions.accessibility, page.aio.dimensions.extractability, page.aio.dimensions.evidence, page.aio.dimensions.entityClarity, page.aio.dimensions.intentCoverage, page.aio.dimensions.freshness, page.aio.dimensions.multimodal]],
      [950, 1650, 1150, 1350, 1450, 1200, 1610]
    ));
    for (const indicator of page.aio.indicators.filter(item => item.status !== 'pass')) children.push(bullet(`${indicator.label}: ${indicator.recommendation ?? indicator.evidence}`));
  }
  if (page.pageSpeed.length) {
    const speed = page.pageSpeed[0];
    children.push(body(speed.error ? `Unavailable - ${speed.error}` : `Performance ${score(speed.performance)}; Accessibility ${score(speed.accessibility)}; Best Practices ${score(speed.bestPractices)}; SEO ${score(speed.seo)}`, { boldLabel: 'PageSpeed mobile' }));
  }
  if (config.analyzeImages !== false && page.imageRecommendations?.length) {
    children.push(heading('Image optimization recommendations', 3));
    children.push(body('Suggestions marked “page context” infer the image subject from nearby copy and page targets. “Vision” means a configured image-analysis service inspected the image itself. Decorative images may correctly retain empty alt text.'));
    children.push(dataTable(
      ['Current image', 'Issue / basis', 'Suggested filename', 'Suggested alt text'],
      page.imageRecommendations.map(image => [image.currentFilename, `${image.issue.replaceAll('_', ' ')} / ${image.basis.replace('_', ' ')}`, image.suggestedFilename, image.suggestedAlt]),
      [1700, 1600, 2500, 3560]
    ));
  }
  children.push(heading('Findings', 3));
  if (!page.findings.length) children.push(body('No rule-based issues were identified.'));
  for (const finding of page.findings) {
    children.push(new Paragraph({
      numbering: { reference: 'audit-bullets', level: 0 }, spacing: { after: 80, line: 280 },
      children: [
        new TextRun({ text: `[${finding.severity.toUpperCase()}] `, bold: true, color: severityColor(finding.severity) }),
        new TextRun({ text: `${finding.message}${finding.evidence ? ` Evidence: ${clip(finding.evidence, 350)}` : ''}` })
      ]
    }));
  }
  return children;
}

function score(value: number | null): string {
  return value === null ? 'n/a' : String(Math.round(value * 100));
}

export function auditDocumentFilename(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `SCOPE-Audit-${get('month')}-${get('day')}-${get('year')}.docx`;
}

export async function createAuditDocument(report: AuditReport): Promise<Buffer> {
  const now = new Date(report.generatedAt);
  const critical = report.pages.flatMap(page => page.findings).filter(finding => finding.severity === 'critical').length;
  const warnings = report.pages.flatMap(page => page.findings).filter(finding => finding.severity === 'warning').length;
  const ranked = report.keywords.filter(keyword => keyword.ranking).length;
  const duplicateGroups = (values: string[]) => {
    const counts = new Map<string, number>();
    for (const value of values.filter(Boolean)) counts.set(value.toLowerCase(), (counts.get(value.toLowerCase()) ?? 0) + 1);
    return [...counts.values()].filter(count => count > 1).length;
  };
  const average = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  const orphanCandidates = report.summary.orphanPages ?? report.pages.filter(page => page.orphan).length;
  const aioPages = report.pages.filter(page => page.aio);
  const averageAio = average(aioPages.map(page => page.aio.score));
  const keywordPosition = (keyword: AuditReport['keywords'][number]) => keyword.searchConsole?.position ?? keyword.ranking?.position ?? null;
  const documentKeywords = [...report.keywords].sort((a, b) => Number(Boolean(b.searchConsole)) - Number(Boolean(a.searchConsole))
    || (keywordPosition(a) ?? Number.POSITIVE_INFINITY) - (keywordPosition(b) ?? Number.POSITIVE_INFINITY)
    || a.keyword.localeCompare(b.keyword));
  const ga4Pages = report.pages.filter(page => page.analytics).sort((a, b) => b.analytics!.sessions - a.analytics!.sessions || a.url.localeCompare(b.url));
  const periodText = (range: AuditReport['importedData']['gscDateRange'] | AuditReport['importedData']['ga4DateRange'] | undefined, unavailable: string) => range ? `${range.start && range.end ? `${range.start} through ${range.end}` : range.label} (${range.source})` : unavailable;
  const historyUrl = report.historyRunId ? `http://127.0.0.1:4173/trends?run=${encodeURIComponent(report.historyRunId)}` : '';
  const children: Array<Paragraph | Table> = [
    new Paragraph({ spacing: { before: 320, after: 80 }, children: [new TextRun({ text: 'SCOPE WEBSITE AUDIT', bold: true, size: 46, color: NAVY, font: 'Arial' })] }),
    new Paragraph({ spacing: { after: 260 }, children: [new TextRun({ text: report.domain, size: 28, color: MUTED, font: 'Arial' })] }),
    body(dateLabel(now), { boldLabel: 'Audit date' }),
    body('Search & Content Optimization Performance Engine — created by Jamie C. Collier', { boldLabel: 'SCOPE' }),
    body(`${report.summary.indexablePagesAnalyzed} indexable pages analyzed; ${report.summary.excludedNonIndexable} URLs excluded`, { boldLabel: 'Scope' }),
    body(ranked ? `${ranked} keyword rankings returned by the configured provider` : 'No licensed SERP provider configured; rankings are unavailable', { boldLabel: 'Ranking coverage' }),
    new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, color: BLUE, size: 12, space: 1 } }, spacing: { after: 260 } }),
    heading('Executive summary', 1),
    dataTable(
      ['Indexable pages', 'Keywords', 'Critical', 'Warnings', 'Cannibalization'],
      [[report.summary.indexablePagesAnalyzed, report.summary.keywordsIdentified, critical, warnings, report.cannibalization.length]],
      [1900, 1800, 1700, 1700, 2260]
    ),
    body(`${report.partial ? 'PARTIAL REPORT: The crawl was cancelled by the user; findings cover only pages completed before cancellation. ' : ''}This report separates observed crawl evidence from inferred keyword relevance. When no SERP provider is configured, keyword positions remain unavailable and cannibalization flags indicate overlapping on-page targeting rather than proven ranking overlap.`),
    body(`Imported data: ${report.importedData.gscRows} GSC row(s) and ${report.importedData.ga4Rows} GA4 row(s).${report.importedData.gscAveragePosition !== undefined ? ` Impression-weighted average GSC position: ${report.importedData.gscAveragePosition.toFixed(1)}.` : ''}${report.importedData.gscProperty ? ` Search Console property: ${report.importedData.gscProperty}.` : ''} GSC reporting period: ${periodText(report.importedData.gscDateRange, 'unavailable')}. GA4 reporting period: ${periodText(report.importedData.ga4DateRange, 'unavailable')}. Uploaded exports are processed locally; Google credentials and tokens are never retained in report configuration or output files.`),
    heading('Prioritized action roadmap', 1),
    body('Priority combines issue severity and the number of affected pages. Effort is an implementation estimate and should be validated against the site platform.'),
    dataTable(
      ['Rank', 'Impact', 'Effort', 'Area', 'Affected', 'Recommended action'],
      report.priorities.map(item => [item.rank, item.impact, item.effort, item.area, item.affectedPages, `${item.recommendation}${historyUrl ? ` View retained run: ${historyUrl}` : ''}`]),
      [850, 1000, 1000, 900, 1050, 4560]
    ),
    heading('AIO Answer Readiness', 1),
    body(`Average readiness score: ${averageAio}/100 across ${aioPages.length} analyzed pages. This measures technical and content readiness—not verified inclusion, ranking, or citation in an AI answer.`),
    dataTable(
      ['AI crawler', 'Starting-page access', 'Interpretation'],
      (report.aiCrawlerAccess ?? []).map(item => [item.crawler, item.allowed ? 'Allowed' : 'Blocked', item.note]),
      [1800, 1900, 5660]
    ),
    body('Score weights: crawler/snippet accessibility 20; answer extractability 20; evidence and citation readiness 20; entity clarity 15; intent coverage 15; freshness 5; multimodal accessibility 5.'),
    heading('Domain SEO measurements', 1),
    dataTable(
      ['Measurement', 'Value', 'Measurement', 'Value'],
      [
        ['Duplicate title groups', duplicateGroups(report.pages.map(page => page.title)), 'Duplicate description groups', duplicateGroups(report.pages.map(page => page.metaDescription))],
        ['Missing titles / descriptions', `${report.pages.filter(page => !page.title).length} / ${report.pages.filter(page => !page.metaDescription).length}`, 'Missing H1 / canonical', `${report.pages.filter(page => !page.h1s.length).length} / ${report.pages.filter(page => !page.canonical).length}`],
        ['Confirmed orphan pages', `${orphanCandidates} / ${report.pages.length} (${report.pages.length ? (orphanCandidates / report.pages.length * 100).toFixed(1) : '0.0'}%)${orphanCandidates >= report.pages.length * .9 ? ' — suspicious; verify crawl graph' : ''}`, 'Pages with valid JSON-LD', `${report.pages.filter(page => page.schemas.some(schema => schema.validJson)).length} / ${report.pages.length}`],
        ['Average word count', average(report.pages.map(page => page.wordCount)), 'Average response time', `${average(report.pages.map(page => page.responseTimeMs ?? 0).filter(Boolean))} ms`],
        ['Images missing alt text', report.pages.reduce((sum, page) => sum + (page.imagesMissingAltText ?? 0), 0), 'Canonical mismatches', report.pages.filter(page => page.canonicalMatchesUrl === false).length],
        ['Average click depth', report.summary.averageClickDepth?.toFixed(1) ?? 'n/a', 'Near-duplicate groups', report.summary.nearDuplicateGroups ?? 0],
        ['Appropriate schema coverage', report.summary.schemaCoveragePercent === null || report.summary.schemaCoveragePercent === undefined ? 'n/a' : `${report.summary.schemaCoveragePercent.toFixed(1)}%`, 'Crawlable/indexable rate', report.summary.crawlableIndexableRate === null || report.summary.crawlableIndexableRate === undefined ? 'n/a' : `${report.summary.crawlableIndexableRate.toFixed(1)}%`],
        ['Heading hierarchy violations', report.summary.headingHierarchyViolations ?? 0, 'HTTPS mixed-content pages', report.summary.mixedContentPages ?? 0],
        ['Canonical chains / non-200 targets', `${report.summary.canonicalChains ?? 0} / ${report.summary.canonicalNon200Targets ?? 0}`, 'Crawl-waste URLs', (report.summary.blockedInternallyLinkedPages ?? 0) + (report.summary.parameterDuplicateUrls ?? 0)]
      ],
      [2200, 2480, 2200, 2480]
    ),
    heading('Sitemap inventory', 1)
  ];

  if (!report.sitemaps.length) children.push(body('No sitemap was discovered through robots.txt or the conventional /sitemap.xml location.'));
  else {
    children.push(body(`${report.summary.sitemapPageUrls.toLocaleString()} unique same-domain page URLs were discovered across ${report.sitemaps.length} sitemap file(s).`));
    children.push(dataTable(
      ['Sitemap', 'Type', 'Status', 'Entries', 'Page URLs', 'Child maps'],
      report.sitemaps.map(sitemap => [sitemap.url, sitemap.type, sitemap.status ?? 'n/a', sitemap.entries, sitemap.pageUrls, sitemap.childSitemaps]),
      [3460, 1760, 820, 1000, 1100, 1220]
    ));
  }
  if (report.sitemaps.some(sitemap => sitemap.error)) {
    for (const sitemap of report.sitemaps.filter(sitemap => sitemap.error)) children.push(bullet(`${sitemap.url}: ${sitemap.error}`));
  }
  children.push(heading('Redirect chains', 1));
  if (!report.redirects.length) children.push(body('No redirect chains were encountered during the crawl.'));
  else children.push(dataTable(
    ['Type', 'Requested URL', 'Linked from', 'Redirect chain', 'Final status'],
    report.redirects.map(redirect => [`${redirect.classification ?? 'unknown'} (HTTP ${redirect.sourceStatus ?? 'n/a'})`, redirect.source, redirect.sourcePages.join(' | ') || 'Seed or sitemap', `${redirect.chain.join(' → ')}\n${redirect.interpretation ?? ''}`, redirect.finalStatus]),
    [1100, 2000, 2000, 3160, 1000]
  ));
  children.push(heading('Broken internal links', 1));
  if (report.config.reportBrokenLinks === false) children.push(body('Broken-link reporting was not selected for this audit.'));
  else if (!report.brokenLinks?.length) children.push(body('No crawled internal links returned HTTP 4xx/5xx responses. External links are inventoried but are not requested by this same-host crawler.'));
  else children.push(dataTable(
    ['Source page', 'Anchor text', 'Broken destination', 'HTTP'],
    report.brokenLinks.map(link => [link.sourcePage, link.anchorText, link.destination, link.status ?? 'n/a']),
    [2800, 1800, 3560, 1200]
  ));
  children.push(
    heading('Priority findings', 1)
  );

  const priority = report.pages.flatMap(page => page.findings.map(finding => ({ page, finding })))
    .filter(item => item.finding.severity !== 'info')
    .sort((a, b) => (a.finding.severity === 'critical' ? -1 : 1) - (b.finding.severity === 'critical' ? -1 : 1));
  if (!priority.length) children.push(body('No critical or warning findings were identified by the current rules.'));
  for (const item of priority.slice(0, 30)) children.push(bullet(`[${item.finding.severity.toUpperCase()}] ${item.finding.message} — ${item.page.url}`));
  if (priority.length > 30) children.push(body(`${priority.length - 30} additional priority findings appear in the page-by-page section.`));

  children.push(heading('Keyword targeting and rankings', 1, true));
  children.push(body('Target score: a weighted measure of how strongly an exact phrase is reinforced on the primary page. Title matches add 8 points; H1 7; H2 4; meta description 3; visible body occurrences 0.12 each. It is not search volume, traffic, or a Google ranking score.'));
  children.push(body('Confidence: a bounded heuristic derived from the strongest page score (30% + score ÷ 25, capped at 98%). It expresses strength and consistency of the observed on-page evidence—not a statistical probability and not proof that the page ranks.'));
  children.push(body('Position: observed GSC average position takes precedence, followed by a licensed SERP result when available. Rows are ordered with GSC-observed queries first and positions from lowest (best) to highest; unavailable inferred targets follow alphabetically.'));
  if (!report.keywords.length) children.push(body('No sufficiently strong domain keyword candidates were identified.'));
  else children.push(dataTable(
    ['Keyword', 'Evidence', 'Position', 'Target score', 'Primary page'],
    documentKeywords.map(keyword => [keyword.keyword, keyword.searchConsole ? 'GSC observed' : 'Content inferred', keywordPosition(keyword)?.toFixed(1) ?? 'Unavailable', keyword.searchConsole ? 'n/a' : Number((keyword.pages[0]?.score ?? 0).toFixed(2)), keyword.searchConsole?.pages[0] ?? keyword.pages[0]?.url ?? '']),
    [1900, 1400, 1050, 1200, 3810]
  ));

  children.push(heading('GA4 landing-page performance', 1));
  children.push(body(`Reporting period: ${periodText(report.importedData.ga4DateRange, 'unavailable - set the GA4 dates in Connected data')}. Rows are sorted by sessions from greatest to least. Engagement rate is the GA4-exported engaged-session rate, shown as a percentage.`));
  if (!ga4Pages.length) children.push(body('No GA4 landing-page rows matched analyzed pages.'));
  else children.push(dataTable(
    ['Landing page', 'Sessions', 'Active users', 'Engaged sessions', 'Engagement rate', 'Key events'],
    ga4Pages.map(page => [page.url, page.analytics!.sessions, page.analytics!.activeUsers, page.analytics!.engagedSessions, page.analytics!.engagementRate === null ? 'Unavailable in export' : `${(page.analytics!.engagementRate * 100).toFixed(1)}%`, page.analytics!.keyEvents]),
    [3150, 950, 1050, 1200, 1800, 1170]
  ));

  children.push(heading('Keyword cannibalization', 1));
  if (!report.cannibalization.length) children.push(body('No overlapping on-page targeting met the cannibalization threshold.'));
  for (const issue of report.cannibalization) {
    children.push(heading(`${issue.severity.toUpperCase()}: ${issue.keyword}`, 2));
    children.push(body(issue.reason));
    for (const page of issue.pages) children.push(bullet(`${page.url} — ${page.impressions === undefined ? `inferred targeting score ${page.score}` : `${page.clicks ?? 0} clicks, ${page.impressions} impressions, average position ${page.position?.toFixed(1) ?? 'unavailable'}`}`));
  }

  children.push(heading('Page-by-page findings', 1));
  report.pages.forEach((page, index) => children.push(...pageSection(page, index, report.config)));

  children.push(heading('Excluded URLs', 1));
  children.push(body('These URLs were not included in organic SEO/GEO analysis because they were disallowed, non-indexable, non-HTML, unsuccessful, or could not be fetched.'));
  if (!report.excludedPages.length) children.push(body('None.'));
  else children.push(dataTable(
    ['URL', 'Reason', 'HTTP'],
    report.excludedPages.map(page => [page.url, page.reason, page.status ?? 'n/a']),
    [5000, 3260, 1100]
  ));

  const internalInventory = domainLinkRows(report, true);
  const externalInventory = domainLinkRows(report, false);
  const socialLinks = report.pages.flatMap(page => page.links.map(link => ({ page: page.url, link }))).filter(item => { try { return /(?:facebook\.com|reddit\.com|bsky\.app|threads\.net|twitter\.com|x\.com|linkedin\.com|pinterest\.com)/i.test(new URL(item.link.url).hostname); } catch { return false; } });
  const socialPlatforms = [...new Set(socialLinks.map(item => new URL(item.link.url).hostname.replace(/^www\./, '')))].sort();
  children.push(heading('Domain link inventory', 1, true));
  children.push(body('The document lists every meaningful unique anchor-text and destination combination across analyzed pages; the occurrence count is shown in parentheses. Skip-navigation links are omitted and repeated social-share destinations are summarized. The accompanying links.csv retains ordinary individual occurrences and their source pages.'));
  if (socialPlatforms.length) children.push(body(`Templated social-share links were collapsed: ${socialPlatforms.join(', ')} appeared across ${new Set(socialLinks.map(item => item.page)).size} page(s).`));
  children.push(heading(`Internal links (${internalInventory.length} unique anchor/destination combinations)`, 2));
  if (!internalInventory.length) children.push(body('None found.'));
  else children.push(pairedLinkTable(internalInventory));
  children.push(heading(`External links (${externalInventory.length} unique anchor/destination combinations)`, 2));
  if (!externalInventory.length) children.push(body('None found.'));
  else children.push(pairedLinkTable(externalInventory));

  const document = new Document({
    creator: 'Jamie C. Collier',
    title: `SCOPE Audit - ${report.domain}`,
    description: 'SCOPE — Search & Content Optimization Performance Engine. Created by Jamie C. Collier.',
    styles: {
      default: { document: { run: { font: 'Arial', size: 22, color: '101828' }, paragraph: { spacing: { after: 120, line: 264 } } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Arial', size: 32, bold: true, color: BLUE }, paragraph: { spacing: { before: 320, after: 160 }, keepNext: true, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Arial', size: 26, bold: true, color: BLUE }, paragraph: { spacing: { before: 240, after: 120 }, keepNext: true, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Arial', size: 24, bold: true, color: DARK_BLUE }, paragraph: { spacing: { before: 160, after: 80 }, keepNext: true, outlineLevel: 2 } }
      ]
    },
    numbering: { config: [{ reference: 'audit-bullets', levels: [{ level: 0, format: 'bullet', text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 708, footer: 708 } } },
      children
    }]
  });
  return Packer.toBuffer(document);
}
