# SCOPE user guide

This guide is for people who want a useful audit without needing to understand the crawler's code.

## Start an audit

1. Open SCOPE and enter any page on the site. That page becomes the starting point; eligible internal links and sitemaps discover the rest of the site.
2. Choose the orange gear for settings.
3. Choose a preset or customize the modules.
4. Select **Start audit**.

**Full Audit** is exhaustive, fast, and enables every analysis module. It does not follow links onto external websites; it checks directly linked external destinations for valid responses. Use a Custom audit only when you intentionally want bounded external crawling.

During the run, the **Start audit** control is disabled and labeled **Audit running…** so a second launch cannot interrupt the active audit. It becomes available again only after the run completes, fails, or is cancelled without a report. Watch crawlable URLs discovered, URLs fetched, pages analyzed, findings by severity, a real-time elapsed clock, throughput, ETA, and the current URL. Counters are monotonic in the interface, so a late progress event cannot make completed work appear to move backward. When crawling ends, SCOPE changes the phase to PageSpeed, analysis, or report generation and shows measurements for that phase rather than mislabeling a fixed page count as crawl speed. **Stop & create partial report** aborts active PageSpeed requests/retry waits and proceeds to final analysis and report generation; **Cancel without report** stops without creating files. The dashboard and DOCX finish before PDF conversion. Choose **Download full PDF** to open an on-demand progress page; conversion runs in the background, shows live elapsed time, downloads when ready, and stops with an actionable diagnostic after ten minutes rather than blocking the audit.

## Choose modules

- **Technical:** statuses, meaningful redirects, broken links, canonicals, indexability, robots, sitemaps, crawl depth, and internal architecture.
- **Content:** titles, descriptions, headings, word/readability measurements, CTAs, freshness, duplicate and near-duplicate signals.
- **Schema:** JSON-LD parsing, types, property-level problems, and page-specific suggestions supported by visible content.
- **Images:** exhaustive inventory, exact image URLs, descriptive/missing/intentional-empty alt status, opaque/CDN identifiers, repeated use, current format, WebP/AVIF status, and context-based filename/alt suggestions.
- **PageSpeed:** mobile Lighthouse and available field data. This adds time and may use Google quota. Its live phase reports completed tests, eligible pages, remaining tests, percentage, and a phase-specific ETA. **Parallel PageSpeed tests** controls how many independent URL requests SCOPE permits in flight: 5 is the recommended default, 10 is faster, and 25 is aggressive and can consume quota quickly. Google does not offer a multi-URL PageSpeed endpoint, so this is bounded parallelism rather than one batch request. Enable **Skip PageSpeed tests on category and tag archives** to retain those pages in the SEO audit without spending a Lighthouse request on each archive listing.
- **Keywords:** inferred on-page targets, GSC-observed queries, licensed SERP positions when configured, and cannibalization.
- **AIO/AEO/GEO:** answer readiness, evidence, entities, direct answers, definitions, comparisons, numerical specificity, source provenance, freshness, visuals, and AI crawler access.
- **External links:** validate directly linked destinations or explicitly follow them to a bounded depth in a custom audit.

## Add first-party Google data

### Search Console

Use the read-only API connection when possible. Open **Settings → Connected data → Google Search Console API**, save the installed OAuth client locally, connect the correct Google account, select the property, and select the dates. The API can request Query + Page rows together, which is necessary for reliable keyword-to-landing-page and cannibalization evidence.

Use **Shared Google reporting period** to keep Search Console and GA4 comparisons aligned. Choose This month, Last month, Last 60 days, Last 90 days (the default), Last 6 months, Last year, or Year to date. Presets use the latest commonly reliable Google reporting date as their endpoint. Choosing custom dates—or editing either integration's dates directly—automatically mirrors the same start and end dates to the other Google integration.

When **Google URL Inspection enrichment** is enabled, SCOPE can also retrieve Google’s indexed-page verdict, fetch/indexing state, Google-selected canonical, and rich-result verdict for up to 2,000 audited URLs per property per day. This is Google’s view of its indexed copy, not a live crawl, and unavailable results are labeled rather than guessed.

