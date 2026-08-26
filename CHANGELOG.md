# Changelog

- Added MariaDB/Prisma historical audit storage, versioned trend APIs, a separate trends dashboard, configuration-aware finding deltas, recorded domain merges, irreversible staged history deletion, per-run artifact folders, stable finding fingerprints, orphan-page detection, click depth, schema coverage, crawlable/indexable rate, and time-series snapshots for GSC and PageSpeed metrics.

Notable changes to SCOPE are documented here. Dates use ISO format.

## Unreleased

- Added an explicit Potential keywords KPI and keyword-evidence narrative to audit executive summaries, separating observed GSC/SERP keywords from context-inferred targets and disclosing average/range heuristic confidence in both dashboard and document reports.
- Added historical traffic diagnostics and an executive summary covering direction, evidence, recurring issues, quick wins, and deeper SEO/AIO business guidance.
- Added competitor-domain configuration, audit launching, and audited-history status while keeping public crawl observations, first-party analytics, and modeled traffic estimates distinct.
- Retained GSC and GA4 traffic measurements at run and page level for longitudinal comparisons.

- Added full read-only historical audit dashboards, retained report JSON retrieval, original DOCX/PDF downloads, audit-date disclaimers, and an Open full report action for every stored run.
- Replaced the Trends domain dropdown and merge dropdown with separate searchable table modals showing audit counts, latest audit dates, and latest page counts.
- Refined main dashboard KPIs to show schema coverage, aggregate engagement rate, session-weighted bounce rate, sessions, and total users; moved keyword and severity totals into the Executive Summary.
- Added accessible KPI information icons with crawl/GSC/GA4 reporting-period provenance; the average GSC position context includes the number of observed ranking keywords contributing to the weighted average.
- Ensured the SCOPE crosshairs brand mark is explicitly rendered on read-only historical audit dashboards.
- Replaced the in-content MariaDB connection message with a fixed bottom-right database-status icon using green, yellow, and red states plus accessible status tooltips.
- Added GA4 bounce-rate ingestion, missing-data validation, sortable dashboard reporting, CSV export, DOCX/PDF reporting, and updated Explore export instructions.
- Improved report quality with rule-specific actions, stable run-history links, normalized orphan detection, interpreted redirect classifications, complete gated-auth exclusion, actionable JSON-LD syntax/property findings, search-operator filtering, evidence-weighted GSC cannibalization, missing-aware GA4 engagement rates, accessible link-name extraction, distinct image suggestions, collapsed social-share inventory, and wider report columns.
- Added self-initializing MariaDB startup, automatic `.env` loading and migration deployment, Docker Compose recovery for local installations, database health states, and clear first-baseline guidance in the Trends dashboard.

- Documentation synchronized with the current dashboard, crawler, imports, reports, and security model.
- OpenAI crawler reporting distinguishes search discovery, potential training, and user-initiated access.
- Intent-coverage scoring recognizes substantial editorial structure without requiring artificial commercial or FAQ headings, and recommendations disclose the precise missing signals.
- Sortable headers and contextual row filters are available throughout the reporting dashboard.
- Page-type classification applies archive-specific rules instead of judging archives like articles or landing pages.
- Full Audit now selects exhaustive maximum scope, every module, external depth 3, and Fast pacing.
- A written Executive Summary synthesizes overall health, severity, leading themes, and audit context without duplicating detailed tabs.
- Corrected GSC upload guidance and reporting-period detection to use the standard `Filters.csv`.
- Added a dedicated PageSpeed settings section and sortable PageSpeed dashboard with Lighthouse lab scores, timing metrics, errors, and available Chrome UX Report field data.
- Changed Full Audit to validate directly linked external URLs without crawling onward through external sites.
- Added a local, read-only Google Search Console OAuth connection with property/account switching and direct query-plus-page ranking imports. OAuth credentials and refresh tokens stay in a permission-restricted device-local file and are excluded from Git and reports.
- Store local OAuth credentials under the writable, Git-ignored installation `.scope/` directory by default; packaged installs can override the data path.
- Added an impression-weighted average GSC keyword-position KPI to the dashboard and generated report.
- Added PageSpeed request pacing, `Retry-After` handling, bounded retries for HTTP 429/5xx responses, and audit-wide quota-exhaustion classification.
- Added explicit GSC/GA4 reporting-period provenance throughout the dashboard and documents, GA4 date overrides and engagement-rate reporting, PageSpeed metric tooltips, and deterministic PDF/DOCX sorting for keywords and analytics.

## 2.0.0 — 2026-08-25

### Added

- Local dashboard with live progress, throughput, ETA, pause/resume, partial-report, and discard controls
- Full-site crawling with limits, exclusions, sitemap-only mode, safety ceilings, and tracking normalization
- Optional external-link crawling to depth 1–3
- SEO, GEO, AIO, readability, schema, CTA, PageSpeed, image, sitemap, redirect, and link analysis
- Exhaustive image inventory with CDN handling and optional visual analysis
- Prioritized findings, affected-page drilldowns, and severity definitions
- GSC and GA4 imports with dedicated sortable and filterable views
- GSC reporting-period detection from `Filters.csv`, with a custom date-dimension fallback
- Optional licensed organic SERP adapter
- Domain-scoped JSON, CSV, DOCX, and optional PDF reports
- SCOPE branding, logo, creator credit, and copyright footer

### Changed

- Keyword discovery supports up to 5,000 candidates and 100 separate SERP checks
- GSC-observed queries take precedence over inferred candidates
- Findings default to Critical → Warning → Info
- JavaScript rendering is selective when enabled
- Crawl pacing and concurrency were tuned for faster audits
- Pure trailing-slash normalization is omitted from redirect findings
- Gated/authentication redirects are separated from broken links

### Fixed

- False redirect attribution and Patreon unlock false positives
- GSC query/page ambiguity and missing period disclosure
- GA4 native-export headers and landing-page matching
- Duplicate and incomplete image rows
- Missing affected-page and AIO opportunity details
- Dashboard branding, settings, footer, progress text, and clipped explanations
