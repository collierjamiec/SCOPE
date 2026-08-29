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
- JSON-LD validity and detected schema types, including the reported JSON parse error or missing core property responsible for an invalid block, separated from page-specific suggested schema and remediation guidance
- Word, sentence, and paragraph counts; sentence length; reading time; text-to-HTML ratio; Flesch Reading Ease; and Flesch-Kincaid grade level
- Exhaustive image inventory, usage count, alt text, filename or CDN asset identifier, and optimization recommendations
- Optional PageSpeed Insights and Core Web Vitals
- SEO, GEO, and AIO opportunities with page-level findings and prioritized affected-page drilldowns
- AIO/AEO/GEO answer readiness across accessibility, extractability, evidence, entity clarity, intent coverage, freshness, and multimodal accessibility
- Advanced answer evidence: question-led direct answers, definition passages, comparison structures, attributed expertise, numerical specificity, apparent original data, source provenance, volatile-fact freshness, data-rich visuals with explanatory context, and sitewide entity-name consistency
- Keyword targeting, optional observed GSC query-to-page positions, optional licensed SERP rankings, and evidence-labeled cannibalization signals

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

**Full Audit** selects the entire eligible site, all audit modules, discovery of up to 5,000 keywords, and up to 100 licensed SERP checks. Direct GSC and GA4 connections and their CSV fallbacks remain optional because they require property-specific access or user-provided data.

During a crawl, the dashboard shows live activity, URLs fetched, pages analyzed, Critical/Warning/Info findings accumulated so far, a real-time elapsed clock, throughput, ETA, and the current URL. When fetching ends, the status changes to analysis and report-generation stages while SCOPE computes findings, writes the structured files, and retains history. The dashboard and DOCX complete without waiting for LibreOffice. PDF conversion starts on demand from the dashboard, runs behind a dedicated progress screen with live elapsed time, and has a ten-minute safety ceiling. Completed reports include priorities, pages, content, technical, AIO, keywords, GSC, GA4, images, and findings views. A privacy-sanitized, read-only diagnostic viewer is available at `/diagnostics`, with search, filters, and a formatted downloadable log.

Report interpretation is intentionally conservative: authentication/OAuth chains and trailing-slash normalization are excluded from SEO redirects; redirects are labeled deliberate, automatic-pattern, or unknown with supporting interpretation; omitted GA4 metrics remain unavailable rather than becoming zero; diagnostic search operators such as `site:` are excluded from keyword opportunities; and GSC cannibalization is suppressed when one landing page holds at least 90% of observed impressions.

Accessible link names are resolved from visible text, `aria-label`, `aria-labelledby`, title text, and common visually hidden label classes before SCOPE uses `[No anchor text]`. Whitespace-only visible content does not override an available accessible label.

## Historical trends and MariaDB

SCOPE retains every completed and intentionally saved partial audit in MariaDB. The normal dashboard startup is self-initializing: it loads `.env` automatically, uses the local-only bundled MariaDB configuration when `DATABASE_URL` is absent, starts the `mariadb` Docker Compose service when necessary, waits for it to become healthy, and applies pending schema migrations before opening the dashboard. Install and start Docker Desktop once, then use:

```bash
npm run dashboard
```

The Trends page reports four distinct states: database unavailable, connected and awaiting its first baseline, baseline available, and comparison history available. A successful audit is retained automatically; the first is the baseline and the next comparable audit for that domain produces deltas.

Historical storage is not limited to summary totals. `AuditRun` records retain crawl configuration fingerprints, ruleset versions, GSC/GA4 reporting periods, technical/search/analytics KPIs, and the saved report artifact. `RunFinding` records retain stable finding fingerprints, page URLs, severity, evidence, and rule identity; `RunDelta` classifies findings as opened, persisting, resolved, or reopened. `RunPageMetric` retains page-level crawl, search, analytics, schema, and performance measurements. Comparisons disclose when changed audit settings or rules make runs partially or non-comparable, and each retained run can be reopened as its original full dashboard.

Observed cannibalization uses GSC query-plus-page rows from the Search Analytics API. SCOPE compares page-level impressions, clicks, average position, strongest-page impression share, and position proximity. A single page holding at least 90% of impressions suppresses the alert; otherwise the dashboard distinguishes possible from likely overlap, identifies every competing landing page, and explains why each relationship was flagged. Without query-to-page evidence, SCOPE labels overlap as inferred on-page targeting rather than proven ranking cannibalization.

