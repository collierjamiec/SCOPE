# SCOPE user guide

This guide is for people who want a useful audit without needing to understand the crawler's code.

## Start an audit

1. Open SCOPE and enter any page on the site. That page becomes the starting point; eligible internal links and sitemaps discover the rest of the site.
2. Choose the orange gear for settings.
3. Choose a preset or customize the modules.
4. Select **Start audit**.

**Full Audit** is exhaustive, fast, and enables every analysis module. It does not follow links onto external websites; it checks directly linked external destinations for valid responses. Use a Custom audit only when you intentionally want bounded external crawling.

During the run, watch URLs discovered/fetched, pages analyzed, findings by severity, elapsed time, throughput, ETA, and the current URL. When crawling ends, SCOPE changes the phase to analysis and report generation so the final processing period is not mistaken for a stalled crawl. You can pause, stop and keep a partial report, or cancel without generating a report.

## Choose modules

- **Technical:** statuses, meaningful redirects, broken links, canonicals, indexability, robots, sitemaps, crawl depth, and internal architecture.
- **Content:** titles, descriptions, headings, word/readability measurements, CTAs, freshness, duplicate and near-duplicate signals.
- **Schema:** JSON-LD parsing, types, property-level problems, and page-specific suggestions supported by visible content.
- **Images:** exhaustive inventory, alt text, opaque/CDN identifiers, filenames, repeated use, and context-based suggestions.
- **PageSpeed:** mobile Lighthouse and available field data. This adds time and may use Google quota.
- **Keywords:** inferred on-page targets, GSC-observed queries, licensed SERP positions when configured, and cannibalization.
- **AIO/AEO/GEO:** answer readiness, evidence, entities, direct answers, definitions, comparisons, numerical specificity, source provenance, freshness, visuals, and AI crawler access.
- **External links:** validate directly linked destinations or explicitly follow them to a bounded depth in a custom audit.

## Add first-party Google data

### Search Console

Use the read-only API connection when possible. Open **Settings → Connected data → Google Search Console API**, save the installed OAuth client locally, connect the correct Google account, select the property, and select the dates. The API can request Query + Page rows together, which is necessary for reliable keyword-to-landing-page and cannibalization evidence.

CSV fallback accepts the normal `Queries.csv`, `Pages.csv`, and `Filters.csv` export. `Filters.csv` provides the reporting period. Separate Queries and Pages aggregate files cannot reconstruct query-to-page relationships; SCOPE says so instead of guessing.

### Google Analytics 4

For the most complete landing-page table, use **Explore → Free form** with **Landing page + query string** as the row dimension and Sessions, Total users, Engaged sessions, Engagement rate, Bounce rate, and Key events as metrics. Export CSV. A standard Landing page export is accepted but may omit a rate; omitted fields remain “Unavailable,” never zero.

## Add provider data

- **Competitive intelligence:** import dated SE Ranking, Semrush, Ahrefs, or another provider CSV. SCOPE recognizes SE Ranking Positions Detailed, Positions History, Competitors Overall, and Share of Voice layouts.
- **AIO/AEO/GEO intelligence:** import prompt/engine/mention/citation/visibility CSVs, or use the optional SE Ranking AI Results Tracker connection.

Always select the provider, target, market, and exact dates. Provider traffic, rankings, Share of Voice, visibility, citations, and mentions are third-party observations or estimates; they are not GSC or GA4.

## Read the current audit dashboard

- **Executive:** overall health, severity mix, evidence coverage, and a written summary without repeating every table.
- **Priorities:** grouped actions with affected-page drilldowns.
- **Pages/Content/Technical/Images/PageSpeed:** page-level evidence. Sort and filter columns where meaningful.
- **Keywords/GSC/GA4:** source-labeled, date-labeled search and analytics evidence.
- **Cannibalization:** the competing pages, why the overlap was flagged, impression/click/position evidence when available, and the specific pages to compare.
- **AIO:** answer-readiness dimensions, advanced evidence, and exact opportunities.
- **Findings:** Critical, Warning, and Info in that default order with filters and definitions.

Use the information icon on KPI cards to see the metric's source, reporting dates, denominator, or limitation. Tooltips remain inside the viewport and are accessible by hover, focus, and keyboard.

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

Google OAuth, PageSpeed, and SE Ranking credentials can be stored locally with owner-only file permissions. They are never embedded in reports, MariaDB history, or Git. Each connection can be removed or replaced from the interface. Uploaded CSVs are processed locally; protect them and the generated reports as client/business data.

## Interpretation principles

- Observed crawl evidence describes what SCOPE fetched at that time.
- GSC/GA4 are first-party but limited to their selected property, dates, filters, privacy thresholds, and export/API coverage.
- Provider data is methodology-dependent and may disagree with Google or another provider.
- Inferred keywords and “likely why” explanations are hypotheses with disclosed confidence, not rankings or causal proof.
- Human usefulness comes before satisfying a checklist. Never add unsupported numbers, fake expertise, irrelevant FAQ blocks, or schema that the visible page cannot support.

