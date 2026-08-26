import type { AuditReport } from './types.js';

const csv = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

export function pagesCsv(report: AuditReport): string {
  const header = ['URL','Page Type','Status','Response Time Ms','Redirect Chain','Internal Links','External Links','Incoming Internal Links','Click Depth','Orphan Page','GA4 Sessions','GA4 Total Users','GA4 Engaged Sessions','GA4 Engagement Rate','GA4 Bounce Rate','GA4 Key Events','Images','Images Missing Alt Text','AIO Readiness Score','AIO Readiness Label','AIO Extractability','AIO Evidence','AIO Entity Clarity','AIO Intent Coverage','AIO Freshness','AIO Multimodal','HTML Lang','Viewport Meta','Canonical','Canonical Matches URL','SEO Title','Title Characters','Meta Description','Meta Description Characters','H1','H2s','Primary CTA','CTA URL','Detected Schema Types','Suggested Schema Types','Word Count','Sentence Count','Paragraph Count','Average Words Per Sentence','Flesch Reading Ease','Flesch-Kincaid Grade','Reading Time Minutes','Text to HTML Ratio','Findings'];
  const rows = report.pages.map(page => [
    page.url, page.pageType ?? 'unclassified', page.status, page.responseTimeMs ?? '', page.redirectChain.join(' → '), page.internalLinkCount, page.externalLinkCount,
    page.incomingInternalLinks, page.clickDepth ?? '', page.orphan ?? false, page.analytics?.sessions ?? '', page.analytics?.activeUsers ?? '', page.analytics?.engagedSessions ?? '', page.analytics?.engagementRate ?? '', page.analytics?.bounceRate ?? '', page.analytics?.keyEvents ?? '', page.imageCount, page.imagesMissingAltText,
    page.aio?.score ?? '', page.aio?.label ?? '', page.aio?.dimensions.extractability ?? '', page.aio?.dimensions.evidence ?? '', page.aio?.dimensions.entityClarity ?? '', page.aio?.dimensions.intentCoverage ?? '', page.aio?.dimensions.freshness ?? '', page.aio?.dimensions.multimodal ?? '',
    page.htmlLang ?? '', page.hasViewportMeta,
    page.canonical ?? '', page.canonicalMatchesUrl ?? '',
    page.title, page.titleCharacters, page.metaDescription, page.metaDescriptionCharacters,
    page.h1s.join(' | '), page.h2s.join(' | '), page.primaryCta?.text ?? '', page.primaryCta?.url ?? '',
    page.schemas.flatMap(schema => schema.types).join(' | '), page.suggestedSchemas.map(schema => schema.type).join(' | '), page.wordCount, page.contentMetrics.sentenceCount, page.contentMetrics.paragraphCount, page.contentMetrics.averageWordsPerSentence, page.contentMetrics.fleschReadingEase ?? '', page.contentMetrics.fleschKincaidGrade ?? '', page.contentMetrics.readingTimeMinutes, page.contentMetrics.textToHtmlRatio,
    page.findings.map(finding => `${finding.severity}: ${finding.message}`).join(' | ')
  ]);
  return [header, ...rows].map(row => row.map(csv).join(',')).join('\n') + '\n';
}

export function linksCsv(report: AuditReport): string {
  const header = ['Source Page','Link Type','Anchor Text','Destination'];
  const sharePlatform = (url: string) => { try { const host = new URL(url).hostname.replace(/^www\./, ''); return /(?:facebook\.com|reddit\.com|bsky\.app|threads\.net|twitter\.com|x\.com|linkedin\.com|pinterest\.com)/i.test(host) ? host : null; } catch { return null; } };
  const shareLinks = report.pages.flatMap(page => page.links.map(link => ({ page, link, platform: sharePlatform(link.url) }))).filter(item => item.platform);
  const platforms = [...new Set(shareLinks.map(item => item.platform!))].sort();
  const rows = [
    ...(platforms.length ? [['[Sitewide template summary]', 'external', `Standard social share links detected for ${platforms.join(', ')} across ${new Set(shareLinks.map(item => item.page.url)).size} pages`, '[Templated share destinations collapsed]']] : []),
    ...report.pages.flatMap(page => page.links.filter(link => !sharePlatform(link.url)).map(link => [page.url, link.internal ? 'internal' : 'external', link.text || '[No accessible name]', link.url]))
  ];
  return [header, ...rows].map(row => row.map(csv).join(',')).join('\n') + '\n';
}