The separate Competitive Intelligence dashboard accepts provider-labeled, dated CSV exports. SE Ranking Positions Detailed, Positions History, Competitors Overall, and Share of Voice layouts are detected automatically. Position matrices and Share of Voice reports can extract candidate competitor domains, show ranking overlap, competitor-only keyword gaps, head-to-head wins, modeled Share of Voice, Top-20 coverage, and traffic forecasts, and offer one-click competitor configuration or a live SCOPE audit using the source domain's crawl settings. Broad platforms and reference sites remain visible as SERP competitors but are excluded from the bulk **Add market candidates** action. Provider rankings, visibility, and traffic forecasts remain explicitly labeled modeled estimates and are never merged with GSC or GA4 as first-party measurements.

Domain identity is normalized by one shared routine across audit history, competitor relationships, SE Ranking imports, and dashboard joins. It strips the scheme and a leading `www.`, lowercases the hostname, removes a trailing root dot and default ports, and preserves meaningful subdomains. URL matching remains intentionally separate because paths, parameters, canonicals, and redirects require page-level rules.

Advanced or shared installations can copy `.env.example` to `.env` and replace the example database passwords or point `DATABASE_URL` at an existing MariaDB service. Manual database commands remain available for administration:

```bash
npm run db:generate
npm run db:migrate
```

For a new development database without migration deployment, `npm run db:push` can synchronize the schema. Production and shared installations should use migrations. SCOPE never commits `.env`, database contents, OAuth credentials, or API keys to Git.

The separate `/trends` dashboard provides a searchable domain-history chooser, a separate searchable merge workflow, normalized severity and finding-movement charts, structural/search/performance metrics, configuration-comparability warnings, and a retained run table. It defaults to a like-for-like cohort matching the latest audit's scan type and analyzed-page population; users can select a 30-, 90-, 180-, or 365-day window or deliberately switch to an exploratory all-runs view. Issue and movement counts are shown per 100 analyzed pages, chart axes disclose that each metric is independently scaled, and GSC trends require equal-length reporting windows. Audit-date labels and exact GSC/GA4 periods remain visible in the chart context and run table. The domain tables show retained-audit counts, most-recent audit dates, and latest page counts so large libraries remain navigable. Every retained run has an **Open full report** action that rehydrates its saved `report.json` into the complete reporting dashboard, including all tabs, filtering, sorting, and its original DOCX/PDF downloads. Historical dashboards are read-only and carry a prominent audit-date disclaimer so they cannot be mistaken for current crawl data. Historical endpoints are versioned under `/api/v1/trends`. The browser dashboard remains bound to `127.0.0.1`; a future remotely exposed API should add authenticated, domain-scoped API keys before changing that binding.

Each run receives a stable ID and its own `audit-output/<domain>/<run-id>/` directory, preventing later audits from overwriting earlier files. Database records store structured metrics and artifact paths, not PDFs, OAuth tokens, API keys, or uploaded CSV contents.

Findings use a stable SHA-256 fingerprint derived from normalized domain, normalized page URL, durable rule ID, and a rule-specific discriminator where required. Comparisons report opened, resolved, reopened, and persisting findings. Runs with different comparison-affecting configurations or ruleset versions are explicitly marked partially comparable or not comparable.

History is retained indefinitely. Deleting a run or a domain’s complete history requires typing the exact displayed confirmation phrase. SCOPE removes both database records and the corresponding run directories using a staged quarantine process. Domain migrations are manual, recorded with a reason and actor, and preserve the original domain on historical runs.

The crawl graph now derives minimum click depth and confirmed orphan pages when the crawl is exhaustive. Pages reached only from sitemaps or other discovery sources with zero incoming internal links are reported as orphans; bounded/custom crawls do not make that definitive claim. Trend snapshots also retain stale-content counts, near-duplicate groups, heading-hierarchy violations, active mixed-content pages, canonical self-reference rate, canonical chains/non-200 targets, crawl-waste signals, schema coverage, crawlable/indexable rate, average GSC position, and available Core Web Vitals diagnostics.

Schema coverage is the percentage of analyzed pages carrying page-appropriate structured data, not merely generic sitewide schema. Crawlable/indexable rate uses sitemap URLs as its denominator. Canonical self-reference rate uses pages with a declared canonical as its denominator. Content is labeled stale after two years and aging after one year; these are review prompts, not automatic recommendations to change evergreen publication dates. Near-duplicate detection combines exact title/description matches with locality-bucketed SimHash candidates so large sites do not incur an all-pairs comparison. Similarity is direct-pair evidence only: unrelated pages are not joined through transitive chains. Every non-archive match names its exact partner URLs. Expected similarity among tag/category listing templates is informational and omitted from Priorities rather than treated as article duplication.

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

