import { html, type Html } from './html.js';
import { layout } from './layout.js';
import { reportSection, statGrid, statTile } from './components/section.js';
import { dataTable } from './components/table.js';
import { statusBadge, rangeBadge } from './components/badge.js';
import type { ProjectRow } from '../db/repositories/projects.js';
import type { PageRow } from '../db/repositories/pages.js';
import type { CrawlRow } from '../db/repositories/crawls.js';
import type { FindingRow } from '../db/repositories/findings.js';
import type { ExtractedData } from '../pipeline/types.js';
import type { AppConfig } from '../config/index.js';
import { BLOCKED_PAGE_CHECK_ID } from '../pipeline/check/checks/blockedPage.js';
import { MOBILE_FALLBACK_CHECK_ID } from '../pipeline/check/checks/mobileEmulationFallback.js';
import { isBroken } from '../pipeline/check/checks/brokenLinks.js';

export interface CrawlReportInput {
  project: ProjectRow;
  page: PageRow;
  crawl: CrawlRow;
  findings: FindingRow[];
  config: AppConfig;
}

function lengthRangeIndicator(length: number, min: number, max: number): Html {
  if (length < min) return rangeBadge('warn', `Too short — ${length}/${min}–${max} chars`);
  if (length > max) return rangeBadge('warn', `Too long — ${length}/${min}–${max} chars`);
  return rangeBadge('pass', `Within range — ${length}/${min}–${max} chars`);
}

function budgetIndicator(valueMs: number, budgetMs: number): Html {
  return valueMs <= budgetMs
    ? rangeBadge('pass', `Within budget (≤ ${budgetMs}ms)`)
    : rangeBadge('warn', `Over budget (budget ${budgetMs}ms)`);
}

function clsIndicator(value: number, budget: number): Html {
  return value <= budget
    ? rangeBadge('pass', `Within budget (≤ ${budget})`)
    : rangeBadge('warn', `Over budget (budget ${budget})`);
}

/**
 * mailto: has no way to attach a file or carry rich HTML, so this builds a
 * plain-text digest (status, counts, top issues) instead of trying to embed
 * the report itself. Built entirely at render time — no client-side JS needed,
 * which keeps the report self-contained per the original spec.
 */
