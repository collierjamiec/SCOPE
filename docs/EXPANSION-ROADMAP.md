# SCOPE expansion roadmap

This document records the product and measurement direction for SCOPE after reviewing the August 26, 2026 SE Ranking website-audit exports for `patlive.com` and `queerandunbroken.com`, the CRO planning notes, and the content-authority and competitive-analysis brief.

## Product direction

SCOPE should not become one increasingly crowded row of tabs. The durable information architecture is four top-level workspaces that share one evidence model:

1. **Site Health** — crawl, indexability, technical SEO, PageSpeed, schema, links, images, and findings.
2. **Content & Authority** — content quality, topical coverage, decay/debt, internal authority flow, conversion distance, and answer/citation readiness.
3. **Search & AI Visibility** — GSC, rankings, cannibalization, SERP features, AIO/AEO/GEO provider observations, citations, mentions, and prompts.
4. **Competition & Growth** — competitor selection, modeled provider data, live competitor audits, content gaps, Share of Voice, CRO, and business opportunities.

History is an account/domain-level layer shared by all four workspaces. Severity remains Critical, Warning, and Info, but every finding also needs a category, evidence class, confidence, effort, and affected business outcome so different analytical domains do not collapse into one undifferentiated list.

## What the SE Ranking audits add

The supplied reports are broad technical inventories, not ground truth. The PATLive export was capped at 500 crawled pages despite 2,835 discovered URLs, and the Queer & Unbroken export was capped at 1,000 pages despite 2,777 discovered URLs. Counts therefore describe the sampled crawl, not necessarily the entire domains. SE Ranking also groups provider-defined errors, warnings, and notices using its own thresholds; those labels must not be mapped directly onto SCOPE severity.

Useful technical checks not yet fully represented in SCOPE include:

- hreflang graph validation: language/region syntax, reciprocal links, self-reference, `x-default`, canonical agreement, and non-200 targets;
- multiple title, meta-description, canonical, and robots directives, including conflicts between HTML and HTTP headers;
- title length, H1 length, empty H1s, duplicate titles/descriptions/H1s, and identical Title/H1 signals with page-type-aware thresholds;
- internal links to redirects, internal/external `nofollow`, missing accessible link names, and redirect-to-error outcomes;
- image byte size and dimensions, not only filename and alt quality;
- HTML transfer size, content compression, cache headers, excessive CSS/JavaScript counts, unminified/uncompressed assets, and failed external resources;
- URL hygiene such as excessive length, duplicate slashes, malformed parameters, and inconsistent host/protocol variants;
- Open Graph, X/Twitter Card, favicon, certificate expiration/name, and legacy TLS checks;
- sitemap membership contradictions: non-canonical, noindex, redirected, blocked, or non-200 URLs submitted for indexing.

These checks should be prioritized by decision value. Sitemap contradictions, canonical failures, redirect-to-error paths, hreflang failures, and inaccessible resources materially affect discovery or experience. Missing social cards, identical Title/H1, and generic asset-minification notices are contextual enhancements and should not crowd out higher-impact work.

## High-value rules beyond SE Ranking

The most differentiated SCOPE opportunities are not simple checklist parity:

- **Schema-to-visible-content consistency:** verify that ratings, prices, authors, dates, FAQs, products, and review claims in JSON-LD agree with visible page evidence.
- **Content decay versus demand loss:** use dated GSC and GA4 periods to distinguish ranking loss, CTR loss, lower demand, seasonal movement, and measurement changes.
- **Content debt:** flag materially stale pricing, laws, product capabilities, statistics, links, or claims separately from a topic that has never been covered.
- **Intent-level cannibalization:** cluster queries and pages by likely task/intent, then distinguish healthy multi-page coverage from competing substitutes.
- **Internal authority flow:** model crawlable links, link placement, anchor relevance, click depth, nofollow, and target importance instead of relying only on raw inlink counts.
- **Content-to-conversion distance:** measure the minimum internal path from informational pages to relevant commercial actions and identify high-traffic dead ends.
- **Semantic completeness and format fit:** compare definitions, lists, tables, steps, evidence, alternatives, limitations, and follow-up questions with the format implied by the query.
- **Citation-worthiness:** inventory concise facts, original data, attributed expertise, dates, sources, and standalone answer passages that can be extracted safely by search and AI systems.
- **Entity and author trust:** detect named authors, reviewer credentials, organization identity, editorial policies, citations, and consistent entity relationships.
- **Intermittent reliability:** retain response status and latency distributions by page/template over time so transient outages are not mistaken for permanent faults.

## Competitive intelligence that supports business decisions