export function technicalCsv(report: AuditReport): string {
  const header = ['Type','Source Page','Anchor Text','Destination','HTTP Status','Redirect Chain','Details'];
  const rows = [
    ...report.brokenLinks.map(link => ['broken_link', link.sourcePage, link.anchorText, link.destination, link.status ?? '', '', link.error]),
    ...report.redirects.map(redirect => [`${redirect.classification ?? 'unknown'}_redirect`, redirect.source, '', redirect.finalUrl, redirect.finalStatus, redirect.chain.join(' → '), `${redirect.interpretation ?? 'Redirect intent was not classified.'} Source response: HTTP ${redirect.sourceStatus ?? 'unknown'}. Linked from: ${redirect.sourcePages.join(' | ') || 'Seed or sitemap'}`]),
    ...(report.externalPages ?? []).map(page => [`external_depth_${page.depth}`, page.sourcePages.join(' | '), '', page.url, page.status ?? '', page.redirectChain.join(' → '), page.error ?? `Final URL: ${page.finalUrl}; ${page.responseTimeMs ?? 'n/a'} ms`]),
    ...report.excludedPages.map(item => ['excluded', '', '', item.url, item.status ?? '', '', item.reason])
  ];
  return [header, ...rows].map(row => row.map(csv).join(',')).join('\n') + '\n';
}

export function keywordsCsv(report: AuditReport): string {
  const header = ['Keyword','Target Score','Confidence','Primary Page','Competing Pages','GSC Clicks','GSC Impressions','GSC CTR','GSC Average Position','GSC Pages','Organic Position','Ranking URL','Ranking Provider'];
  const rows = report.keywords.map(keyword => [
    keyword.keyword, keyword.pages[0]?.score ?? '', keyword.confidence, keyword.pages[0]?.url ?? '', keyword.pages.slice(1).map(p => p.url).join(' | '), keyword.searchConsole?.clicks ?? '', keyword.searchConsole?.impressions ?? '', keyword.searchConsole?.ctr ?? '', keyword.searchConsole?.position ?? '', keyword.searchConsole?.pages.join(' | ') ?? '',
    keyword.ranking?.position ?? '', keyword.ranking?.rankingUrl ?? '', keyword.ranking?.provider ?? 'unavailable'
  ]);
  return [header, ...rows].map(row => row.map(csv).join(',')).join('\n') + '\n';
}

export function imagesCsv(report: AuditReport): string {
  const header = ['Image URL','Pages Used','Occurrences','Current Filename or Asset ID','Current Alt','CDN Managed','Issue','Recommendation Basis','Suggested Filename','Suggested Alt Text','Visual Description'];
  const inventory = new Map<string, { pages: Set<string>; occurrences: number; filename: string; alt: string; cdnManaged: boolean; recommendation?: import('./types.js').ImageRecommendation }>();
  for (const page of report.pages) for (const image of page.images ?? []) {
    const item = inventory.get(image.src) ?? { pages: new Set<string>(), occurrences: 0, filename: image.filename, alt: image.alt, cdnManaged: image.cdnManaged };
    item.pages.add(page.url); item.occurrences += 1;
    item.recommendation ??= page.imageRecommendations.find(candidate => candidate.src === image.src);
    inventory.set(image.src, item);
  }
  const rows = [...inventory.entries()].map(([src, item]) => [
    src, [...item.pages].join(' | '), item.occurrences, item.filename, item.alt, item.cdnManaged,
    item.recommendation?.issue ?? '', item.recommendation?.basis ?? '', item.recommendation?.suggestedFilename ?? '', item.recommendation?.suggestedAlt ?? '', item.recommendation?.visualDescription ?? ''
  ]);
  return [header, ...rows].map(row => row.map(csv).join(',')).join('\n') + '\n';
}