Full Audit is exhaustive and Fast by default: no page or internal crawl-depth limit, no path exclusions, archive pages included, all modules enabled, 5,000 keyword candidates, and 100 licensed SERP checks. It validates directly linked external URLs but does not follow them onto external sites; a custom audit can explicitly enable external crawling to a bounded depth.

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

The settings screen uses one shared Google reporting-period control for GSC and GA4. **Last 90 days** is the default; This month, Last month, Last 60 days, Last 6 months, Last year, Year to date, and synchronized custom dates are also available. Presets end on the latest commonly reliable date shared by the two Google services so comparisons never silently use unequal periods.

Optional URL Inspection enrichment adds Google’s indexed status, fetch/indexing state, selected canonical, and rich-result verdict for audited pages. The UI discloses Google’s 2,000-inspections-per-property daily quota and lets the user cap each audit.

Path controls are separate by design: crawl exclusions remove matching paths from every module, while PageSpeed-only exclusions preserve those pages everywhere else and skip only Google PageSpeed requests.

Historical persistence is failure-isolated from report delivery. Duplicate page/rule fingerprints and normalized page variants are deduplicated before the MariaDB transaction; when variants such as HTTP/HTTPS, www/non-www, trailing slashes, or tracking parameters collapse to one historical identity, SCOPE retains the strongest canonical/indexable representative for the time-series metric while leaving the complete crawl evidence in the report. Any remaining database failure produces a diagnostic warning while the completed dashboard, JSON, CSV, and DOCX outputs remain available.

The Schema dashboard inventories JSON-LD, Microdata, and RDFa and includes per-page, URL-prefilled links to the official Schema.org Markup Validator and Google Rich Results Test. SCOPE distinguishes parseable JSON from local structural/completeness checks, does not overrule Schema.org on extension-type names or optional properties such as `Organization.url`, and identifies malformed blocks by a best-effort, explicitly unvalidated likely `@type` when recoverable. It explicitly separates local screening from authoritative Schema.org validation and Google-specific rich-result eligibility.

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

GA4 reporting periods are read from native `Start date` / `End date` export metadata or a `Date` dimension when present. If the CSV omits both, enter the exact period beside the GA4 uploader. The dashboard, DOCX, and PDF explicitly disclose the date range and its source—or state that it is unavailable. GA4 landing-page reporting includes sessions, total users, engaged sessions, engagement rate, bounce rate, and key events, sorted by sessions descending in generated documents. The main dashboard summarizes total sessions and total users plus aggregate engagement and session-weighted bounce rate. Schema coverage is shown alongside these top-level health metrics; keyword and severity totals are summarized in Executive rather than consuming KPI cards.

## Google Analytics 4 data

### Direct GA4 Data API connection

The dashboard now connects directly to the Google Analytics Data API using read-only OAuth. This is the preferred path because it retrieves the dated landing-page rows and property-level aggregate totals together, eliminating manual exports and avoiding an incorrect “Total users” KPI created by summing non-additive page-level user counts.

Open **Settings → Connected data → Google Analytics 4 Data API**. Enable the Google Analytics Data API and Google Analytics Admin API in a Google Cloud project, configure the OAuth consent screen, create a **Desktop app** OAuth client, connect an account with access to the intended property, and select the property and dates. The installed client used for GSC can be reused, but GA4 still receives its own read-only authorization token.

OAuth connection and GA4 property discovery are reported independently. If Google accepts the account while the Analytics Admin API is disabled, SCOPE now shows **Connected · Action required**, provides the correct Google Cloud enablement link, and lets the user retry property access without repeating OAuth. A connected account with no visible properties instead prompts the user to verify GA4 Viewer access.

SCOPE requests **Landing page + query string** with Sessions, Total users, Engaged sessions, Engagement rate, Bounce rate, and Key events. It uses the page rows for URL drilldowns and Google’s aggregate totals for the headline GA4 KPIs. The property, exact dates, property time zone, privacy thresholding, high-cardinality data loss, and sampling indicators are retained in dashboard and downloadable-report provenance where available.

Credentials are stored locally in `.scope/google-analytics.json` by default with owner-only permissions. Use `SCOPE_DATA_DIR` for an installation-specific application-data directory or `SCOPE_GOOGLE_ANALYTICS_CREDENTIALS_FILE` for an exact path. They never enter reports, history, logs, browser status payloads, or Git. The interface supports account switching, disconnecting while retaining the installed client, and complete local removal.