function buildMailtoLink({ project, page, crawl, findings }: CrawlReportInput): string {
  const topIssues = [...findings.filter((f) => f.status === 'fail'), ...findings.filter((f) => f.status === 'warn')]
    .slice(0, 8)
    .map((f) => `- [${f.status.toUpperCase()}] ${f.check_id}: ${f.detail}`)
    .join('\n');

  const subject = `SEO/GEO Audit Report — ${page.url} (${crawl.overall_status.toUpperCase()})`;
  const bodyLines = [
    'SEO/GEO Audit Report',
    `Page: ${page.url}`,
    `Domain: ${project.domain}`,
    `Crawled: ${crawl.crawled_at.toLocaleString?.() ?? crawl.crawled_at}`,
    `Overall status: ${crawl.overall_status.toUpperCase()}`,
    `Passing: ${crawl.pass_count}   Warnings: ${crawl.warn_count}   Failing: ${crawl.fail_count}`,
    '',
    topIssues ? 'Top issues:' : 'No warnings or failures — all checks passed.',
    ...(topIssues ? [topIssues] : []),
    '',
    '(This is a plain-text summary. Attach or forward the full HTML report for complete details.)',
  ];

  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join('\n'))}`;
}

function emailButton(input: CrawlReportInput): Html {
  return html`<a class="email-button" href="${buildMailtoLink(input)}"
    ><span aria-hidden="true">📧</span> Email this report</a
  >`;
}

const NAV = [
  { href: '#summary', label: 'Summary' },
  { href: '#findings', label: 'Findings' },
  { href: '#metadata', label: 'Metadata' },
  { href: '#headings', label: 'Headings' },
  { href: '#images', label: 'Images / Alt Text' },
  { href: '#schema', label: 'Schema' },
  { href: '#links', label: 'Links / Redirects' },
  { href: '#console-errors', label: 'Console Errors' },
  { href: '#performance', label: 'Performance' },
  { href: '#indexability', label: 'Indexability' },
];

function blockedPageBanner(findings: FindingRow[]): Html | '' {
  const finding = findings.find((f) => f.check_id === BLOCKED_PAGE_CHECK_ID && f.status !== 'pass');
  if (!finding) return '';
  return html`
    <div class="blocked-banner" role="alert">
      <strong>${finding.status === 'fail' ? '⚠️ This crawl was likely blocked' : '⚠️ Possible bot-protection page'}</strong>
      <p>${finding.detail}</p>
    </div>
  `;
}

function mobileFallbackBanner(findings: FindingRow[]): Html | '' {
  const finding = findings.find((f) => f.check_id === MOBILE_FALLBACK_CHECK_ID && f.status === 'warn');
  if (!finding) return '';
  return html`
    <div class="fallback-banner" role="alert">
      <strong>ℹ️ Desktop fallback used</strong>
      <p>${finding.detail}</p>
    </div>
  `;
}

function summarySection(crawl: CrawlRow): Html {
  return reportSection(
    'summary',
    'Summary',
    '📋',
    html`
      <p>Overall status: ${statusBadge(crawl.overall_status)}</p>
      ${statGrid([
        statTile('Passing checks', String(crawl.pass_count)),
        statTile('Info', String(crawl.info_count)),
        statTile('Warnings', String(crawl.warn_count)),
        statTile('Failing checks', String(crawl.fail_count)),
        statTile('Mobile load time', crawl.mobile_load_ms !== null ? `${crawl.mobile_load_ms} ms` : 'n/a'),
        statTile('HTTP status', crawl.http_status !== null ? String(crawl.http_status) : 'n/a'),
      ])}
    `,
  );
}

function findingsSection(findings: FindingRow[]): Html {
  const sorted = [...findings].sort((a, b) => {
    const order = { fail: 0, warn: 1, info: 2, pass: 3 };
    return order[a.status] - order[b.status] || a.check_id.localeCompare(b.check_id);
  });
  return reportSection(
    'findings',
    'Findings',
    '✅',
    dataTable(
      ['Status', 'Check', 'Detail'],
      sorted.map((f) => [statusBadge(f.status), html`<code>${f.check_id}</code>`, html`${f.detail}`]),
      'No findings recorded for this crawl.',
    ),
  );
}

function metadataSection(data: ExtractedData, config: AppConfig): Html {
  const m = data.metadata;
  const { titleLength, metaDescriptionLength } = config.thresholds;

  const titleValue = m.title
    ? html`${m.title}<br />${lengthRangeIndicator(m.title.length, titleLength.min, titleLength.max)}`
    : html`<span class="empty-note">missing</span>`;

  const descriptionValue = m.metaDescription
    ? html`${m.metaDescription}<br />${lengthRangeIndicator(m.metaDescription.length, metaDescriptionLength.min, metaDescriptionLength.max)}`
    : html`<span class="empty-note">missing</span>`;

  const canonicalValue = m.canonical.href
    ? html`<a href="${m.canonical.href}">${m.canonical.href}</a>${
        m.canonical.isSelfReferential === false
          ? html`<br /><strong>Points away from this page</strong> (this page: ${data.url})`
          : ''
      }`
    : html`<span class="empty-note">missing</span>`;

  return reportSection(
    'metadata',
    'Metadata',
    '🏷️',
    dataTable(
      ['Field', 'Value'],
      [
        ['Title', titleValue],
        ['Meta description', descriptionValue],
        ['Canonical', canonicalValue],
        ['Meta robots', html`${m.robotsMeta.raw ?? 'index, follow (default)'}`],
        ['Mobile viewport tag', html`${m.viewportPresent ? 'present' : html`<span class="empty-note">missing</span>`}`],
        ['Publish/updated date', html`${m.publishDate ?? html`<span class="empty-note">not found</span>`}`],
        ['OG title', html`${m.og.title ?? '—'}`],
        ['OG description', html`${m.og.description ?? '—'}`],
        ['OG image', html`${m.og.image ?? '—'}`],
        ['Twitter card', html`${m.twitter.card ?? '—'}`],
      ].map(([label, value]) => [html`${label}`, value as Html]),
      'No metadata extracted.',
    ),
  );
}

function headingsSection(data: ExtractedData): Html {
  return reportSection(
    'headings',
    'Headings',
    '#️⃣',
    dataTable(
      ['Level', 'Text'],
      data.headings.map((h) => [html`H${h.level}`, html`${h.text || html`<span class="empty-note">(empty)</span>`}`]),
      'No headings found on the page.',
    ),
  );
}

function imagesSection(data: ExtractedData): Html {
  return reportSection(
    'images',
    'Images / Alt Text',
    '🖼️',
    dataTable(
      ['Image', 'Alt text', 'Format', 'Dimensions'],
      data.images.map((img) => [
        html`${img.src || html`<span class="empty-note">(no src)</span>`}`,
        img.alt === null
          ? html`<span class="empty-note">missing attribute</span>`
          : img.alt === ''
            ? html`<span class="empty-note">empty</span>`
            : html`${img.alt}`,
        img.format === null
          ? html`<span class="empty-note">unknown</span>`
          : html`${img.format.toUpperCase()}${img.isNextGenFormat === false ? html` <span class="empty-note">(not next-gen)</span>` : ''}`,
        img.width !== null && img.height !== null
          ? html`${img.width}×${img.height}`
          : html`<span class="empty-note">not specified</span>`,
      ]),
      'No images found on the page.',
    ),
  );
}

function schemaSection(data: ExtractedData): Html {
  const validatorUrl = `https://validator.schema.org/#url=${encodeURIComponent(data.url)}`;
  return reportSection(
    'schema',
    'Structured Data (JSON-LD)',
    '🧩',
    html`
      <p>Detected types: ${data.schema.detectedTypes.length > 0 ? data.schema.detectedTypes.join(', ') : html`<span class="empty-note">none</span>`}</p>
      ${data.schema.parseErrors.length > 0
        ? html`<p><strong>${data.schema.parseErrors.length} JSON-LD block(s) failed to parse.</strong></p>`
        : ''}
      <p><a class="tool-link" href="${validatorUrl}" target="_blank" rel="noopener noreferrer">Verify with Schema.org Validator ↗</a></p>
    `,
  );
}

