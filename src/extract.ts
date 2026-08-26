import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';

const simHash = (value: string) => {
  const counts = new Map<string, number>(); for (const token of value.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []) counts.set(token, (counts.get(token) ?? 0) + 1);
  const weights = Array<number>(64).fill(0);
  for (const [token, count] of counts) { const hashed = BigInt(`0x${createHash('sha256').update(token).digest('hex').slice(0, 16)}`); for (let bit = 0; bit < 64; bit++) weights[bit] += (hashed & (1n << BigInt(bit))) ? count : -count; }
  let result = 0n; for (let bit = 0; bit < 64; bit++) if (weights[bit] >= 0) result |= 1n << BigInt(bit);
  return result.toString(16).padStart(16, '0');
};
import type { CtaInfo, Finding, Heading, ImageRecommendation, LinkInfo, PageResult, SchemaMarkup, SuggestedSchema } from './types.js';
import { cleanText, equivalentUrl, normaliseUrl, sameHost } from './util.js';
import { extractKeywordSignals } from './keywords.js';
import { assessAio } from './aio.js';
import { measureReadability } from './readability.js';

function schemaTypes(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return [...new Set(value.flatMap(schemaTypes))];
  const record = value as Record<string, unknown>;
  const own = typeof record['@type'] === 'string' ? [record['@type']] : Array.isArray(record['@type']) ? record['@type'].filter((v): v is string => typeof v === 'string') : [];
  return [...new Set([...own, ...schemaTypes(record['@graph'])])];
}
function jsonParseExplanation(raw: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const position = Number(message.match(/position\s+(\d+)/i)?.[1]);
  if (!Number.isFinite(position)) return message;
  const before = raw.slice(0, position), line = before.split('\n').length, column = position - before.lastIndexOf('\n');
  const hint = /unexpected end/i.test(message) ? 'Check for a missing closing brace, bracket, or quote.' : /property name|double-quoted/i.test(message) ? 'Check for an unquoted property name or trailing comma.' : /string/i.test(message) ? 'Check for an unescaped quote or control character inside a string.' : 'Inspect the surrounding punctuation and value type.';
  return `Line ${line}, column ${column}: ${message}. ${hint}`;
}
function schemaValidationIssues(value: unknown): string[] {
  const required: Record<string, string[]> = { Article: ['headline', 'author', 'datePublished'], BlogPosting: ['headline', 'author', 'datePublished'], Product: ['name'], Review: ['itemReviewed', 'reviewRating', 'author'], AggregateRating: ['ratingValue', 'reviewCount'], FAQPage: ['mainEntity'], Organization: ['name', 'url'], BreadcrumbList: ['itemListElement'] };
  const nodes: Record<string, unknown>[] = [];
  const visit = (item: unknown) => { if (Array.isArray(item)) item.forEach(visit); else if (item && typeof item === 'object') { const record = item as Record<string, unknown>; nodes.push(record); if (record['@graph']) visit(record['@graph']); } };
  visit(value);
  return nodes.flatMap(node => (typeof node['@type'] === 'string' ? [node['@type']] : Array.isArray(node['@type']) ? node['@type'].filter((type): type is string => typeof type === 'string') : []).flatMap(type => (required[type] ?? []).filter(property => node[property] === undefined || node[property] === '').map(property => `${type} is missing core property “${property}”`)));
}