The integration paginates high-cardinality reports, requests property quota state, and retries HTTP 429/500/503 responses with bounded backoff. `runReport` is implemented now; pivot, realtime, funnel, metadata-driven report building, and optional BigQuery event-level analysis remain documented extension points—not implied current features. See the [step-by-step GA4 Data API guide](docs/GA4-DATA-API.md).

The bottom-right PageSpeed indicator turns green immediately after a key is saved locally. This confirms local configuration, not a permanent Google connection: key validity, API restrictions, and current quota are verified when an audit makes a PageSpeed request.

### CSV fallback

For reliable engagement and bounce data without OAuth, create a GA4 **Explore → Free form** exploration with **Landing page + query string** as the row dimension and Sessions, Total users, Engaged sessions, Engagement rate, Bounce rate, and Key events as metrics, then export CSV. The standard Landing page detail report is also accepted, but it may omit either rate. SCOPE preserves a missing metric as **Unavailable in export** instead of silently converting it to 0.0%. SCOPE matches supported paths to crawled URLs and reports imported versus matched rows. When both sources are selected, the direct API takes precedence for that audit.

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
    └── <run-id>/
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

PageSpeed is disabled by default because it runs a separate Google PageSpeed Insights request for every analyzed page, which adds time and may be quota-limited. Open **Settings → Performance & PageSpeed** to enable it, or pass `--pagespeed` on the CLI. For larger audits, save a Google PageSpeed API key locally in that settings panel or set `PAGESPEED_API_KEY`. The locally saved key is stored at `.scope/pagespeed.json` with owner-only permissions and is excluded from Git and reports.

When enabled, the dashboard adds a dedicated **PageSpeed** report with sortable, searchable per-page results: mobile Lighthouse performance, accessibility, best-practices and SEO scores; lab LCP, CLS, TBT, FCP and Speed Index; request errors; and field LCP, CLS and INP from Chrome UX Report data when Google has enough real-user observations. Values use green/good, amber/needs-improvement, and red/poor threshold bands. SCOPE first requests URL-level CrUX data and transparently falls back to origin-level field data; when neither has sufficient samples it says so rather than showing an unexplained empty field.

Every PageSpeed column has a hover tooltip defining its acronym and explaining whether it is a lab Lighthouse diagnostic or real-user field measurement.

PageSpeed uses bounded parallel requests because Google accepts one URL per API request rather than a true multi-URL batch. Settings offer 1, 5 (default), 10, or 25 concurrent tests. Higher concurrency shortens the phase when quota and network capacity allow, but consumes quota faster and may trigger rate limiting. Transient HTTP 429/5xx responses are retried with exponential backoff or Google’s `Retry-After` instruction. If Google’s quota remains exhausted, SCOPE classifies the condition as a quota/rate-limit event and skips the remaining PageSpeed calls instead of repeatedly failing every page. Configure `PAGESPEED_API_KEY` with available quota for large, exhaustive audits.

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

### Optional SE Ranking connection

The **AIO/AEO/GEO Intelligence** workspace can connect to SE Ranking's AI Results Tracker. This connection is optional: SCOPE's native crawl continues to measure on-page answer readiness without it, and dated CSV imports remain available for competitive SEO and AI-visibility data.

In **AIO/AEO/GEO → Connect / sync SE Ranking API**:

1. Paste an SE Ranking API key and choose **Save locally & connect**.
2. Select the correct SE Ranking project.
3. Confirm the target domain/brand, market, and exact reporting period.
4. Decide whether to retrieve answer text, cited sources, and mentioned brands for a bounded number of prompts.
5. Choose **Sync selected period**. SCOPE imports the project's configured engines and prompts, rankings, mentions, citations, and available visibility observations.

The API key is stored at `.scope/seranking.json` by default with owner-only permissions. Packaged installs can set `SCOPE_DATA_DIR`, and administrators can set `SCOPE_SERANKING_CREDENTIALS_FILE` to an exact path. `SERANKING_API_KEY` is also accepted for managed environments. The key is never copied into MariaDB, audit artifacts, API responses, logs, or Git. Users can replace or remove the local key from the same dialog.

SCOPE uses SE Ranking's project-management and AI Results Tracker APIs. It does not silently call credit-metered Data API endpoints. Provider observations remain labeled **SE Ranking API**, with the engine, market, and reporting period; they are never merged with GSC or GA4.

