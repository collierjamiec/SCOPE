# SCOPE

**Search & Content Optimization Performance Engine**

Copyright © 2026 Jamie C. Collier. All rights reserved.

SCOPE is a local, robots-aware website auditing application for SEO, GEO, and AIO answer readiness. It crawls an entire eligible website or a bounded sample, analyzes every indexable page, enriches findings with optional Google Search Console (GSC), Google Analytics 4 (GA4), PageSpeed, image-analysis, and licensed SERP data, then presents the results in a browser dashboard and downloadable reports.

SCOPE distinguishes **AIO answer readiness**, which can be assessed from crawl evidence, from **AI visibility**, which requires citation, referral, or licensed monitoring data. It never presents inferred keyword targeting as a proven organic ranking.

## What SCOPE audits

- SEO title, title length, meta description and character count, H1s, H2s, primary CTA and destination, canonical, language, viewport, HTTP status, and response time
- Full internal and external link inventories with source page, anchor text, and destination
- Broken internal links attributed to every source page
- Meaningful redirect chains and final status, excluding pure trailing-slash normalization
- Intentional gated and authentication flows, such as Patreon unlock links, classified separately instead of reported as broken
- XML sitemap discovery, type, status, entries, child sitemaps, and unique same-domain page URLs
- JSON-LD validity and detected schema types, separated from page-specific suggested schema
- Word, sentence, and paragraph counts; sentence length; reading time; text-to-HTML ratio; Flesch Reading Ease; and Flesch-Kincaid grade level
- Exhaustive image inventory, usage count, alt text, filename or CDN asset identifier, and optimization recommendations
- Optional PageSpeed Insights and Core Web Vitals
- SEO, GEO, and AIO opportunities with page-level findings and prioritized affected-page drilldowns
- AIO answer readiness across accessibility, extractability, evidence, entity clarity, intent coverage, freshness, and multimodal accessibility
- Keyword targeting, optional observed GSC queries, optional licensed SERP rankings, and cannibalization signals

## Crawl behavior and safeguards

- Crawls every discoverable, allowed same-host HTML page by default; an optional page limit can bound the audit.
- Checks `robots.txt` and excludes disallowed pages.
- Excludes non-HTML and non-indexable pages from organic analysis, keyword aggregation, PageSpeed, and cannibalization detection.
- Supports manual path-prefix exclusions. `/blog` excludes that path and all descendants without assuming every site has the same structure.
- Supports sitemap-only crawling and optional exclusion of tag, category, author, feed, search, and pagination archives.
- Normalizes common tracking parameters and applies configurable URL-depth and per-path ceilings.
- Inventories external links without requesting them by default. Full Audit validates each directly linked external URL but does not follow links beyond it. Custom audits may crawl external pages to depth 2 or 3 with a separate limit.
- Uses raw HTML by default and invokes Playwright only for pages that appear to require JavaScript rendering when that module is enabled.
- Supports pause, resume, partial-report completion, and cancellation without a report.
- Offers Fast, Standard, and Polite pacing. Throughput still depends on the target server, redirects, timeouts, JavaScript rendering, PageSpeed, and enabled modules.

## Dashboard

```bash
npm install
PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers npx playwright install chromium
npm run dashboard
```

Open the displayed local URL, enter a starting page, and use the orange gear to configure the audit. The modal provides Quick Scan, SEO Audit, SEO + AIO, Full Audit, and custom configurations.

**Full Audit** selects the entire eligible site, all audit modules, discovery of up to 5,000 keywords, and up to 100 licensed SERP checks. GSC and GA4 exports remain optional because they require user-provided data.

During a crawl, the dashboard shows live activity, fetched/analyzed/queued counts, throughput, ETA, and the current URL. Completed reports include priorities, pages, content, technical, AIO, keywords, GSC, GA4, images, and findings views.

Dashboard controls include:

- A written executive summary covering overall health, severity mix, leading themes, and audit context without reproducing the detailed tables
- Sortable headers across meaningful report columns, plus report-wide row search where a dedicated filter is not more useful
- Affected-page drilldowns for priorities and page findings
- Critical, warning, and informational finding filters
- Default finding order of Critical → Warning → Info
- Keyword sorting by source, position, keyword, target score, or confidence
- Keyword position filters for Top 10, 20, 30, 50, 100, and unavailable rankings
- GSC query/page search, metric sorting, direction, and position bands
- GA4 landing-page search, metric sorting, minimum sessions, and key-event filters