export function suggestSchemas(page: Pick<PageResult, 'url'|'title'|'h1s'|'h2s'|'text'|'schemas'>): SuggestedSchema[] {
  const existing = new Set(page.schemas.flatMap(schema => schema.types).map(type => type.toLowerCase()));
  const content = `${page.title} ${page.h1s.join(' ')} ${page.h2s.join(' ')} ${page.text.slice(0, 12000)}`.toLowerCase();
  const path = new URL(page.url).pathname;
  const suggestions: SuggestedSchema[] = [];
  const add = (type: string, reason: string, confidence: SuggestedSchema['confidence']) => {
    if (!existing.has(type.toLowerCase()) && !suggestions.some(item => item.type === type)) suggestions.push({ type, reason, confidence });
  };
  if (path.split('/').filter(Boolean).length > 1) add('BreadcrumbList', 'The page is nested deeply enough that breadcrumb context could clarify its place in the site hierarchy.', 'high');
  if (/\bfaq(s)?\b|frequently asked questions|questions and answers/.test(content)) add('FAQPage', 'The visible content appears to contain a question-and-answer section; only use this when the full questions and answers are visible.', 'high');
  if (/\btestimonial(s)?\b|customer reviews?|what (our )?customers say/.test(content)) add('Review', 'Visible testimonial or review content may support Review markup when each review identifies its subject and author.', 'medium');
  if (/\b[1-5](?:\.\d)?\s*(?:\/\s*5|stars?)\b|aggregate rating|rated [1-5]/.test(content)) add('AggregateRating', 'A visible rating signal was detected; use only when the aggregate value and review count are shown to users and meet Google policies.', 'medium');
  if (/\bhow to\b|step-by-step|\bstep 1\b/.test(content)) add('HowTo', 'The page appears to present a step-based process.', 'medium');
  if (/\b(blog|article|guide|news|resources?)\b/.test(`${path} ${content.slice(0, 1000)}`)) add('Article', 'The page appears editorial or educational and may benefit from author, publisher, and date properties.', 'medium');
  else if (/\b(service|solutions?|answering service|receptionist|consultation)\b/.test(content)) add('Service', 'The page appears to describe a service offering and its audience or provider.', 'medium');
  if (path === '/' || path === '') add('Organization', 'The homepage can identify the organization, logo, URL, and authoritative sameAs profiles.', 'high');
  add('WebPage', 'Base WebPage markup can identify the page name, canonical URL, description, and relationship to the site.', 'medium');
  return suggestions;
}

function findCta($: cheerio.CheerioAPI, baseUrl: string): CtaInfo | null {
  const candidates: Array<CtaInfo & { score: number }> = [];
  $('a[href], button').each((_, node) => {
    const el = $(node);
    const text = cleanText(el.text() || el.attr('aria-label'));
    const href = el.attr('href');
    if (!text || !href || el.attr('aria-hidden') === 'true') return;
    const url = normaliseUrl(href, baseUrl);
    if (!url) return;
    const action = /\b(get|start|try|buy|shop|book|schedule|contact|request|download|subscribe|sign up|learn more|demo|quote)\b/i.test(text);
    const cls = `${el.attr('class') ?? ''} ${el.attr('role') ?? ''}`;
    const styled = /(btn|button|cta|primary)/i.test(cls);
    const inHeader = el.closest('header,nav').length > 0;
    const inFooter = el.closest('footer').length > 0;
    const inHero = el.closest('[class*=hero],[id*=hero]').length > 0;
    const evidence: string[] = [];
    let score = 0;
    if (action) { score += 4; evidence.push('action-oriented wording'); }
    if (styled) { score += 3; evidence.push('button/CTA styling'); }
    if (inHero) { score += 3; evidence.push('located in hero'); }
    if (inHeader) { score += 1; evidence.push('located in header/navigation'); }
    if (inFooter) score -= 2;
    const location = inHero ? 'hero' : inHeader ? 'header' : inFooter ? 'footer' : el.closest('main').length ? 'main' : 'unknown';
    candidates.push({ text, url, internal: sameHost(url, baseUrl), location, confidence: 0, evidence, score });
  });
  const best = candidates.sort((a, b) => b.score - a.score)[0];
  if (!best || best.score < 2) return null;
  const { score, ...cta } = best;
  cta.confidence = Math.min(0.98, 0.35 + score * 0.075);
  return cta;
}

type ClassifiedPageType = NonNullable<PageResult['pageType']>;
const archiveTypes = new Set<ClassifiedPageType>(['category_archive', 'tag_archive', 'author_archive', 'search_archive', 'pagination_archive', 'feed']);
export function classifyPageType(url: string, hasArticle: boolean): ClassifiedPageType {
  const candidate = new URL(url);
  if (candidate.pathname === '/' && !candidate.search) return 'home';
  if (/\/(?:feed)(?:\/|$)/i.test(candidate.pathname)) return 'feed';
  if (candidate.searchParams.has('s') || /\/search(?:\/|$)/i.test(candidate.pathname)) return 'search_archive';
  if (/\/category(?:\/|$)/i.test(candidate.pathname)) return 'category_archive';
  if (/\/tag(?:\/|$)/i.test(candidate.pathname)) return 'tag_archive';
  if (/\/author(?:\/|$)/i.test(candidate.pathname)) return 'author_archive';
  if (/\/page\/\d+(?:\/|$)/i.test(candidate.pathname)) return 'pagination_archive';
  return hasArticle || /\/\d{4}\/\d{1,2}\//.test(candidate.pathname) ? 'article' : 'landing';
}

