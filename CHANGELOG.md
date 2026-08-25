# Changelog

Notable changes to SCOPE are documented here. Dates use ISO format.

## Unreleased

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
