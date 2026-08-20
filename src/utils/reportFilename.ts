import { getDomain } from './url.js';

function slugifyPath(pathname: string): string {
  const trimmed = pathname.replace(/^\/+|\/+$/g, '');
  if (!trimmed) return 'home';
  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || 'home';
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/**
 * e.g. "gaywitch.com__home__2026-08-20_010003__crawl-22.html" — domain and
 * page path make the file identifiable at a glance in a directory listing;
 * the crawl id suffix guarantees uniqueness even for two crawls of the same
 * page within the same second.
 */
export function buildReportFilename(url: string, crawledAt: Date, crawlId: number): string {
  const domain = getDomain(url);
  let pathname = '/';
  try {
    // decode first — otherwise a percent-encoded space ("%20") leaks its digits
    // into the slug as literal characters instead of acting as a separator.
    pathname = decodeURIComponent(new URL(url).pathname);
  } catch {
    // keep the '/' fallback — url should always be valid by this point anyway
  }
  const slug = slugifyPath(pathname);
  return `${domain}__${slug}__${formatTimestamp(crawledAt)}__crawl-${crawlId}.html`;
}