Competitive reporting should distinguish four roles:

- **Direct market competitors** sell a substitutable product or service.
- **Content competitors** win the same informational demand without selling the same thing.
- **SERP/platform competitors** such as Wikipedia, Instagram, directories, or video platforms occupy results but are not normal audit targets.
- **Strategic substitutes** solve the customer's underlying problem differently.

This classification matters. A Share of Voice export can contain all four, and blindly adding every domain to the competitor set creates bad strategy. SCOPE therefore keeps platforms/reference sites visible but excludes them from bulk “add market candidates” actions.

Recommended decision metrics:

- keyword and topic gaps segmented by funnel stage, search intent, geography, device, and branded/non-branded demand;
- Share of Voice and ranking distribution by topic cluster rather than only one domain-wide number;
- competitor-only keywords, source-only advantages, head-to-head wins, SERP-feature ownership, and landing-page overlap;
- publishing velocity, meaningful update velocity, content age, page-type mix, topical depth, and internal-link architecture;
- offer/message comparison: audience, pain point, promise, proof, pricing visibility, CTA, trust signals, and conversion path;
- backlink intersection and unique referring-domain opportunities, clearly separated from crawl-observed internal authority;
- content opportunity score combining demand, relevance, provider difficulty, current gap, conversion value, evidence confidence, freshness, and estimated effort;
- change attribution: distinguish a competitor gain from source-site loss, market-wide demand movement, an algorithmic/SERP change, and incomplete provider coverage;
- observed AIO/AEO/GEO citations and mentions by prompt, platform/model, cited URL, sentiment, and reporting period.

Every competitor crawl is retained in the normal historical database. Repeated provider imports for the same source, target, provider, market, and metric definition create provider-specific trend signals. These histories must remain separate from GSC/GA4 and must disclose changes to keyword sets, markets, devices, provider algorithms, and reporting coverage.

## CRO measurement plan

The CRO workspace should prioritize business questions rather than reproduce heatmaps or session replay. Microsoft Clarity remains the appropriate source for rage clicks, dead clicks, and recordings.

### Buildable from current crawl, GA4, and PageSpeed data

- high-traffic/high-exit landing pages with no clear CTA;
- CTA presence, destination, placement proxy, wording, and content-to-conversion distance;
- conversions/key events, engagement, bounce, sessions, and users by landing page when exported;
- device/channel conversion segmentation when those dimensions are supplied;
- PageSpeed/CWV versus conversion-rate cohorts, with minimum-sample warnings and no causal claims;
- new versus returning user conversion, day/time patterns, on-site search, scroll depth, and path depth when the required GA4 dimensions/events are supplied;
- quick-win scoring using traffic, observed friction, conversion opportunity, confidence, and estimated implementation effort.

### Requires additional instrumentation or richer exports

- field-level form abandonment and form-field friction;
- reliable assisted/multi-touch journeys and conversion lag;
- cross-device journeys beyond what consented Google Signals/User-ID reporting supports;
- trust-signal proximity and true above-the-fold visibility when browser rendering and viewport geometry are disabled;
- seasonal baselines without enough comparable historical periods or campaign annotations.

Missing inputs must be shown as missing, not inferred. CRO recommendations are hypotheses to test, not promised conversion gains.

## Evidence model and data quality guardrails

Every metric or finding should carry:

- source and evidence class: crawl-observed, Google first-party, provider-modeled, user-declared, or inferred;
- reporting period, import/run timestamp, property/market, country, device, and provider;
- grain and denominator, such as page, query-page, session, user, prompt-model, or domain-period;
- confidence and known coverage limits;
- comparable-series identifier so incompatible periods or provider definitions are not trended together.

Domain identity uses one shared normalizer across audit history, competitor relationships, provider imports, and dashboard joins. It lowercases the host, removes a trailing root dot and leading `www.`, preserves meaningful subdomains, and removes default ports. URL-level matching remains a separate operation because paths, query parameters, canonicals, and redirects require different rules.

## Delivery sequence

1. Technical parity with context: hreflang, duplicate metadata, header/HTML directive conflicts, sitemap contradictions, image/resource size, and asset delivery checks.
2. Competitive evidence quality: role classification, topic/funnel segmentation, import comparability, and historical provider-series tracking.
3. Content authority: decay/debt, semantic completeness, intent clustering, citation-worthiness, and internal authority flow.
4. CRO Wave 1: landing-page opportunity map, CTA/path diagnostics, GA4 segment imports, and quick wins.
5. CRO Wave 2/3 only after required GA4 events, dimensions, and instrumentation are validated.

