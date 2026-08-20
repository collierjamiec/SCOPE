import { html, type Html } from './html.js';
import { layout } from './layout.js';
import { reportSection, statGrid, statTile } from './components/section.js';
import { dataTable } from './components/table.js';
import { statusBadge } from './components/badge.js';
import type { ProjectRow } from '../db/repositories/projects.js';
import type { ProjectRollup } from '../db/queries/rollup.js';

export interface ProjectRollupInput {
  project: ProjectRow;
  rollup: ProjectRollup;
  pageUrl: (pageId: number) => string;
}

const NAV = [
  { href: '#overview', label: 'Overview' },
  { href: '#schema-gaps', label: 'Schema Gaps' },
  { href: '#pages', label: 'Pages' },
];

function overviewSection(rollup: ProjectRollup): Html {
  return reportSection(
    'overview',
    'Overview',
    '📊',
    html`
      ${statGrid([
        statTile('Total pages', String(rollup.totalPages)),
        statTile('Passing', String(rollup.statusCounts.pass)),
        statTile('Warnings', String(rollup.statusCounts.warn)),
        statTile('Failing', String(rollup.statusCounts.fail)),
        statTile('Avg mobile load', rollup.avgMobileLoadMs !== null ? `${rollup.avgMobileLoadMs} ms` : 'n/a'),
        statTile('Broken links sitewide', String(rollup.totalBrokenLinks)),
        statTile('Long redirect chains sitewide', String(rollup.totalLongRedirectChains)),
      ])}
    `,
  );
}

function schemaGapsSection(rollup: ProjectRollup): Html {
  const rows = rollup.schemaGaps.map((g) => [
    g.label,
    String(g.missingPageCount),
    `${rollup.totalPages > 0 ? Math.round((g.missingPageCount / rollup.totalPages) * 100) : 0}%`,
  ]);
  return reportSection(
    'schema-gaps',
    'Schema Gaps',
    '🧩',
    dataTable(['Schema Type', 'Pages Missing', '% of Site'], rows, 'No schema checklist configured.'),
  );
}

function pagesSection(rollup: ProjectRollup, pageUrl: (id: number) => string): Html {
  const rows = rollup.latestCrawls.map(({ page, crawl }) => [
    html`<a href="${pageUrl(page.id)}">${page.url}</a>`,
    statusBadge(crawl.overall_status),
    String(crawl.pass_count),
    String(crawl.info_count),
    String(crawl.warn_count),
    String(crawl.fail_count),
    crawl.mobile_load_ms !== null ? `${crawl.mobile_load_ms} ms` : 'n/a',
  ]);
  return reportSection(
    'pages',
    'Pages',
    '📄',
    dataTable(['Page', 'Status', 'Pass', 'Info', 'Warn', 'Fail', 'Mobile Load'], rows, 'No pages crawled yet.'),
  );
}

export function renderProjectRollup({ project, rollup, pageUrl }: ProjectRollupInput): Html {
  const body = html`
    ${overviewSection(rollup)}
    ${schemaGapsSection(rollup)}
    ${pagesSection(rollup, pageUrl)}
  `;

  return layout({
    title: `Project rollup — ${project.domain}`,
    subtitle: `${rollup.totalPages} page(s) tracked`,
    navLinks: NAV,
    body,
  });
}
