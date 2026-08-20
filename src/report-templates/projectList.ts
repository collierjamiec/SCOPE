import { html, type Html } from './html.js';
import { layout } from './layout.js';
import { reportSection } from './components/section.js';
import { dataTable } from './components/table.js';
import type { ProjectListEntry } from '../db/repositories/projects.js';

export interface ProjectListInput {
  projects: ProjectListEntry[];
  projectUrl: (projectId: number) => string;
}

export function renderProjectList({ projects, projectUrl }: ProjectListInput): Html {
  const rows = projects.map((p) => [
    html`<a href="${projectUrl(p.id)}">${p.domain}</a>`,
    String(p.page_count),
    p.last_crawled_at ? (p.last_crawled_at.toLocaleString?.() ?? String(p.last_crawled_at)) : html`<span class="empty-note">never</span>`,
  ]);

  const body = reportSection(
    'projects',
    'Projects',
    '🗂️',
    dataTable(['Domain', 'Pages Tracked', 'Last Crawled'], rows, 'No projects yet — run an audit to get started.'),
  );

  return layout({
    title: 'SEO/GEO Audit — Projects',
    subtitle: `${projects.length} project(s)`,
    navLinks: [{ href: '#projects', label: 'Projects' }],
    body,
  });
}
