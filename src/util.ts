export function cleanText(value: string | undefined | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

/** Canonical domain identity shared by history, competitive imports, and relationships. */
export function normalizeDomain(value: string): string {
  const url = new URL(value.includes('://') ? value : `https://${value}`);
  let host = url.hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
  if (url.port && !((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80'))) host += `:${url.port}`;
  return host;
}

export function normaliseUrl(input: string, base?: string): string | null {
  try {
    const url = new URL(input, base);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|gclid|fbclid)/i.test(key)) url.searchParams.delete(key);
    }
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
    return url.href;
  } catch { return null; }
}

export function sameHost(a: string, b: string): boolean {
  return new URL(a).hostname === new URL(b).hostname;
}

export function equivalentUrl(a: string, b: string): boolean {
  const normalize = (value: string) => {
    const url = new URL(value);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
    url.searchParams.sort();
    return url.href;
  };
  try { return normalize(a) === normalize(b); } catch { return false; }
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