### Excluding paths

Use **Excluded path prefixes** under Crawl scope to omit a path and all descendants from the entire audit. Use **PageSpeed-only excluded path prefixes** under Performance & PageSpeed when those pages should remain in the crawl, content, links, schema, and other reports but should not consume PageSpeed time or quota. Separate entries with commas or new lines; `/blog` matches `/blog` and pages below `/blog/`.

### Schema validation

The Schema dashboard distinguishes detected JSON-LD, local JSON/core-property checks, and suggested schema. Every reported page includes **Validate this page’s schema**, which opens that live URL in the official Schema.org Markup Validator. SCOPE’s suggestions are contextual recommendations—not proof of validity or Google rich-result eligibility. Use Schema.org validation for vocabulary/syntax and Google’s Rich Results Test or URL Inspection evidence for Google-specific eligibility.

CSV fallback accepts the normal `Queries.csv`, `Pages.csv`, and `Filters.csv` export. `Filters.csv` provides the reporting period. Separate Queries and Pages aggregate files cannot reconstruct query-to-page relationships; SCOPE says so instead of guessing.

### Google Analytics 4

Use the read-only direct connection when possible. Open **Settings → Connected data → Google Analytics 4 Data API**. Enable the Google Analytics Data API and Google Analytics Admin API in the same Google Cloud project used by the installed OAuth client, connect a Google account that can view the intended GA4 property, then choose the property and dates. You may reuse the installed GSC OAuth client, but Google still asks for separate GA4 read-only consent.

If the panel says **Connected · Action required**, the login and local token storage succeeded; only property discovery is blocked. Follow the in-app link to enable the Google Analytics Admin API, wait briefly for Google to apply the change, and select **Retry property access**. If it says **Connected · No properties found**, verify that the selected Google account has at least Viewer access to the GA4 property.

Direct API data is preferred because it supplies page rows and exact property-level totals. The **Total users** KPI therefore uses Google’s aggregate distinct-user total instead of adding non-additive users across landing pages. Hover or focus its information icon to see the property, reporting dates, time zone, and available quality caveats.

For CSV fallback, use **Explore → Free form** with **Landing page + query string** as the row dimension and Sessions, Total users, Engaged sessions, Engagement rate, Bounce rate, and Key events as metrics. Export CSV. A standard Landing page export is accepted but may omit a rate; omitted fields remain “Unavailable,” never zero. When both are selected, direct API data takes precedence for that audit. See [Connect Google Analytics 4 directly](GA4-DATA-API.md) for nontechnical setup, account switching, quota guidance, and troubleshooting.

## Add provider data

- **Competitive intelligence:** import dated SE Ranking, Semrush, Ahrefs, or another provider CSV. SCOPE recognizes SE Ranking Positions Detailed, Positions History, Competitors Overall, and Share of Voice layouts.
- **AIO/AEO/GEO intelligence:** import prompt/engine/mention/citation/visibility CSVs, or use the optional SE Ranking AI Results Tracker connection.

Always select the provider, target, market, and exact dates. Provider traffic, rankings, Share of Voice, visibility, citations, and mentions are third-party observations or estimates; they are not GSC or GA4.

## Read the current audit dashboard

- **Executive:** overall health, severity mix, evidence coverage, and a written summary without repeating every table.
- **Priorities:** grouped actions with affected-page drilldowns.
- **Pages/Content/Technical/Images/PageSpeed:** page-level evidence. Sort and filter columns where meaningful. Shared heading/template defects remain recorded, but Findings consolidates identical rules into one summary with an occurrence count and expandable evidence/page lists.
- **Keywords/GSC/GA4:** source-labeled, date-labeled search and analytics evidence.
- **Cannibalization:** one row per query or inferred intent cluster, with every competing page, why the overlap was flagged, and impression/click/position or inferred targeting evidence inside that consolidated row.
- **AIO:** answer-readiness dimensions, advanced evidence, and exact opportunities.
- **Findings:** Critical, Warning, and Info in that default order with filters and definitions.