function findingsFor(page: Pick<PageResult, 'title'|'metaDescription'|'metaDescriptionCharacters'|'h1s'|'h2s'|'schemas'|'wordCount'|'canonical'> & { pageType: ClassifiedPageType }): Finding[] {
  const out: Finding[] = [];
  const archive = archiveTypes.has(page.pageType);
  if (!page.title) out.push({ category: 'seo', severity: 'critical', rule: 'title_missing', message: 'SEO title is missing.' });
  if (!page.metaDescription && !archive) out.push({ category: 'seo', severity: 'warning', rule: 'meta_description_missing', message: 'Meta description is missing.' });
  else if (page.metaDescription && !archive && (page.metaDescriptionCharacters < 70 || page.metaDescriptionCharacters > 170)) out.push({ category: 'seo', severity: 'warning', rule: 'meta_description_length', message: `Meta description has ${page.metaDescriptionCharacters} characters; review its SERP presentation.`, evidence: page.metaDescription });
  if (page.h1s.length === 0) out.push({ category: 'seo', severity: 'warning', rule: 'h1_missing', message: 'No H1 was found.' });
  if (page.h1s.length > 1) out.push({ category: 'seo', severity: 'info', rule: 'multiple_h1', message: `${page.h1s.length} H1 elements were found.` });
  if (!page.canonical) out.push({ category: 'seo', severity: 'info', rule: 'canonical_missing', message: 'No canonical link was found.' });
  if (!archive && page.wordCount < 150) out.push({ category: 'geo', severity: 'warning', rule: 'thin_content', message: `Only ${page.wordCount} visible words were extracted.` });
  if (!archive && page.h2s.length === 0) out.push({ category: 'aio', severity: 'info', rule: 'answer_structure', message: 'No H2 sections were found; clear topical sections may improve extractability.' });
  if (!archive && page.schemas.length === 0) out.push({ category: 'geo', severity: 'info', rule: 'schema_missing', message: 'No JSON-LD markup was found.' });
  for (const [index, schema] of page.schemas.entries()) if (!schema.validJson) out.push({ category: 'seo', severity: 'warning', rule: 'schema_invalid_json', message: `JSON-LD block ${index + 1} is invalid: ${schema.error ?? 'unknown parse error'}`, evidence: schema.raw.slice(0, 500) });
  for (const [index, schema] of page.schemas.entries()) for (const issue of schema.validationIssues ?? []) out.push({ category: 'seo', severity: 'warning', rule: 'schema_missing_core_property', message: `JSON-LD block ${index + 1}: ${issue}.`, evidence: schema.types.join(', ') });
  return out;
}

