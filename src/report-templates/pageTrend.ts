import { html, type Html } from './html.js';
import { layout } from './layout.js';
import { reportSection, statGrid, statTile } from './components/section.js';
import { dataTable } from './components/table.js';
import { statusBadge } from './components/badge.js';
import type { ProjectRow } from '../db/repositories/projects.js';
import type { PageRow } from '../db/repositories/pages.js';
import type { PageTrend } from '../db/queries/trend.js';

export interface PageTrendInput {
  project: ProjectRow;
  page: PageRow;
  trend: PageTrend;
  /** URL builder for a given crawl id, so this template stays storage-agnostic about routing. */
  crawlUrl: (crawlId: number) => string;
}

const NAV = [
  { href: '#current', label: 'Current State' },
  { href: '#since-last', label: 'Since Last Crawl' },
  { href: '#history', label: 'Crawl History' },
];

function currentSection(trend: PageTrend): Html {
  const latest = trend.crawls[0];
  if (!latest) {
    return reportSection('current', 'Current State', '📍', html`<p class="empty-note">No crawls recorded yet.</p>`);
  }
  return reportSection(
    'current',
    'Current State',
    '📍',
    html`
      <p>Overall status: ${statusBadge(latest.overall_status)}</p>
      ${statGrid([
        statTile('Passing checks', String(latest.pass_count)),
        statTile('Info', String(latest.info_count)),
        statTile('Warnings', String(latest.warn_count)),
        statTile('Failing checks', String(latest.fail_count)),
        statTile('Mobile load time', latest.mobile_load_ms !== null ? `${latest.mobile_load_ms} ms` : 'n/a'),
      ])}
    `,
  );
}

function sinceLastSection(trend: PageTrend): Html {
  if (trend.crawls.length < 2) {
    return reportSection(
      'since-last',
      'Since Last Crawl',
      '🔄',
      html`<p class="empty-note">Not enough crawl history yet to compare — run another audit to see a trend.</p>`,
    );
  }
  const rows = trend.diffSinceLastCrawl.map((d) => [
    html`<code>${d.checkId}</code>`,
    d.previousStatus ? statusBadge(d.previousStatus) : html`<span class="empty-note">new</span>`,
    d.currentStatus ? statusBadge(d.currentStatus) : html`<span class="empty-note">removed</span>`,
    html`${d.detail}`,
  ]);
  return reportSection(
    'since-last',
    'Since Last Crawl',
    '🔄',
    dataTable(['Check', 'Previous', 'Current', 'Detail'], rows, 'No change in any check since the previous crawl.'),
  );
}

function historySection(trend: PageTrend, crawlUrl: (id: number) => string): Html {
  const rows = trend.crawls.map((c) => [
    html`<a href="${crawlUrl(c.id)}">${c.crawled_at.toLocaleString?.() ?? String(c.crawled_at)}</a>`,
    statusBadge(c.overall_status),
    String(c.pass_count),
    String(c.info_count),
    String(c.warn_count),
    String(c.fail_count),
    c.mobile_load_ms !== null ? `${c.mobile_load_ms} ms` : 'n/a',
  ]);
  return reportSection(
    'history',
    'Crawl History',
    '🕒',
    dataTable(['Crawled At', 'Status', 'Pass', 'Info', 'Warn', 'Fail', 'Mobile Load'], rows, 'No crawls recorded yet.'),
  );
}

export function renderPageTrend({ project, page, trend, crawlUrl }: PageTrendInput): Html {
  const body = html`
    ${currentSection(trend)}
    ${sinceLastSection(trend)}
    ${historySection(trend, crawlUrl)}
  `;

  return layout({
    title: `Trend — ${page.url}`,
    subtitle: `${project.domain} · ${trend.crawls.length} crawl(s) recorded`,
    navLinks: NAV,
    body,
  });
}
