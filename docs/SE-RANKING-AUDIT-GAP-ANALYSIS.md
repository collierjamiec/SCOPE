# SE Ranking website-audit gap analysis

This review compares the August 26, 2026 SE Ranking website-audit PDFs for `patlive.com` and `queerandunbroken.com` with SCOPE's implemented crawler, dashboard, history, and planned intelligence modules. The goal is useful coverage, not one-for-one imitation.

## What the reports actually establish

| Audit | Crawled | Discovered | Provider health | Important limitation |
| --- | ---: | ---: | ---: | --- |
| PATLive | 500 pages | 2,835 URLs | 54/100 | Only 17.6% of discovered URLs were crawled. Counts cannot be treated as exhaustive site totals. |
| Queer & Unbroken | 1,000 pages | 2,777 URLs | 85/100 | Only 36.0% of discovered URLs were crawled. No Core Web Vitals result was available. |

SE Ranking reported 2,263 issue instances for PATLive and 5,369 for Queer & Unbroken. Those totals mix provider-defined errors, warnings, and notices, and some rules repeat the same shared-template or shared-resource problem for almost every crawled page. For example, the Queer & Unbroken PDF reports unminified JavaScript and CSS on 979 pages and external 4XX links on 979 pages. SCOPE should preserve every affected page while also grouping the common asset, destination, or template as one root cause.

The provider's health score and severity thresholds are not documented in the PDFs. SCOPE must not reproduce or translate them as though 54, 85, “error,” or “warning” had an objective meaning. SCOPE's severity remains tied to crawl/indexability risk and its confidence remains tied to evidence coverage.

## Coverage already stronger or more contextual in SCOPE

- Robots-aware crawling, indexability filtering, explicit noindex evidence, and page-type-aware treatment of category, tag, author, search, feed, and pagination archives.
- Broken-link source attribution, redirect chains, final status, authentication/gated-flow classification, and exclusion of pure trailing-slash normalization.
- Sitemap discovery, types, child sitemaps, entries, status, and same-domain URL inventory.
- Titles, title length, meta descriptions and character counts, headings, word/readability measurements, CTAs, schema validity, suggested schema, image inventory, and accessible link names.
- Canonical equivalence that treats a slash-only variant as the same URL instead of a different canonical target.
- Confirmed orphan pages and click depth only when crawl coverage is exhaustive enough to support the claim.
- Mobile PageSpeed/Lighthouse measurements, available Chrome UX Report field data, quota handling, and explicit “unavailable” states.
- Historical opened, persisting, resolved, and reopened findings with configuration and ruleset comparability.
- GSC, GA4, SE Ranking, crawl-observed, and inferred evidence kept separate with dates and provenance.

## High-value technical gaps to build

### Priority 0: discovery, indexability, and canonical integrity

1. **Indexability reason distribution.** Add a sitewide breakdown for indexable, noindex, robots-disallowed, non-HTML, non-200, canonicalized, and X-Robots-Tag outcomes. Counts need drilldowns and an explicit denominator.
2. **HTML/header robots conflicts.** Detect multiple or contradictory robots directives across meta robots, bot-specific meta tags, and `X-Robots-Tag` headers.
3. **Canonical target validation.** Request canonical targets and classify 3XX, 4XX, 5XX, blocked, noindex, and canonical-chain outcomes. Equivalent slash/host normalization stays suppressed unless signals conflict.
4. **Multiple canonicals.** Report more than one canonical declaration, including disagreements between HTML and HTTP `Link` headers.
5. **Sitemap contradictions.** Flag submitted URLs that redirect, fail, time out, are noindex, are robots-blocked, or are materially non-canonical. Also check sitemap size limits and whether robots.txt references a discoverable sitemap.
6. **Redirect-to-error paths.** Separate redirect chains ending in 4XX/5XX, loops, and likely permanent internal links pointing at temporary redirects.

### Priority 1: content uniqueness, internationalization, images, and link architecture

1. **Duplicate metadata and headings.** Add exact and near-duplicate title, description, and H1 groups; multiple/empty H1; title/H1 identity; and page-type-aware length thresholds. Do not penalize archive templates using article rules.
2. **Hreflang graph validation.** Validate language-region syntax, self-reference, reciprocal return links, `x-default`, canonical agreement, duplicate language declarations, and non-200 targets.
3. **Image delivery measurements.** Record decoded dimensions, declared dimensions, transfer bytes, format, loading behavior, 3XX/4XX/5XX outcomes, and oversized-image thresholds in addition to SCOPE's current alt/filename analysis.
4. **Link-attribute summaries.** Aggregate internal/external and follow/nofollow distributions; identify crawlable internal links to redirects; group blank accessible names; and distinguish link occurrences from unique destination URLs.
5. **URL hygiene.** Detect malformed/double slashes, excessive URL length, unstable or duplicative parameters, and inconsistent protocol/host variants. A missing trailing slash is not a finding by itself.
6. **Field-data distribution.** Show the percentage of tested origins/pages in Good, Needs Improvement, and Poor bands for LCP, INP, and CLS. Keep field and lab evidence separate.
7. **Desktop PageSpeed option.** SCOPE currently focuses on mobile. Add an optional desktop strategy and disclose that testing both doubles requests and quota pressure.

