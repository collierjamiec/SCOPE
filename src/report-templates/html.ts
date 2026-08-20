/**
 * Minimal tagged-template HTML helper. Auto-escapes interpolated values; wrap
 * already-rendered HTML (e.g. the result of a nested `html` call, or an array
 * of them) and it passes through unescaped since it's an `Html` instance, not
 * a raw string. `false`/`null`/`undefined` render as nothing, so
 * `${condition && html\`...\`}` works for conditional sections.
 */
export class Html {
  constructor(private readonly value: string) {}
  toString(): string {
    return this.value;
  }
}

export function raw(value: string): Html {
  return new Html(value);
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stringifyValue(value: unknown): string {
  if (value instanceof Html) return value.toString();
  if (Array.isArray(value)) return value.map(stringifyValue).join('');
  if (value === null || value === undefined || value === false) return '';
  return escapeHtml(String(value));
}

export function html(strings: TemplateStringsArray, ...values: unknown[]): Html {
  let out = strings[0] ?? '';
  values.forEach((value, i) => {
    out += stringifyValue(value) + (strings[i + 1] ?? '');
  });
  return new Html(out);
}
