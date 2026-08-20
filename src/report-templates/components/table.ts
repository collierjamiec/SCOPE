import { html, type Html } from '../html.js';

/**
 * rowClasses is optional and parallel to rows (same index, same length) — pass
 * a CSS class per row (e.g. "row-fail") to tint it, or undefined for no tint.
 * Existing callers that don't need row-level styling can omit it entirely.
 */
export function dataTable(
  headers: string[],
  rows: (Html | string)[][],
  emptyMessage: string,
  rowClasses?: (string | undefined)[],
): Html {
  if (rows.length === 0) {
    return html`<p class="empty-note">${emptyMessage}</p>`;
  }
  return html`
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            ${headers.map((h) => html`<th scope="col">${h}</th>`)}
          </tr>
        </thead>
        <tbody>
          ${rows.map(
            (row, i) =>
              html`<tr class="${rowClasses?.[i] ?? ''}">${row.map((cell) => html`<td>${cell}</td>`)}</tr>`,
          )}
        </tbody>
      </table>
    </div>
  `;
}
