import type { PageResult } from './types.js';

const fixes: Record<string, { effort: 'low' | 'medium' | 'high'; recommendation: string }> = {
  missing_title: { effort: 'low', recommendation: 'Write a unique, descriptive SEO title aligned with the page intent.' },
  missing_meta_description: { effort: 'low', recommendation: 'Add a concise meta description that communicates value and supports click-through.' },
  missing_h1: { effort: 'low', recommendation: 'Add one clear primary heading that describes the page topic.' },
  broken_link: { effort: 'low', recommendation: 'Update, replace, or remove broken destinations and their internal references.' },
  thin_content: { effort: 'high', recommendation: 'Expand the page with original, intent-matched information or consolidate it into a stronger page.' },
  missing_schema: { effort: 'medium', recommendation: 'Add eligible JSON-LD that accurately represents the page and its primary entity.' },
  image_missing_alt: { effort: 'medium', recommendation: 'Add useful alternative text to informative images; retain empty alt text for decorative images.' }
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
    return { area: group.area, issue: group.issue, impact, effort: known?.effort ?? (impact === 'high' ? 'medium' as const : 'low' as const), affectedPages: group.pages.size, affectedUrls: [...group.pages].sort(), recommendation: known?.recommendation ?? `Review the affected pages and resolve this ${group.area} finding consistently.` };
  }).sort((a, b) => ({ high: 3, medium: 2, low: 1 }[b.impact] - { high: 3, medium: 2, low: 1 }[a.impact] || b.affectedPages - a.affectedPages)).slice(0, 25).map((item, index) => ({ rank: index + 1, ...item }));
}