function anchorTextCell(l: ExtractedData['links'][number]): Html {
  if (l.anchorText) return html`${l.anchorText}`;
  if (l.hasImageContent) {
    return l.imageAlt
      ? html`<span class="empty-note">(image link — alt: "${l.imageAlt}")</span>`
      : html`<span class="empty-note">(image link — no alt text)</span>`;
  }
  return html`<span class="empty-note">(empty — no text, no image; likely an icon or JS-driven control)</span>`;
}

function linkRowClass(l: ExtractedData['links'][number]): string | undefined {
  if (isBroken(l.finalStatus)) return 'row-fail';
  if (l.redirectChain.length > 0) return 'row-info';
  return undefined;
}

function linksSection(data: ExtractedData): Html {
  const rows = data.links.map((l) => [
    html`${l.resolvedUrl}`,
    l.isInternal ? 'internal' : 'external',
    anchorTextCell(l),
    l.finalStatus !== null ? String(l.finalStatus) : html`<span class="empty-note">error</span>`,
    l.redirectChain.length > 0 ? `${l.redirectChain.length} hop(s)` : '—',
  ]);
  const rowClasses = data.links.map(linkRowClass);
  return reportSection(
    'links',
    'Links / Redirects',
    '🔗',
    dataTable(['URL', 'Type', 'Anchor Text', 'Status', 'Redirects'], rows, 'No links found on the page.', rowClasses),
  );
}

function consoleErrorsSection(data: ExtractedData): Html {
  const errors = data.technical.consoleErrors;
  return reportSection(
    'console-errors',
    'Console Errors',
    '🖥️',
    dataTable(
      ['Type', 'Message', 'Location'],
      errors.map((e) => [html`${e.type}`, html`${e.text}`, html`${e.location ?? '—'}`]),
      'No console messages captured.',
    ),
  );
}