Use the information icon on KPI cards to see the metric's source, reporting dates, denominator, or limitation. Tooltips remain inside the viewport and are accessible by hover, focus, and keyboard. The fixed bottom-right connectivity strip persists across the current audit, historical report, Trends, Competitive, and AIO/AEO/GEO dashboards. It shows database, GA4, GSC, PageSpeed Insights, and SE Ranking status without entering the report canvas. Green means a live request succeeded or the service is ready, yellow means optional setup or connection is incomplete, and red means a request failed, hung, exhausted quota, or the service is unavailable. A red icon remains red until a later successful request resolves it; its tooltip states what failed and the recommended fix. For PageSpeed, green before the first test can only confirm that a key is stored locally; the runtime health state updates when the audit actually calls Google. A CSV import counts as imported evidence for a report; it does not turn an API icon green. The orange SCOPE crosshairs mark is also used as the favicon on every application page.

## Diagnostics and crawl logs

Open the intentionally unlisted, read-only page at **`/diagnostics`** when an audit or integration behaves unexpectedly. SCOPE records the audit ID, timestamp, starting URL, non-secret crawl settings, phase changes, completion time, external-service failures, likely cause, reproduction context, and recommended resolution. It never records API keys, OAuth secrets, tokens, cookies, raw request bodies, or uploaded CSV contents. Search and filter the log in the browser, or choose **Download formatted log** for a landscape, fixed-column HTML document that can be printed or shared with technical support. Audit failure messages and completed audits with notices link directly to this page.

## Severity

- **Critical:** likely blocks or invalidates access, crawling, indexability, or a foundational requirement.
- **Warning:** a material quality, performance, or optimization risk that does not necessarily block indexing.
- **Info:** a non-blocking observation, review prompt, or enhancement opportunity.

Severity is rule-based; it is not a promised traffic impact. Priority also considers affected-page count and likely effort.

## History and trends

Every complete or intentionally saved partial audit is retained in MariaDB. The first run is a baseline. Comparable later runs can identify opened, persisting, resolved, and reopened findings. Use the searchable domain chooser rather than a long dropdown. Every retained run can be reopened as its original full, read-only dashboard with an audit-date disclaimer and its original PDF/DOCX.

Only compare runs with compatible scope and modules. SCOPE labels partial or non-comparable runs and keeps provider trend series separate from crawl and Google first-party series.

## Competitors

Use **Competitive intelligence** to add direct competitor domains, review detected provider competitors, and launch public audits. A competitor baseline inherits the source site's crawl settings but intentionally does not inherit source-only GSC or GA4 access. Repeated competitor audits create normal competitor history.

Treat directories, publishers, social platforms, reference sites, and strategic substitutes differently from direct market competitors. A domain can compete for attention without selling the same solution.

## Download and share

The dashboard is the primary interactive report. Download the full PDF for a shareable document or DOCX for editing. CSV files provide page, keyword, link, image, and technical inventories. Reports include data-source and date disclosures and full actionable URLs where the dashboard uses shorter titles.

SCOPE does not email reports. Download and send them through your preferred service.

## Credentials and privacy

GSC OAuth, GA4 OAuth, PageSpeed, and SE Ranking credentials can be stored locally with owner-only file permissions. GSC and GA4 use separate refresh tokens because they request different read-only scopes, even when they reuse one installed Google OAuth client. Secrets are never embedded in reports, MariaDB history, browser status responses, logs, or Git. Each connection can be disconnected, removed, or replaced from the interface. Uploaded CSVs are processed locally; protect them and the generated reports as client/business data.

## Interpretation principles

- Observed crawl evidence describes what SCOPE fetched at that time.
- GSC/GA4 are first-party but limited to their selected property, dates, filters, privacy thresholds, and export/API coverage.
- Provider data is methodology-dependent and may disagree with Google or another provider.
- Inferred keywords and “likely why” explanations are hypotheses with disclosed confidence, not rankings or causal proof.
- Human usefulness comes before satisfying a checklist. Never add unsupported numbers, fake expertise, irrelevant FAQ blocks, or schema that the visible page cannot support.
