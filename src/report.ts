import type { AuditReport } from './types.js';

const csv = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

export function pagesCsv(report: AuditReport): string {
  const header = ['URL','Status','Response Time Ms','Redirect Chain','Internal Links','External Links','Incoming Internal Links','GA4 Sessions','GA4 Active Users','GA4 Engaged Sessions','GA4 Engagement Rate','GA4 Key Events','Images','Images Missing Alt Text','AI Readiness Score','AI Readiness Label','AI Extractability','AI Evidence','AI Entity Clarity','AI Intent Coverage','AI Freshness','AI Multimodal','HTML Lang','Viewport Meta','Canonical','Canonical Matches URL','SEO Title','Title Characters','Meta Description','Meta Description Characters','H1','H2s','Primary CTA','CTA URL','Detected Schema Types','Suggested Schema Types','Word Count','Findings'];
  const rows = report.pages.map(page => [
    page.url, page.status, page.responseTimeMs ?? '', page.redirectChain.join(' → '), page.internalLinkCount, page.externalLinkCount,
    page.incomingInternalLinks, page.analytics?.sessions ?? '', page.analytics?.activeUsers ?? '', page.analytics?.engagedSessions ?? '', page.analytics?.engagementRate ?? '', page.analytics?.keyEvents ?? '', page.imageCount, page.imagesMissingAltText,
    page.aio?.score ?? '', page.aio?.label ?? '', page.aio?.dimensions.extractability ?? '', page.aio?.dimensions.evidence ?? '', page.aio?.dimensions.entityClarity ?? '', page.aio?.dimensions.intentCoverage ?? '', page.aio?.dimensions.freshness ?? '', page.aio?.dimensions.multimodal ?? '',
    page.htmlLang ?? '', page.hasViewportMeta,
    page.canonical ?? '', page.canonicalMatchesUrl ?? '',
    page.title, page.titleCharacters, page.metaDescription, page.metaDescriptionCharacters,
    page.h1s.join(' | '), page.h2s.join(' | '), page.primaryCta?.text ?? '', page.primaryCta?.url ?? '',
    page.schemas.flatMap(schema => schema.types).join(' | '), page.suggestedSchemas.map(schema => schema.type).join(' | '), page.wordCount,
    page.findings.map(finding => `${finding.severity}: ${finding.message}`).join(' | ')
  ]);
  return [header, ...rows].map(row => row.map(csv).join(',')).join('\n') + '\n';
}

export function linksCsv(report: AuditReport): string {
  const header = ['Source Page','Link Type','Anchor Text','Destination'];
  const rows = report.pages.flatMap(page => page.links.map(link => [page.url, link.internal ? 'internal' : 'external', link.text || '[No anchor text]', link.url]));
  return [header, ...rows].map(row => row.map(csv).join(',')).join('\n') + '\n';
}

export function technicalCsv(report: AuditReport): string {
  const header = ['Type','Source Page','Anchor Text','Destination','HTTP Status','Redirect Chain','Details'];
  const rows = [
    ...report.brokenLinks.map(link => ['broken_link', link.sourcePage, link.anchorText, link.destination, link.status ?? '', '', link.error]),
    ...report.redirects.flatMap(redirect => (redirect.sourcePages.length ? redirect.sourcePages : ['']).map(sourcePage => ['redirect', sourcePage, '', redirect.source, redirect.finalStatus, redirect.chain.join(' → '), `Final URL: ${redirect.finalUrl}`])),
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
  const header = ['Page URL','Image URL','Current Filename','Current Alt','Issue','Recommendation Basis','Suggested Filename','Suggested Alt Text','Visual Description'];
  const rows = report.pages.flatMap(page => page.imageRecommendations.map(image => [
    page.url, image.src, image.currentFilename, image.currentAlt, image.issue, image.basis,
    image.suggestedFilename, image.suggestedAlt, image.visualDescription ?? ''
  ]));
  return [header, ...rows].map(row => row.map(csv).join(',')).join('\n') + '\n';
}
