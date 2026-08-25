# Changelog

Notable changes to SCOPE are documented here. Dates use ISO format.

## Unreleased

- Documentation synchronized with the current dashboard, crawler, imports, reports, and security model.
- OpenAI crawler reporting distinguishes search discovery, potential training, and user-initiated access.
- Intent-coverage scoring recognizes substantial editorial structure without requiring artificial commercial or FAQ headings, and recommendations disclose the precise missing signals.

## 2.0.0 — 2026-08-25

### Added

- Local dashboard with live progress, throughput, ETA, pause/resume, partial-report, and discard controls
- Full-site crawling with limits, exclusions, sitemap-only mode, safety ceilings, and tracking normalization
- Optional external-link crawling to depth 1–3
- SEO, GEO, AIO, readability, schema, CTA, PageSpeed, image, sitemap, redirect, and link analysis
- Exhaustive image inventory with CDN handling and optional visual analysis
- Prioritized findings, affected-page drilldowns, and severity definitions
- GSC and GA4 imports with dedicated sortable and filterable views
- GSC reporting-period detection from `Dates.csv`
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