export function extractPage(requestedUrl: string, finalUrl: string, status: number, contentType: string, html: string, headers: Headers, redirectChain: string[] = [], responseTimeMs: number | null = null): PageResult {
  const $ = cheerio.load(html);
  const pageType = classifyPageType(finalUrl, $('article,[itemtype*="Article"],meta[property="og:type"][content="article" i]').length > 0);
  const imageCount = $('img').length;
  const imagesMissingAltText = $('img').filter((_, image) => !cleanText($(image).attr('alt'))).length;
  const htmlLang = cleanText($('html').attr('lang')) || null;
  const hasViewportMeta = $('meta[name="viewport" i]').length > 0;
  const hasAuthor = $('meta[name="author" i],[rel="author"],.author,[itemprop="author"]').length > 0;
  const hasPublishedDate = $('time[datetime],meta[property="article:published_time" i],[itemprop="datePublished"]').length > 0;
  const hasModifiedDate = $('meta[property="article:modified_time" i],[itemprop="dateModified"]').length > 0;
  const dateValue = (selectors: string) => cleanText($(selectors).first().attr('content') || $(selectors).first().attr('datetime')) || null;
  const publishedDate = dateValue('meta[property="article:published_time" i],meta[itemprop="datePublished"],time[datetime]');
  const modifiedDate = dateValue('meta[property="article:modified_time" i],meta[itemprop="dateModified"]') || headers.get('last-modified');
  const contentDate = modifiedDate || publishedDate;
  const parsedContentDate = contentDate ? Date.parse(contentDate) : NaN;
  const contentAgeDays = Number.isFinite(parsedContentDate) ? Math.max(0, Math.floor((Date.now() - parsedContentDate) / 86_400_000)) : null;
  const mixedContentResources = finalUrl.startsWith('https:') ? $('img[src],script[src],iframe[src],source[src],video[src],audio[src],link[rel="stylesheet"][href]').map((_, element) => $(element).attr('src') || $(element).attr('href') || '').get().filter(value => /^http:\/\//i.test(value)) : [];
  const listCount = $('main ol,main ul,article ol,article ul').length;
  const tableCount = $('main table,article table').length;
  $('script:not([type="application/ld+json"]),style,noscript,svg,template').remove();
  const title = cleanText($('title').first().text());
  const metaDescription = cleanText($('meta[name="description" i]').first().attr('content'));
  const canonicalRaw = $('link[rel="canonical" i]').first().attr('href');
  const canonical = canonicalRaw ? normaliseUrl(canonicalRaw, finalUrl) : null;
  const headerRobots = headers.get('x-robots-tag') ?? '';
  const metaRobots = $('meta[name="robots" i],meta[name="googlebot" i]').map((_, el) => $(el).attr('content') ?? '').get().join(',');
  const robotsDirectives = `${headerRobots},${metaRobots}`.toLowerCase().split(/[,\s]+/).filter(Boolean);
  const indexable = status >= 200 && status < 300 && !robotsDirectives.includes('noindex') && /text\/html|application\/xhtml\+xml/i.test(contentType);
  const headings: Heading[] = $('h1,h2,h3,h4,h5,h6').map((_, el) => ({ text: cleanText($(el).text()), level: Number(el.tagName.slice(1)) as Heading['level'] })).get().filter(h => h.text);
  const schemas: SchemaMarkup[] = $('script[type="application/ld+json" i]').map((_, el) => {
    const raw = $(el).html()?.trim() ?? '';
    try { const parsed: unknown = JSON.parse(raw); return { raw, parsed, types: schemaTypes(parsed), validJson: true, validationIssues: schemaValidationIssues(parsed) }; }
    catch (error) { return { raw, parsed: null, types: [], validJson: false, error: jsonParseExplanation(raw, error) }; }
  }).get();
  const text = cleanText($('main').first().text() || $('body').text());
  const paragraphCount = $('main p,article p').filter((_, paragraph) => cleanText($(paragraph).text()).length > 0).length;
  const contentMetrics = measureReadability(text, html, paragraphCount);
  const links: LinkInfo[] = $('a[href]').map((_, el) => {
    const element = $(el), url = normaliseUrl(element.attr('href') ?? '', finalUrl);
    const labelledBy = (element.attr('aria-labelledby') ?? '').split(/\s+/).filter(Boolean).map(id => cleanText($(`#${id}`).text())).filter(Boolean).join(' ');
    const hiddenText = element.find('.screen-reader-text,.sr-only,.visually-hidden,[class*="screen-reader"],[class*="visually-hidden"]').text();
    const text = cleanText(element.text() || element.attr('aria-label') || labelledBy || element.attr('title') || hiddenText);
    if (!url || /^skip (?:to )?(?:main )?content$/i.test(text)) return null;
    return { text, url, internal: sameHost(url, finalUrl) };
  }).get().filter((v): v is LinkInfo => Boolean(v));
  const uniqueInternalLinks = new Set(links.filter(link => link.internal).map(link => link.url));
  const uniqueExternalLinks = new Set(links.filter(link => !link.internal).map(link => link.url));
  const h1s = headings.filter(h => h.level === 1).map(h => h.text);
  const h2s = headings.filter(h => h.level === 2).map(h => h.text);
  const questionHeadings = headings.map(heading => heading.text).filter(value => /\?|^(what|why|how|when|where|who|which|can|does|is|are|should)\b/i.test(value));
  const citedClaimCount = (text.match(/\b\d+(?:\.\d+)?%?\b[^.]{0,160}(?:according to|source:|study|report|research|data from)/gi) ?? []).length;
  const preliminarySignals = extractKeywordSignals(title, metaDescription, h1s, h2s, text);
  const primaryKeyword = preliminarySignals.find(signal => signal.phrase.split(' ').length > 1)?.phrase ?? (cleanText(h1s[0] || title) || 'website image');
  const slug = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  const images = $('img[src]').map((_, image) => {
    const src = normaliseUrl($(image).attr('src') ?? '', finalUrl);
    if (!src) return null;
    const detected = decodeURIComponent(new URL(src).pathname.split('/').pop() || 'image');
    const cdnManaged = !/\.[a-z0-9]{2,5}$/i.test(detected) && /^[a-f0-9_-]{20,}$/i.test(detected);
    return { src, alt: cleanText($(image).attr('alt')), filename: cdnManaged ? '[CDN-generated asset identifier]' : detected, cdnManaged };
  }).get().filter(Boolean);
  const usedAltSuggestions = new Map<string, number>();
  const imageRecommendations: ImageRecommendation[] = $('img[src]').map((imageIndex, image) => {
    const element = $(image);
    const src = normaliseUrl(element.attr('src') ?? '', finalUrl);
    if (!src) return null;
    const currentAlt = cleanText(element.attr('alt'));
    const detectedFilename = decodeURIComponent(new URL(src).pathname.split('/').pop() || 'image');
    const hasExtension = /\.[a-z0-9]{2,5}$/i.test(detectedFilename);
    const opaqueCdnAsset = !hasExtension && /^[a-f0-9_-]{20,}$/i.test(detectedFilename);
    const currentFilename = opaqueCdnAsset ? '[CDN-generated asset identifier]' : detectedFilename;
    const stem = detectedFilename.replace(/\.[^.]+$/, '');
    const extension = (detectedFilename.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? '.webp').toLowerCase();
    const unoptimized = !opaqueCdnAsset && (!stem || /^(img|image|photo|pic|dsc|untitled|screenshot)[-_ ]?\d*$/i.test(stem) || /^[a-f0-9_-]{12,}$/i.test(stem) || /\s|_/.test(stem));
    if (currentAlt && !unoptimized) return null;
    const context = cleanText(element.closest('figure').find('figcaption').first().text() || element.parent().text() || element.attr('title')).slice(0, 180);
    const filenameSubject = cleanText(stem.replace(/[-_]+/g, ' '));
    const subject = context || (!opaqueCdnAsset && filenameSubject ? filenameSubject : '');
    let suggestedAlt = subject ? cleanText(`${subject}${subject.toLowerCase().includes(primaryKeyword.toLowerCase()) ? '' : ` — ${primaryKeyword}`}`).slice(0, 160) : `Manual review needed: image ${imageIndex + 1} on “${cleanText(h1s[0] || title)}”`;
    const duplicateCount = usedAltSuggestions.get(suggestedAlt.toLowerCase()) ?? 0;
    usedAltSuggestions.set(suggestedAlt.toLowerCase(), duplicateCount + 1);
    if (duplicateCount) suggestedAlt = `Manual review needed: distinct image ${imageIndex + 1} on “${cleanText(h1s[0] || title)}”`;
    return {
      src, currentAlt, currentFilename,
      issue: !currentAlt && unoptimized ? 'both' : !currentAlt ? 'missing_alt' : 'unoptimized_filename',
      suggestedAlt,
      suggestedFilename: opaqueCdnAsset ? 'CDN-managed — rename not applicable' : `${slug(`${primaryKeyword}-${subject}`) || 'descriptive-image'}${extension}`,
      basis: 'page_context'
    } satisfies ImageRecommendation;
  }).get().filter(Boolean) as ImageRecommendation[];
  const base = { title, metaDescription, metaDescriptionCharacters: [...metaDescription].length, h1s, h2s, schemas, wordCount: contentMetrics.wordCount, canonical, pageType };
  const result: PageResult = {
    requestedUrl, url: finalUrl, status, redirectChain, contentType, ...base,
    titleCharacters: [...title].length, robotsDirectives, indexable, headings,
    primaryCta: findCta($, finalUrl), text, links, contentMetrics,
    internalLinkCount: uniqueInternalLinks.size, externalLinkCount: uniqueExternalLinks.size,
    incomingInternalLinks: 0, imageCount, imagesMissingAltText, images, imageRecommendations, htmlLang, hasViewportMeta,
    publishedDate, modifiedDate, contentAgeDays, mixedContentResources, contentFingerprint: simHash(text),
    canonicalMatchesUrl: canonical ? equivalentUrl(canonical, finalUrl) : null, responseTimeMs,
    suggestedSchemas: [],
    aio: assessAio({
      title, metaDescription, h1s, h2s, text, robotsDirectives,
      schemaTypes: schemas.flatMap(schema => schema.types), externalLinkCount: uniqueExternalLinks.size,
      imageCount, imagesMissingAltText, hasAuthor, hasPublishedDate, hasModifiedDate,
      lastModified: headers.get('last-modified'), listCount, tableCount, questionHeadings, citedClaimCount
    }),
    keywordSignals: preliminarySignals,
    findings: findingsFor(base), pageSpeed: [], crawledAt: new Date().toISOString()
  };
  result.suggestedSchemas = suggestSchemas(result);
  if (!hasViewportMeta) result.findings.push({ category: 'seo', severity: 'warning', rule: 'viewport_missing', message: 'Viewport meta tag is missing; mobile rendering may be impaired.' });
  if (!htmlLang) result.findings.push({ category: 'seo', severity: 'info', rule: 'html_lang_missing', message: 'The HTML lang attribute is missing.' });
  if (imageCount && imagesMissingAltText) result.findings.push({ category: 'seo', severity: 'warning', rule: 'image_alt_missing', message: `${imagesMissingAltText} of ${imageCount} images have empty or missing alt text; decorative images should use an intentional empty alt attribute.` });
  if (canonical && !equivalentUrl(canonical, finalUrl)) result.findings.push({ category: 'seo', severity: 'info', rule: 'canonical_differs', message: `Canonical points to a materially different URL: ${canonical}` });
  if (archiveTypes.has(pageType) && indexable) result.findings.push({ category: 'seo', severity: pageType === 'search_archive' ? 'warning' : 'info', rule: 'indexable_archive_review', message: `Indexable ${pageType.replaceAll('_', ' ')} confirmed: HTTP ${status}, no noindex directive detected${canonical ? `, and canonical ${equivalentUrl(canonical, finalUrl) ? 'is self-referencing' : `points to ${canonical}`}` : ', with no canonical declared'}. Review whether search indexing, pagination, and listing quality are intentional.`, evidence: `robots directives: ${robotsDirectives.length ? robotsDirectives.join(', ') : 'none detected'}; indexable: yes` });
  for (let index = 1; index < headings.length; index++) if (headings[index].level > headings[index - 1].level + 1) { result.findings.push({ category: 'seo', severity: 'warning', rule: 'heading_hierarchy_skipped', message: `Heading hierarchy skips from H${headings[index - 1].level} to H${headings[index].level}.`, evidence: `${headings[index - 1].text} → ${headings[index].text}` }); break; }
  if (mixedContentResources.length) result.findings.push({ category: 'seo', severity: 'warning', rule: 'mixed_content', message: `${mixedContentResources.length} insecure HTTP resource${mixedContentResources.length === 1 ? '' : 's'} load on this HTTPS page.`, evidence: mixedContentResources.slice(0, 10).join(' | ') });
  if (contentAgeDays !== null && contentAgeDays > 730) result.findings.push({ category: 'geo', severity: 'warning', rule: 'content_stale', message: `The best available content date is ${contentAgeDays} days old; verify accuracy and update stale material.`, evidence: contentDate ?? undefined });
  else if (contentAgeDays !== null && contentAgeDays > 365) result.findings.push({ category: 'geo', severity: 'info', rule: 'content_aging', message: `The best available content date is ${contentAgeDays} days old.`, evidence: contentDate ?? undefined });
  if (!archiveTypes.has(pageType) && contentMetrics.fleschKincaidGrade !== null && contentMetrics.fleschKincaidGrade > 12) result.findings.push({ category: 'geo', severity: 'info', rule: 'readability_difficult', message: `Flesch-Kincaid grade level is ${contentMetrics.fleschKincaidGrade}; consider simplifying copy where a broad audience is intended.` });
  if (!archiveTypes.has(pageType) && contentMetrics.averageWordsPerSentence > 25) result.findings.push({ category: 'geo', severity: 'info', rule: 'long_sentences', message: `Average sentence length is ${contentMetrics.averageWordsPerSentence} words; shorter sentences may improve scanability.` });
  for (const indicator of result.aio.indicators.filter(item => item.status !== 'pass' && !archiveTypes.has(pageType))) {
    result.findings.push({ category: 'aio', severity: indicator.status === 'blocked' ? 'critical' : 'info', rule: `aio_${indicator.key}`, message: `${indicator.label}: ${indicator.recommendation ?? indicator.evidence}`, evidence: indicator.evidence });
  }
  return result;
}
