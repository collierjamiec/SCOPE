# Security Policy

## Supported version

Security updates target the latest commit on `main`.

## Reporting a vulnerability

Do not publish vulnerabilities, API keys, analytics data, or exploit details in a public issue. Contact Jamie C. Collier privately through the repository owner's verified GitHub contact channel. Include the impact, reproduction steps, affected commit and environment, and any suggested mitigation. Allow reasonable time for validation and remediation before disclosure.

## Operational security

- Run SCOPE in a trusted local environment. It binds to `127.0.0.1` by default and is not a public multi-user service.
- Never commit `.env` files, API keys, GSC/GA4 exports, generated audits, or client data.
- Supply integration credentials through environment variables or the permission-restricted local credential controls in the GUI. GSC OAuth, GA4 OAuth, PageSpeed, and SE Ranking credential files default to the Git-ignored `.scope/` directory with owner-only permissions. GSC and GA4 may reuse one installed OAuth client, but their refresh tokens remain separate because their read-only scopes differ.
- Treat uploads and generated reports as sensitive business data.
- Audit only authorized domains, respect `robots.txt`, and use an appropriate crawl pace.
- Review third-party adapter endpoints: SCOPE sends audit context to configured SERP and image-analysis services. An explicit SE Ranking sync sends only the selected project, reporting dates, and API requests required for the chosen AI Results Tracker data; SCOPE does not silently use credit-metered Data API endpoints.
- Keep Node.js, Playwright Chromium, and dependencies current.

## Trust boundaries

SCOPE fetches user-selected URLs and can optionally follow external links. The external crawler rejects private-network destinations, but the starting URL intentionally permits local development sites. Do not expose the dashboard to untrusted users who could submit arbitrary targets.

PDF conversion invokes locally installed LibreOffice when available. Protect DOCX, PDF, JSON, and CSV artifacts according to the sensitivity of the audited site and imported analytics.

Locally stored integration credentials are deliberately excluded from generated reports, MariaDB history, uploaded/imported dataset records, browser status API responses, and application logs. The GA4 Data API flow retains only non-secret provenance—property resource name, date range, aggregate metrics, property time zone, and returned data-quality flags. Removing or replacing a credential affects future requests only; retained first-party and provider observations keep their source and reporting-period labels but never retain the secret used to obtain them.