SCOPE classifies home, landing, article, category, tag, author, search, pagination, and feed surfaces. Indexable archives retain technical title, H1, canonical, status, link, and schema-validity checks, but are not penalized using article-style word-count, readability, H2, meta-description, schema-presence, or AIO-content rules. Instead, SCOPE asks whether archive indexation, canonicalization, pagination, and listing quality are intentional. Search archives receive stronger scrutiny when indexable.

Full Audit is exhaustive and Fast by default: no page or crawl-depth limit, no path exclusions, archive pages included, maximum per-path and external-page ceilings, external crawling to depth 3, all modules enabled, 5,000 keyword candidates, and 100 licensed SERP checks.

### Finding severity

Severity is rule-based and represents likely impact, not a guaranteed ranking outcome:

- **Critical:** likely blocks or invalidates crawling, indexability, access, or a foundational search requirement.
- **Warning:** a material quality, performance, or optimization risk that does not necessarily block indexing.
- **Info:** a non-blocking observation or enhancement opportunity.

### OpenAI and ChatGPT crawler access

OpenAI does not require publishers to place a proprietary discovery file on their websites. For eligibility to appear as cited content in ChatGPT search answers, the relevant control is `robots.txt` access for `OAI-SearchBot`. SCOPE reports this separately from:

- `GPTBot`, which controls potential crawling for training and is independent of ChatGPT search inclusion
- `ChatGPT-User`, which represents user-initiated page visits and is not a search-indexing control

SCOPE also reports Googlebot and Bingbot access for comparison. A missing `llms.txt` is not treated as an error or ranking problem because OpenAI does not require it. OpenAI-hosted files such as `searchbot.json` publish OpenAI crawler IP ranges and are not files a site owner installs on their own domain.

## Google Search Console imports

### Direct Search Console API connection

The dashboard can connect directly to the Google Search Console API using read-only OAuth access. This is the preferred method because SCOPE requests the `query` and `page` dimensions together, preserving the real keyword-to-landing-page relationship used for positions and cannibalization analysis.

On each installed device, open **Settings → Connected data → Google Search Console API**:

1. Create or select a Google Cloud project and enable the Google Search Console API.
2. Configure its OAuth consent screen.
3. Create an OAuth client for a **Desktop app**.
4. Paste the client ID and client secret into SCOPE and choose **Save locally & connect**.
5. Select the Google account, Search Console property, and reporting dates for the audit.

The OAuth client configuration and refresh token are stored only in the installation-local, Git-ignored SCOPE data directory (`.scope/google-search-console.json` by default) with owner-only file permissions. Packaged installations can set an OS-specific application-data location with `SCOPE_DATA_DIR`, or set an exact path with `SCOPE_GOOGLE_CREDENTIALS_FILE`. Credentials and tokens are never included in audit files, API responses, logs, or Git. The interface can reconnect with another Google account, disconnect the current account while retaining the installed OAuth client, or remove all locally stored Google credentials.

SCOPE requests finalized Web search data in pages of 25,000 rows, up to 50,000 query/page rows per audit. Google may still omit anonymized or lower-volume rows because of Search Console’s internal data limitations.

### CSV fallback

Observed GSC queries take precedence over inferred keyword candidates wherever both exist. GSC position is the impression-weighted average over the uploaded report period—not a live, current ranking.

From **Search Console → Performance → Search results**, select the intended date range and search type, enable Clicks, Impressions, Average CTR, and Average position, then export CSV. The standard export may be a ZIP containing several files. The dashboard accepts multiple files:

- `Queries.csv` — required for observed queries, clicks, impressions, CTR, and average position
- `Filters.csv` — strongly recommended because it records the selected date filter and other report filters; SCOPE displays exact dates when present or the filter label (such as “Last 3 months”) otherwise
- `Pages.csv` — optional page aggregate; it cannot connect individual queries to pages by itself

A normal Search Console export does **not** contain a combined Query + Page table. To map each query to landing pages, provide a custom CSV from the Search Analytics API using both `query` and `page` dimensions, or equivalent bulk data from BigQuery. Required columns are Query, Page, Clicks, Impressions, CTR, and Position.

If no `Filters.csv` is supplied, SCOPE explicitly reports that the reporting period is unavailable rather than implying positions are current. A custom date-dimension CSV can provide exact minimum and maximum dates as a fallback, but it is not part of every standard export.

## Google Analytics 4 imports

Export a GA4 report with a primary dimension of **Landing page** or **Landing page + query string**. Recommended columns are Sessions, Active users, Engaged sessions, Engagement rate, and Key events. SCOPE matches supported paths to crawled URLs and reports imported versus matched rows.

