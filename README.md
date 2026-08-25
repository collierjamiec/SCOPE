# Organic Site Auditor

Copyright © 2026 Jamie C. Collier. All rights reserved.

A respectful, robots-aware website crawler for page metadata, keyword targeting, cannibalization signals, JSON-LD, CTA detection, PageSpeed, and SEO/GEO/AIO checks.

SCOPE means **Search & Content Optimization Performance Engine**. It distinguishes **AI Answer Readiness**, which can be measured from crawl evidence, from **AI visibility**, which requires platform citation, referral, or licensed monitoring data.

## Behavior and crawl scope

- Crawls every discoverable, allowed same-host HTML page by default. Use `--max-pages N` when you want a bounded sample.
- Produces at most 100 domain-level keyword candidates.
- Checks `robots.txt` before every page fetch.
- Excludes non-HTML, non-2xx, and `noindex` pages from page analysis, keyword aggregation, PageSpeed, and cannibalization detection.
- Crawls only the starting hostname and strips common tracking parameters.
- Records meta-description text and Unicode character count.
- Inventories robots-declared and conventional sitemaps, including sitemap type, status, entries, child sitemap count, and unique same-domain page URLs.
- Records redirect chains and final status without double-counting an already analyzed destination.
- Attributes internal 4xx/5xx destinations back to every source page and anchor text, and reports redirect sources, full chains, and final status in the dashboard, document, JSON, and `technical.csv`.
- Accepts manual path-prefix exclusions. `/blog` excludes both `/blog` and descendants such as `/blog/article-name`; patterns are site-specific and are never assumed automatically.
- Reports each page's HTTP status plus unique internal and external link counts.
- Flags missing alt text and generic/unoptimized image filenames, then recommends an SEO-friendly filename and concise alt text using the page's subject and keyword targets.
- Scores AI answer readiness across crawler/snippet accessibility (20), answer extractability (20), evidence and citation readiness (20), entity clarity (15), intent coverage (15), freshness (5), and multimodal accessibility (5).
- Checks robots access for OAI-SearchBot, Googlebot, and Bingbot; detects restrictive snippet controls; inventories question-led headings, answer passages, structured formats, authorship, dates, source links, and semantic/schema signals.
- When `IMAGE_ANALYSIS_ENDPOINT` and `IMAGE_ANALYSIS_API_KEY` are configured, the image adapter can inspect image content and return stronger visual recommendations. Without it, recommendations are explicitly labeled as page-context inferences.
- Rankings are `null` unless a licensed SERP provider is configured. The tool never treats inferred keywords as proven rankings.
- Cannibalization is a warning based on overlapping on-page targeting. Without SERP or Search Console data it cannot prove that two pages rank for the same query.

## Install and run

```bash
npm install
npm run dev -- --url https://example.com
```

Or launch the browser dashboard:

```bash
npm run dashboard
```

Open the displayed local URL, enter any starting page, and watch live robots, sitemap, crawl, PageSpeed, and keyword-analysis progress. Results appear in searchable browser-friendly tables, with DOCX and PDF downloads when LibreOffice is available.

Use the orange gear to open compact accordion settings for crawl scope, keyword analysis, audit modules, and connected data. Choose a **Quick scan**, **SEO audit**, **SEO + AIO**, **Full audit**, or customize the page limit, crawl pace, exclusions, discovery of up to 5,000 keywords, up to 100 licensed SERP checks, PageSpeed, image, broken-link, and schema analysis. GSC and GA4 CSV exports can be imported locally without sharing Google credentials; GSC query metrics enrich keyword findings and GA4 landing-page metrics enrich matching page records.

Unlimited crawls retain safety controls: configurable URL depth, a per-top-level-path URL ceiling, and normalization of common tracking parameters. The dashboard opens completed audits on a prioritized action roadmap and adds dedicated GSC and GA4 views when matching exports were supplied.

The default copyright owner and creator credit are **Jamie C. Collier** and can be overridden with `SCOPE_COPYRIGHT_OWNER` and `SCOPE_CREATOR_NAME`.

Completed reports can be downloaded as DOCX or PDF from the dashboard. SCOPE does not collect recipient addresses or send email; users can share the downloaded PDF through their own email service.

Useful options:

```bash
npm run dev -- --url https://example.com --max-pages 500 --max-keywords 100 --pagespeed --out audit-output
```

Exclude one or more sections with comma-separated path prefixes:

```bash
npm run dev -- --url https://example.com --exclude /blog,/careers
```

The output root contains one folder per domain. Each domain folder contains:

- `SCOPE-Audit-MM-DD-YYYY.docx` — a formatted document containing all findings
- `report.json` — complete machine-readable audit data
- `pages.csv` — page-level metadata and findings
- `keywords.csv` — keyword targeting, rankings, and competing pages
- `links.csv` — every discovered internal and external link with source page, anchor text, and destination
- `images.csv` — every flagged image with its issue, recommendation basis, suggested filename, and suggested alt text
- `technical.csv` — broken internal links with source page and anchor text, redirect chains, final status, and excluded URLs

For example: `audit-output/example.com/SCOPE-Audit-08-24-2026.docx`.

PageSpeed is off by default because it can be slow and quota-limited. Set `PAGESPEED_API_KEY` and add `--pagespeed` to enable mobile tests.

### Optional image-analysis adapter

Set `IMAGE_ANALYSIS_ENDPOINT` and `IMAGE_ANALYSIS_API_KEY` to enable visual inspection. The endpoint receives a POST body containing `imageUrl`, `pageUrl`, `pageTitle`, `primaryKeywords`, and `currentAlt`, and may return:

```json
{
  "description": "A receptionist answering a business call at a desk",
  "suggestedAlt": "Virtual receptionist answering a customer call",
  "suggestedFilename": "virtual-receptionist-answering-customer-call.webp"
}
```

## Optional licensed SERP integration

An interactive run asks whether you have a licensed SERP API. For automation, set:

```bash
SERP_ENDPOINT=https://your-adapter.example/rank \
SERP_API_KEY=secret \
npm run dev -- --url https://example.com --non-interactive
```

The endpoint receives an authenticated `POST` request:

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

This small adapter keeps vendor-specific credentials and response formats outside the crawler. Failed lookups remain unavailable rather than being guessed.

## Important interpretation notes

Keyword candidates are inferred from titles, descriptions, headings, and visible content. Rankings require a provider. CTA selection and cannibalization are confidence-based signals and should be reviewed. GEO/AIO findings are content-readiness heuristics, not promises of inclusion in an AI-generated answer.
