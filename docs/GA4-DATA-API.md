# Connect Google Analytics 4 directly

SCOPE’s preferred GA4 source is the read-only Google Analytics Data API. It retrieves a dated landing-page report when an audit starts, preserves the property and reporting period, and keeps CSV import available as a fallback.

## What the connection adds

The first direct report uses one dimension—**Landing page + query string**—and six GA4 metrics:

- Sessions
- Total users
- Engaged sessions
- Engagement rate
- Bounce rate
- Key events

The page table is matched to crawled URLs. SCOPE separately retains the Data API’s aggregate totals for dashboard and historical KPIs. This matters because adding Total users from many landing-page rows can count the same person more than once; the API aggregate is the correct property-level value for the selected period.

SCOPE records Google’s property time zone and whether the response reports privacy thresholding, high-cardinality “other” row data loss, or sampling. These are evidence limitations, not crawl failures.

## One-time Google Cloud setup

1. Sign in to [Google Cloud Console](https://console.cloud.google.com/) and create or select a project.
2. In **APIs & Services → Library**, enable both **Google Analytics Data API** and **Google Analytics Admin API**. The Data API supplies reports; the Admin API lists the properties the connected user can access.
3. Open **APIs & Services → OAuth consent screen** and complete the requested app details. For a private/local installation, add the intended Google accounts as test users if Google requires it.
4. Open **APIs & Services → Credentials → Create credentials → OAuth client ID**.
5. Choose **Desktop app**. Copy the client ID and, when supplied, the client secret.
6. In SCOPE, open the orange gear, then **Connected data → Google Analytics 4 Data API**.
7. Either paste the installed client credentials and choose **Save locally & connect**, or choose **Reuse saved GSC OAuth client**. Reusing the client avoids duplicate setup, but GA4 still requires its own read-only consent because it uses a different scope.
8. Complete Google’s authorization window, then return to SCOPE. Select the correct GA4 property and reporting period.
9. Keep **Use GA4 Data API data for this audit** selected and start the audit.

## Security and account switching

The GA4 OAuth client and refresh token are stored in `.scope/google-analytics.json` by default with owner-only file permissions. Packaged installations should set `SCOPE_DATA_DIR` to an operating-system application-data directory; an exact path can be supplied with `SCOPE_GOOGLE_ANALYTICS_CREDENTIALS_FILE`.

Credentials and tokens are never written into audit JSON, CSV, DOCX, PDF, MariaDB history, browser status responses, application logs, or Git.

- **Choose another Google account** replaces the connected account while retaining the installed OAuth client.
- **Disconnect account** removes the refresh token but retains the installed client.
- **Remove local credentials** removes the installed client and token from this device.
- Connecting a client’s account does not grant SCOPE access beyond the properties that Google account can already view.

## Dates, quota, and data expectations

Every direct request uses the exact start and end dates selected in SCOPE. The dashboard and downloadable reports disclose those dates, the GA4 property, source, property time zone, and applicable quality warnings.

SCOPE uses a single high-cardinality landing-page dimension and six metrics—well within the Data API’s current per-query column limits. It requests up to 250,000 rows per API call, paginates when necessary, asks Google to return property-quota information, and retries HTTP 429, 500, and 503 responses with bounded exponential or `Retry-After` backoff. A persistent quota or permission failure stops the audit setup with a plain-language error rather than silently continuing without the requested source.

GA4 can differ from browser-side reports because of property configuration, consent mode, identity settings, privacy thresholds, data retention, filters, processing latency, time zone, and metric compatibility. SCOPE labels these boundaries; it does not invent missing data.

## CSV fallback

If direct connection is unavailable, create a GA4 **Explore → Free form** exploration using **Landing page + query string** as the row dimension and the six metrics listed above, then export CSV. Enter the exact period beside the uploader if the export omits `Start date` and `End date` metadata.

When both are selected, direct API data takes precedence for that audit. CSV files are processed locally and are not persisted in the saved audit configuration.

## Troubleshooting

- **No properties appear:** confirm the connected Google account has at least Viewer access in GA4 and that the Google Analytics Admin API is enabled in the OAuth client’s Cloud project.
- **Access blocked or app not verified:** add the account as an OAuth test user or complete the consent-screen configuration appropriate to the installation.
- **No refresh token returned:** disconnect, reconnect, and approve offline access. SCOPE requests account selection and consent on every reconnect.
- **HTTP 403:** verify both APIs are enabled and the account can view the selected property.
- **HTTP 429:** wait for property/project quota to recover, shorten the reporting period, or use CSV fallback for the current audit.
- **Rows import but do not match pages:** check that the GA4 property belongs to the audited domain and that landing-page paths represent the same hostname/path structure. SCOPE strips query strings for crawl matching but preserves the source row in the imported report.

## Deliberate limits and future path

The first direct integration uses `runReport`, which covers the current landing-page dashboard and historical KPIs. `getMetadata`, pivot, real-time, and funnel reports are extension points for later CRO and self-service report builders; they are not presented as implemented today. BigQuery export is the future upgrade for raw event-level analysis, deep pathing, and very large historical datasets. It is optional and not required to use SCOPE.