Use the same GSC and GA4 period when possible. Uploaded CSV contents are processed locally and omitted from persisted audit configuration.

## Command-line use

Run a full-site audit:

```bash
npm run dev -- --url https://example.com
```

Run a bounded audit with selected modules:

```bash
npm run dev -- --url https://example.com \
  --max-pages 500 \
  --max-keywords 1000 \
  --max-rankings 100 \
  --exclude /blog,/careers \
  --pagespeed \
  --render-js \
  --out audit-output
```

Use `npm run dev -- --help` for the authoritative CLI option list. Dashboard-only controls currently include data uploads, external-depth crawling, archive exclusion, sitemap-only discovery, and detailed crawl-safety controls.

## Reports and output files

```text
audit-output/
└── example.com/
    ├── SCOPE-Audit-MM-DD-YYYY.docx
    ├── SCOPE-Audit-MM-DD-YYYY.pdf
    ├── report.json
    ├── pages.csv
    ├── keywords.csv
    ├── links.csv
    ├── images.csv
    └── technical.csv
```

- `report.json` — complete machine-readable audit
- `pages.csv` — metadata, content metrics, schema, AIO, analytics, and findings
- `keywords.csv` — inferred and observed keywords, evidence, GSC metrics, rankings, and competing pages
- `links.csv` — every discovered link with source page, anchor text, and destination
- `images.csv` — exhaustive image inventory, occurrences, metadata, issues, and recommendations
- `technical.csv` — broken links, meaningful redirects, gated/authentication flows, checked external pages, and exclusions
- DOCX is always generated; PDF is available when LibreOffice is installed and conversion succeeds

SCOPE does not send reports by email. Users download the PDF and share it through their own service.

## Optional integrations

### PageSpeed Insights

PageSpeed is disabled by default because it runs a separate Google PageSpeed Insights request for every analyzed page, which adds time and may be quota-limited. Open **Settings → Performance & PageSpeed** to enable it, or pass `--pagespeed` on the CLI. Set `PAGESPEED_API_KEY` for larger audits.

When enabled, the dashboard adds a dedicated **PageSpeed** report with sortable, searchable per-page results: mobile Lighthouse performance, accessibility, best-practices and SEO scores; lab LCP, CLS, TBT, FCP and Speed Index; request errors; and field LCP, CLS and INP from Chrome UX Report data when Google has enough real-user observations. Lab and field data are identified separately.

### Licensed SERP provider

Without a licensed provider, SERP rankings remain unavailable. GSC average position may still appear when uploaded, but it is not equivalent to a live rank check.

```bash
SERP_ENDPOINT=https://your-adapter.example/rank \
SERP_API_KEY=secret \
npm run dev -- --url https://example.com --non-interactive
```

The adapter receives an authenticated POST request:

```json
{
  "keyword": "enterprise website crawler",
  "domain": "example.com",
  "country": "us",
  "language": "en",
  "device": "desktop",
  "organicOnly": true
}
```

It must return:

```json
{ "position": 8, "rankingUrl": "https://example.com/crawler" }
```

### Image-analysis adapter

Set `IMAGE_ANALYSIS_ENDPOINT` and `IMAGE_ANALYSIS_API_KEY` to enable visual inspection. Without one, recommendations are explicitly based on page context and target keywords.

The adapter receives `imageUrl`, `pageUrl`, `pageTitle`, `primaryKeywords`, and `currentAlt`, and may return:

```json
{
  "description": "A receptionist answering a business call at a desk",
  "suggestedAlt": "Virtual receptionist answering a customer call",
  "suggestedFilename": "virtual-receptionist-answering-customer-call.webp"
}
```

## Privacy, security, and interpretation

- API keys are read from environment variables and excluded from report configuration.
- GSC and GA4 files are processed locally; Google credentials are never requested.
- Audit only sites you are authorized to crawl and choose an appropriate pace.
- Keyword targeting, CTA selection, schema suggestions, cannibalization, GEO, and AIO findings are evidence-based heuristics requiring professional review.
- See [SECURITY.md](SECURITY.md), [CONTRIBUTING.md](CONTRIBUTING.md), and [CHANGELOG.md](CHANGELOG.md).

## License

SCOPE is proprietary. No permission is granted to use, copy, modify, merge, publish, distribute, sublicense, or sell the software without prior written permission from Jamie C. Collier. See [LICENSE](LICENSE).
