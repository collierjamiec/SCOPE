# Contributing to SCOPE

SCOPE is proprietary software maintained by Jamie C. Collier. Contributions require prior permission and do not change the ownership or terms in [LICENSE](LICENSE).

## Development setup

```bash
npm install
PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers npx playwright install chromium
npm test
npm run build
npm run dashboard
```

The dashboard defaults to `http://127.0.0.1:4173/`.

## Change expectations

- Preserve `robots.txt` compliance and indexability filtering.
- Never label inferred targeting as an observed ranking.
- Keep GSC average position distinct from live SERP position and disclose its period when known.
- Do not report authentication, membership, or paywall flows as broken solely because a provider rejects an unauthenticated crawler.
- Add regression tests for crawler classification, parsing, aggregation, and report changes.
- Keep dashboard, JSON, CSV, DOCX, and PDF terminology consistent.
- Never commit secrets, analytics exports, generated client reports, or sensitive data.

Before submitting a change:

```bash
npm test
npm run build
git diff --check
```

Document user-visible changes in [CHANGELOG.md](CHANGELOG.md).
