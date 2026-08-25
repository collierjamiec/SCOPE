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
- Inventories external links without requesting them by default. Dashboard users may check external pages to depth 1, 2, or 3 with a separate limit.
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

- Affected-page drilldowns for priorities and page findings
- Critical, warning, and informational finding filters
- Default finding order of Critical → Warning → Info
- Keyword sorting by source, position, keyword, target score, or confidence
- Keyword position filters for Top 10, 20, 30, 50, 100, and unavailable rankings
- GSC query/page search, metric sorting, direction, and position bands
- GA4 landing-page search, metric sorting, minimum sessions, and key-event filters

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

Observed GSC queries take precedence over inferred keyword candidates wherever both exist. GSC position is the impression-weighted average over the uploaded report period—not a live, current ranking.

From **Search Console → Performance → Search results**, select the intended date range and search type, enable Clicks, Impressions, Average CTR, and Average position, then export CSV. The standard export may be a ZIP containing several files. The dashboard accepts multiple files:

- `Queries.csv` — required for observed queries, clicks, impressions, CTR, and average position
- `Dates.csv` — strongly recommended so SCOPE can disclose the exact reporting period
- `Pages.csv` — optional page aggregate; it cannot connect individual queries to pages by itself

A normal Search Console export does **not** contain a combined Query + Page table. To map each query to landing pages, provide a custom CSV from the Search Analytics API using both `query` and `page` dimensions, or equivalent bulk data from BigQuery. Required columns are Query, Page, Clicks, Impressions, CTR, and Position.

If no `Dates.csv` is supplied, SCOPE explicitly reports that the reporting period is unavailable rather than implying positions are current.

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

PageSpeed is disabled by default because it is slower and may be quota-limited. Set `PAGESPEED_API_KEY` and enable it in the dashboard or pass `--pagespeed`.

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
