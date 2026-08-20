# SEO/GEO Page Audit Tool (v1)

Rule-based structural SEO and GEO (generative engine optimization) audits for a single URL,
stored over time in MariaDB and rendered as self-contained HTML reports.

## Pipeline

```
Fetch & Render  ->  Extract  ->  Check  ->  Store  ->  Report
(Playwright,        (all raw   (rule-    (MariaDB)   (read-only,
 throttled mobile)   data)      based       always re-queries
                                 findings)   storage)
```

Every stage is a plain `Stage<TIn, TOut>` (see [src/pipeline/types.ts](src/pipeline/types.ts)),
composed by function call in [src/cli/commands/audit.ts](src/cli/commands/audit.ts) — a future
stage (e.g. a v2 LLM review pass) can be inserted without touching existing stages.

## Setup

1. Install dependencies:
   ```bash
   npm install
   npx playwright install chromium
   ```
2. Copy `.env.example` to `.env` and adjust if needed.
3. Start MariaDB:
   ```bash
   docker-compose up -d
   ```
4. Apply the schema:
   ```bash
   npm run migrate
   ```

## Usage

Run an audit against a URL — this writes to the database and renders an HTML report:

```bash
npm run audit -- --url https://example.com
npm run audit -- --url https://example.com --report-out ./my-report.html
```

Progress (current step + percentage) prints live to the terminal as the audit runs.
The report defaults to `reports/crawl-<id>.html` and can be opened directly in a browser.

Browse stored history in the local web viewer:

```bash
npm run web
```

Then open `http://localhost:4000` — project list → project rollup → page trend → single
crawl report.

## Extending checks

Add a new file under `src/pipeline/check/checks/` exporting a `CheckDefinition`, then add it
to the array in [src/pipeline/check/registry.ts](src/pipeline/check/registry.ts). No other
file needs to change. Expected schema.org types live as plain data in
[src/config/schemaChecklist.ts](src/config/schemaChecklist.ts); all tunable thresholds (speed
budget, title/meta length ranges, generic alt-text/anchor-text lists, throttle settings) live
in [src/config/thresholds.ts](src/config/thresholds.ts).

## Tests

```bash
npm test
```

## Roadmap

- **v2** — LLM judgment layer over the same extracted data (deferred, needs API budget)
- **v3** — full-site crawler reusing this per-URL pipeline
- **v4** — Google Search Console / Analytics data layered onto the rollup/trend views