Good prompt design matters more than prompt volume. Use a stable core set that covers category discovery, problem/solution questions, comparisons, objections, trust/proof, local or situational needs, decision-stage recommendations, and brand-description accuracy. Include branded and non-branded prompts, track equivalent prompts across engines when comparing them, configure legitimate brand aliases, and record changes to prompts, engines, markets, brands, or competitors because those changes can break trend comparability. See [AI intelligence and SE Ranking setup](docs/AI-INTELLIGENCE.md).

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

- API keys are read from environment variables or permission-restricted installation-local files and excluded from report configuration, history, and artifacts.
- GSC and GA4 files are processed locally; optional Google OAuth and SE Ranking credentials are stored locally, are removable/replaceable in the GUI, and are never embedded in reports.
- Audit only sites you are authorized to crawl and choose an appropriate pace.
- Keyword targeting, CTA selection, schema suggestions, cannibalization, GEO, and AIO findings are evidence-based heuristics requiring professional review.
- See [SECURITY.md](SECURITY.md), [CONTRIBUTING.md](CONTRIBUTING.md), and [CHANGELOG.md](CHANGELOG.md).

## Competitor and historical intelligence

The Trends dashboard includes source/date tooltips, an evidence-bounded traffic-change diagnosis, recurring-issue quick wins, and a historical executive summary. It distinguishes ranking loss, CTR loss, analytics divergence, and possible demand decline without claiming seasonality, algorithm changes, or competitor activity without evidence.

Use the dedicated **Competitive intelligence** dashboard to define competitor domains, launch public SCOPE crawls, and import provider evidence. Directly observed crawl measurements, first-party GSC/GA4 measurements, and optional third-party modeled estimates are separate evidence classes. Competitor sessions, users, and traffic must be labeled as estimates and are never blended with first-party GA4 totals. Every live competitor audit is retained in the same historical system as any other audited domain, while repeated imports for the same provider and target create a separate provider-specific trend series. Comparisons disclose reporting periods and retain modeled evidence outside first-party Google measurements.

Competitive intelligence now has its own `/competitive` dashboard, while crawl history remains at `/trends`. Competitor baseline launches inherit the source domain's latest crawl and audit settings but intentionally exclude source-domain GSC and GA4 data. Provider CSV imports retain provider, target, market, reporting period, original filename, normalized metrics, and rows.

The reviewed technical-parity, content-authority, CRO, AI-visibility, and competitive-measurement backlog is maintained in [the SCOPE expansion roadmap](docs/EXPANSION-ROADMAP.md). The companion [SE Ranking website-audit gap analysis](docs/SE-RANKING-AUDIT-GAP-ANALYSIS.md) documents the PATLive and Queer & Unbroken comparison, crawl-coverage limitations, parity matrix, and implementation priorities. These references keep provider checklists from overwhelming higher-value business diagnostics.

AIO/AEO/GEO intelligence has its own `/ai-intelligence` dashboard. It separates SCOPE answer-readiness signals from externally observed prompts, mentions, citations, platforms/models, sentiment, and provider visibility/share-of-voice exports. The optional SE Ranking API connection imports the configured AI Results Tracker prompt set and engines and can retrieve bounded answer/source/brand evidence. The prompt table identifies configured competitor appearances and produces a rule-based “likely why” hypothesis with a disclosed confidence legend and a specific verification step. These hypotheses do not claim access to a model's hidden ranking factors. Third-party methodologies are not assumed to be interchangeable or equivalent to Google first-party data.

The crawl-side advanced evidence model follows a human-first constraint. It rewards concise answer passages, definitions, comparison structure, attributed expertise, supported numbers, source provenance, current volatile facts, explanatory visual context, and consistent entities only when they improve the reader's experience. It does not recommend robotic prose, unsupported numerical precision, invented sources, or structured data unsupported by visible content. `Claim` and `Dataset` are valid Schema.org types in appropriate contexts; `citation` is a CreativeWork property. Their presence does not guarantee a Google rich result or an AI citation.

For feature-by-feature GUI instructions and evidence interpretation, see the [nontechnical user guide](docs/USER-GUIDE.md). For direct analytics setup and recovery, see [Connect Google Analytics 4 directly](docs/GA4-DATA-API.md). For prompt strategy, confidence rules, API behavior, and AI evidence definitions, see [AI intelligence and SE Ranking setup](docs/AI-INTELLIGENCE.md).

## License

SCOPE is proprietary. No permission is granted to use, copy, modify, merge, publish, distribute, sublicense, or sell the software without prior written permission from Jamie C. Collier. See [LICENSE](LICENSE).