### Priority 2: resource delivery, security hygiene, and presentation metadata

1. **Resource inventory.** Track HTML, CSS, and JavaScript transfer size, compression, cache headers, minification heuristics, file counts, redirects, failures, and external-resource ownership.
2. **Root-cause grouping.** A single shared asset must produce one primary issue with an affected-page drilldown, not hundreds of indistinguishable rows.
3. **TLS and certificate checks.** Detect certificate expiration, hostname mismatch, obsolete TLS versions, and obsolete cipher configuration. Treat these as security/availability findings, not direct ranking guarantees.
4. **Social and browser metadata.** Check favicon, Open Graph, and X/Twitter Card coverage as shareability/presentation enhancements rather than high-severity SEO failures.
5. **Domain operations.** Optional domain-registration expiration monitoring can prevent operational outages. It is not an SEO score input.

## Provider-only or externally sourced metrics

The PDFs include backlink counts, referring domains, a proprietary Domain Trust value, estimated indexed-page counts, and domain expiration. SCOPE's crawler cannot independently observe inbound links from the wider web or a vendor's trust model.

- Import backlinks, referring domains, link attributes, lost links, and provider authority metrics through the vendor-neutral integration layer, with SE Ranking API/CSV as the first adapter.
- Label Domain Trust and estimated indexed-page counts as provider-modeled observations, never Google first-party truth.
- Treat `site:`-style result counts as rough diagnostics only. They are not reliable index-coverage measurements and must not replace GSC Page Indexing data.
- Retain provider, market, country, device, reporting period, keyword universe, and methodology/version when trending modeled values.

## Reporting lessons SCOPE should adopt

1. **Always disclose crawl coverage.** Show discovered, eligible, requested, fetched, analyzed, excluded, and capped counts. “Entire site” is only valid when the eligible queue is exhausted.
2. **Show indexability and robots distributions.** The overview charts in the PDFs make structural patterns visible before a user reaches individual URLs.
3. **Show link-type distributions.** Internal/external and follow/nofollow ratios are useful architecture context when paired with counts and affected destinations.
4. **Retain new/fixed movement.** SE Ranking's New and Fixed columns are useful; SCOPE's opened/resolved/reopened/persisting model is more explicit and should also aggregate by rule and module.
5. **Add Core Web Vitals band distributions.** Averages alone can hide a poor tail. Display both the population distribution and exact sample availability.

## Reporting patterns SCOPE should not adopt

1. **Opaque health scores.** A score without its formula, denominator, missing-data treatment, and rule weights is not decision-safe.
2. **Unbounded URL lists.** The supplied PDFs spend most pages repeating raw URLs. SCOPE should lead with root cause, affected templates/assets, representative examples, and a complete appendix/export.
3. **Template inflation.** One bad shared script, stylesheet, external link, or meta template should not look like hundreds of independent problems.
4. **Unavailable-as-clean.** Queer & Unbroken had no Core Web Vitals result; that is missing evidence, not passing performance.
5. **Unqualified archive penalties.** Archive indexability, sparse descriptions, and repeated headings require page-type and intent context.
6. **Provider severity translation.** SE Ranking errors/warnings/notices must not be mapped directly to SCOPE Critical/Warning/Info.

## Recommended implementation sequence

1. Canonical target checks, sitemap contradictions, robots conflicts, and redirect-to-error classification.
2. Duplicate metadata/H1 groups, hreflang graphs, image delivery fields, and link-attribute/site-architecture summaries.
3. Resource inventory with root-cause grouping, CWV band distributions, and optional desktop PageSpeed.
4. TLS/domain-expiration monitoring and social metadata checks.
5. Provider backlink/domain metrics through the same API-first, CSV-fallback, provenance-safe integration pattern used for SE Ranking.

Every new rule must ship with affected-page drilldowns, source evidence, scope/denominator, severity rationale, remediation guidance, historical fingerprinting, dashboard help, and PDF/DOCX coverage. That is the difference between adding another checklist and adding a trustworthy decision tool.
