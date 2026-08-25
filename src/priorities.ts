import type { PageResult } from './types.js';

const fixes: Record<string, { effort: 'low' | 'medium' | 'high'; recommendation: string }> = {
  title_missing: { effort: 'low', recommendation: 'Write a unique, descriptive SEO title for each affected page and align it with that page’s search intent.' },
  meta_description_missing: { effort: 'low', recommendation: 'Add a concise, page-specific meta description that communicates value and supports click-through.' },
  meta_description_length: { effort: 'low', recommendation: 'Rewrite each listed description so its important message is clear and unlikely to be truncated in search results.' },
  h1_missing: { effort: 'low', recommendation: 'Add one visible primary heading that accurately describes each affected page.' },
  broken_link: { effort: 'low', recommendation: 'Update, replace, or remove broken destinations and their internal references.' },
  thin_content: { effort: 'high', recommendation: 'Expand the page with original, intent-matched information or consolidate it into a stronger page.' },
  schema_missing: { effort: 'medium', recommendation: 'Add page-appropriate JSON-LD that accurately represents the visible content and primary entity.' },
  schema_invalid_json: { effort: 'low', recommendation: 'Correct the reported JSON syntax errors, then validate each affected block with Schema.org or Google’s rich-results tooling.' },
  image_alt_missing: { effort: 'medium', recommendation: 'Review the listed images and add distinct descriptive alt attributes to informative images; retain intentional empty alt attributes only for decorative images.' },
  canonical_missing: { effort: 'low', recommendation: 'Add a self-referencing canonical to each canonical indexable page.' },
  canonical_differs: { effort: 'medium', recommendation: 'Verify that each differing canonical intentionally consolidates the page; correct accidental cross-page canonicalization.' },
  viewport_missing: { effort: 'low', recommendation: 'Add a responsive viewport meta tag to the shared page template.' },
  heading_hierarchy_skipped: { effort: 'low', recommendation: 'Reorder heading levels so sections descend without skipping levels while preserving the visual design.' },
  mixed_content: { effort: 'medium', recommendation: 'Replace each reported HTTP asset URL with an HTTPS URL or remove the insecure resource.' },
  orphan_page: { effort: 'medium', recommendation: 'Add relevant contextual internal links to confirmed orphan pages, or intentionally noindex/remove pages that should not receive organic traffic.' }
};

const fallbackRecommendation = (rule: string, count: number) => {
  const subject = rule.replace(/^aio_/, '').replaceAll('_', ' ');
  if (rule.startsWith('aio_')) return `Improve ${subject} on the ${count} affected page${count === 1 ? '' : 's'} using the page-level evidence and AIO opportunity shown in this report.`;
  if (rule.includes('readability') || rule === 'long_sentences') return `Edit the ${count} affected page${count === 1 ? '' : 's'} for clearer sentences and audience-appropriate reading level without removing necessary detail.`;
  if (rule === 'content_stale' || rule === 'content_aging') return `Review dates, claims, links, and recommendations on the ${count} affected page${count === 1 ? '' : 's'}; update only material that is genuinely outdated.`;
  return `Resolve “${subject}” on the ${count} listed page${count === 1 ? '' : 's'} using the page-level evidence in this audit.`;
};

export function buildPriorities(pages: PageResult[]) {
  const groups = new Map<string, { area: string; issue: string; severity: string; pages: Set<string> }>();
  for (const page of pages) for (const finding of page.findings) {
    const key = finding.rule || finding.message;
    const group = groups.get(key) ?? { area: finding.category.toUpperCase(), issue: finding.message, severity: finding.severity, pages: new Set<string>() };
    group.pages.add(page.url); groups.set(key, group);
  }
  return [...groups.entries()].map(([rule, group]) => {
    const impact = group.severity === 'critical' || group.pages.size >= Math.max(3, pages.length * 0.3) ? 'high' as const : group.severity === 'warning' ? 'medium' as const : 'low' as const;
    const known = fixes[rule];
    return { area: group.area, issue: group.issue, impact, effort: known?.effort ?? (impact === 'high' ? 'medium' as const : 'low' as const), affectedPages: group.pages.size, affectedUrls: [...group.pages].sort(), recommendation: known?.recommendation ?? fallbackRecommendation(rule, group.pages.size) };
  }).sort((a, b) => ({ high: 3, medium: 2, low: 1 }[b.impact] - { high: 3, medium: 2, low: 1 }[a.impact] || b.affectedPages - a.affectedPages)).slice(0, 25).map((item, index) => ({ rank: index + 1, ...item }));
}