function performanceSection(data: ExtractedData, config: AppConfig): Html {
  const p = data.technical.performance;
  const t = config.thresholds;
  const isDesktopFallback = !data.technical.renderMode.finalModeIsMobile;
  const pageSpeedUrl = `https://pagespeed.web.dev/report?url=${encodeURIComponent(data.url)}`;
  return reportSection(
    'performance',
    isDesktopFallback ? 'Performance (desktop fallback)' : 'Performance (throttled mobile)',
    '⚡',
    html`
      ${isDesktopFallback
        ? html`<p class="empty-note">Mobile emulation was blocked for this crawl — figures below are from a desktop fallback, not true mobile conditions.</p>`
        : ''}
      <p><a class="tool-link" href="${pageSpeedUrl}" target="_blank" rel="noopener noreferrer">Test with PageSpeed Insights ↗</a></p>
      ${statGrid([
        statTile('Total load time', `${p.mobileLoadMs} ms`, budgetIndicator(p.mobileLoadMs, t.mobileLoadBudgetMs)),
        statTile(
          'Time to first byte',
          p.ttfbMs !== null ? `${Math.round(p.ttfbMs)} ms` : 'n/a',
          p.ttfbMs !== null ? budgetIndicator(p.ttfbMs, t.ttfbBudgetMs) : undefined,
        ),
        statTile(
          'DOM content loaded',
          p.domContentLoadedMs !== null ? `${Math.round(p.domContentLoadedMs)} ms` : 'n/a',
          p.domContentLoadedMs !== null ? budgetIndicator(p.domContentLoadedMs, t.domContentLoadedBudgetMs) : undefined,
        ),
        statTile(
          'Load event',
          p.loadEventMs !== null ? `${Math.round(p.loadEventMs)} ms` : 'n/a',
          p.loadEventMs !== null ? budgetIndicator(p.loadEventMs, t.loadEventBudgetMs) : undefined,
        ),
        statTile(
          'First Contentful Paint',
          p.fcpMs !== null ? `${Math.round(p.fcpMs)} ms` : 'n/a',
          p.fcpMs !== null ? budgetIndicator(p.fcpMs, t.fcpBudgetMs) : undefined,
        ),
        statTile(
          'Largest Contentful Paint',
          p.lcpMs !== null ? `${Math.round(p.lcpMs)} ms` : 'n/a',
          p.lcpMs !== null ? budgetIndicator(p.lcpMs, t.lcpBudgetMs) : undefined,
        ),
        statTile(
          'Cumulative Layout Shift',
          p.cls !== null ? p.cls.toFixed(3) : 'n/a',
          p.cls !== null ? clsIndicator(p.cls, t.clsBudget) : undefined,
        ),
      ])}
    `,
  );
}

function indexabilitySection(data: ExtractedData): Html {
  const t = data.technical;
  return reportSection(
    'indexability',
    'Indexability',
    '🔍',
    dataTable(
      ['Signal', 'Value'],
      [
        ['HTTPS', html`${t.isHttps ? 'yes' : 'no'}`],
        ['Mixed content resources', html`${t.mixedContentResources.length > 0 ? t.mixedContentResources.join(', ') : 'none'}`],
        ['robots.txt', html`${t.robotsTxt.fetched ? (t.robotsTxt.blocksUrl ? 'blocks this URL' : 'allows this URL') : 'not fetched'}`],
        ['sitemap.xml', html`${t.sitemap.present ? (t.sitemap.urlListed ? 'present, URL listed' : 'present, URL not listed') : 'not found'}`],
        ['llms.txt', html`${t.llmsTxt.present ? 'present' : 'missing'}`],
        ['Page redirect chain', html`${t.pageRedirectChain.length > 0 ? `${t.pageRedirectChain.length} hop(s)` : 'none'}`],
        ['Browser mode', html`${t.renderMode.finalModeIsMobile ? 'mobile (emulated)' : 'desktop (fallback — mobile was blocked)'}`],
      ].map(([label, value]) => [html`${label}`, value as Html]),
      'No indexability data.',
    ),
  );
}

export function renderCrawlReport(input: CrawlReportInput): Html {
  const { project, page, crawl, findings, config } = input;
  const data = crawl.raw_data;
  const body = html`
    ${blockedPageBanner(findings)}
    ${mobileFallbackBanner(findings)}
    ${summarySection(crawl)}
    ${findingsSection(findings)}
    ${metadataSection(data, config)}
    ${headingsSection(data)}
    ${imagesSection(data)}
    ${schemaSection(data)}
    ${linksSection(data)}
    ${consoleErrorsSection(data)}
    ${performanceSection(data, config)}
    ${indexabilitySection(data)}
  `;

  return layout({
    title: `Audit report — ${page.url}`,
    subtitle: `${project.domain} · crawled ${crawl.crawled_at.toLocaleString?.() ?? crawl.crawled_at}`,
    navLinks: NAV,
    body,
    headerActions: emailButton(input),
  });
}
