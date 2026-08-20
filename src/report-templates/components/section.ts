import { html, type Html } from '../html.js';

export function reportSection(id: string, title: string, icon: string, body: Html): Html {
  return html`
    <section class="report-section" id="${id}" aria-labelledby="${id}-heading">
      <h2 id="${id}-heading"><span aria-hidden="true">${icon}</span> ${title}</h2>
      ${body}
    </section>
  `;
}

export function statTile(label: string, value: string, indicator?: Html): Html {
  return html`
    <div class="stat-tile">
      <div class="stat-value">${value}</div>
      <div class="stat-label">${label}</div>
      ${indicator ? html`<div class="stat-indicator">${indicator}</div>` : ''}
    </div>
  `;
}

export function statGrid(tiles: Html[]): Html {
  return html`<div class="stat-grid">${tiles}</div>`;
}
