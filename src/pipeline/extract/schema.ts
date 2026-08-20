import type { Page } from 'playwright';
import type { ExtractedSchema } from '../types.js';

function collectTypes(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) collectTypes(item, out);
    return;
  }
  if (!node || typeof node !== 'object') return;

  const obj = node as Record<string, unknown>;
  if (obj['@type']) {
    if (Array.isArray(obj['@type'])) {
      for (const t of obj['@type']) if (typeof t === 'string') out.add(t);
    } else if (typeof obj['@type'] === 'string') {
      out.add(obj['@type']);
    }
  }
  if (obj['@graph']) collectTypes(obj['@graph'], out);

  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') collectTypes(value, out);
  }
}

export async function extractSchema(page: Page): Promise<ExtractedSchema> {
  const rawTexts = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')).map(
      (el) => el.textContent ?? '',
    ),
  );

  const raw: unknown[] = [];
  const parseErrors: string[] = [];
  const detectedTypes = new Set<string>();

  for (const text of rawTexts) {
    try {
      const parsed = JSON.parse(text);
      raw.push(parsed);
      collectTypes(parsed, detectedTypes);
    } catch (err) {
      parseErrors.push(err instanceof Error ? err.message : 'Invalid JSON-LD');
    }
  }

  return { detectedTypes: Array.from(detectedTypes), raw, parseErrors };
}
