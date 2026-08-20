import { html, raw, type Html } from './html.js';
import { STYLES } from './styles.js';

export interface NavLink {
  href: string;
  label: string;
}

export interface LayoutOptions {
  title: string;
  subtitle: string;
  navLinks: NavLink[];
  body: Html;
  /** Optional action(s) (e.g. an "email this report" link) rendered in the header. */
  headerActions?: Html;
}

export function layout({ title, subtitle, navLinks, body, headerActions }: LayoutOptions): Html {
  return html`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>${raw(STYLES)}</style>
  </head>
  <body>
    <a class="skip-link" href="#main-content">Skip to main content</a>
    <header class="report-header">
      <div class="report-header-row">
        <div>
          <h1>${title}</h1>
          <p class="subtitle">${subtitle}</p>
        </div>
        ${headerActions ? html`<div class="header-actions">${headerActions}</div>` : ''}
      </div>
    </header>
    <nav class="report-nav" aria-label="Report sections">
      ${navLinks.map((link) => html`<a href="${link.href}">${link.label}</a>`)}
    </nav>
    <main id="main-content">${body}</main>
  </body>
</html>
`;
}
