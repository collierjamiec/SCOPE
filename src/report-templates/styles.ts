export const STYLES = `
  :root {
    --color-bg: #f7f8fa;
    --color-surface: #ffffff;
    --color-border: #dde1e6;
    --color-text: #1a1f27;
    --color-text-muted: #4b5563;
    --color-accent: #1d4ed8;
    --color-pass-bg: #e6f6ec;
    --color-pass-text: #096b32;
    --color-info-bg: #e8effc;
    --color-info-text: #1e429f;
    --color-warn-bg: #fff6e0;
    --color-warn-text: #7a5200;
    --color-fail-bg: #fdeaea;
    --color-fail-text: #9c1c1c;
    --radius: 10px;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: var(--color-bg);
    color: var(--color-text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.5;
  }

  a { color: var(--color-accent); }

  .skip-link {
    position: absolute;
    left: -9999px;
    top: 0;
    background: var(--color-accent);
    color: #fff;
    padding: 8px 12px;
    z-index: 100;
  }
  .skip-link:focus { left: 8px; top: 8px; }

  header.report-header {
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    padding: 24px clamp(16px, 4vw, 48px);
  }

  header.report-header h1 {
    margin: 0 0 4px;
    font-size: 1.5rem;
  }

  header.report-header .subtitle {
    color: var(--color-text-muted);
    font-size: 0.95rem;
    word-break: break-all;
  }

  .report-header-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .header-actions {
    flex-shrink: 0;
  }

  .email-button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--color-accent);
    color: #fff;
    text-decoration: none;
    font-size: 0.9rem;
    font-weight: 600;
    padding: 8px 16px;
    border-radius: var(--radius);
    white-space: nowrap;
  }
  .email-button:hover,
  .email-button:focus {
    opacity: 0.9;
  }

  .tool-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 1px solid var(--color-accent);
    color: var(--color-accent);
    text-decoration: none;
    font-size: 0.88rem;
    font-weight: 600;
    padding: 6px 14px;
    border-radius: var(--radius);
    margin: 4px 8px 4px 0;
  }
  .tool-link:hover,
  .tool-link:focus {
    background: var(--color-accent);
    color: #fff;
  }

  nav.report-nav {
    position: sticky;
    top: 0;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    padding: 10px clamp(16px, 4vw, 48px);
    overflow-x: auto;
    white-space: nowrap;
    z-index: 10;
  }

  nav.report-nav a {
    display: inline-block;
    margin-right: 18px;
    color: var(--color-text);
    text-decoration: none;
    font-size: 0.9rem;
    font-weight: 600;
    padding: 4px 2px;
    border-bottom: 2px solid transparent;
  }
  nav.report-nav a:hover,
  nav.report-nav a:focus {
    border-bottom-color: var(--color-accent);
  }

  main {
    max-width: 1080px;
    margin: 0 auto;
    padding: 24px clamp(16px, 4vw, 48px) 64px;
  }

  .blocked-banner {
    background: var(--color-fail-bg);
    color: var(--color-fail-text);
    border: 1px solid var(--color-fail-text);
    border-radius: var(--radius);
    padding: 16px clamp(16px, 3vw, 28px);
    margin-bottom: 24px;
  }
  .blocked-banner strong { font-size: 1.05rem; }
  .blocked-banner p { margin: 6px 0 0; }

  .fallback-banner {
    background: var(--color-warn-bg);
    color: var(--color-warn-text);
    border: 1px solid var(--color-warn-text);
    border-radius: var(--radius);
    padding: 16px clamp(16px, 3vw, 28px);
    margin-bottom: 24px;
  }
  .fallback-banner strong { font-size: 1.05rem; }
  .fallback-banner p { margin: 6px 0 0; }

  section.report-section {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 20px clamp(16px, 3vw, 28px);
    margin-bottom: 24px;
  }

  section.report-section h2 {
    margin-top: 0;
    font-size: 1.15rem;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
    margin: 12px 0;
  }

  .stat-tile {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 12px 16px;
  }

  .stat-tile .stat-value {
    font-size: 1.4rem;
    font-weight: 700;
  }

  .stat-tile .stat-label {
    color: var(--color-text-muted);
    font-size: 0.82rem;
  }

  .stat-tile .stat-indicator {
    margin-top: 8px;
  }

  .stat-tile .stat-indicator .badge {
    white-space: normal;
    text-align: left;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  th, td {
    text-align: left;
    padding: 8px 10px;
    border-bottom: 1px solid var(--color-border);
    vertical-align: top;
  }

  th {
    color: var(--color-text-muted);
    font-weight: 600;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .table-wrap { overflow-x: auto; }

  /* Row-level tints for the Links table: broken links (red) outrank redirected
     links (yellow) when a row is both — a 404 matters more than the fact it
     redirected on the way there. */
  tr.row-fail { background: var(--color-fail-bg); }
  tr.row-fail td { color: var(--color-fail-text); }
  tr.row-info { background: var(--color-warn-bg); }
  tr.row-info td { color: var(--color-warn-text); }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }
  .badge-pass { background: var(--color-pass-bg); color: var(--color-pass-text); }
  .badge-info { background: var(--color-info-bg); color: var(--color-info-text); }
  .badge-warn { background: var(--color-warn-bg); color: var(--color-warn-text); }
  .badge-fail { background: var(--color-fail-bg); color: var(--color-fail-text); }

  .badge-icon { font-size: 0.9em; }

  .empty-note {
    color: var(--color-text-muted);
    font-style: italic;
  }

  .diff-up { color: var(--color-fail-text); font-weight: 700; }
  .diff-down { color: var(--color-pass-text); font-weight: 700; }

  ul.plain-list { margin: 8px 0; padding-left: 20px; }
`;
