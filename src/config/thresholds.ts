/**
 * Every tunable number/list used by the pipeline lives here. Checks and stages
 * read from this file (via AppConfig) rather than hardcoding values, so tuning
 * a threshold never requires touching check/stage logic.
 */
export interface Thresholds {
  titleLength: { min: number; max: number };
  metaDescriptionLength: { min: number; max: number };
  mobileLoadBudgetMs: number;
  ttfbBudgetMs: number;
  domContentLoadedBudgetMs: number;
  loadEventBudgetMs: number;
  lcpBudgetMs: number;
  fcpBudgetMs: number;
  clsBudget: number;
  throttle: {
    network: { latencyMs: number; downloadBps: number; uploadBps: number };
    cpuRate: number;
  };
  navigationTimeoutMs: number;
  maxRedirectHops: number;
  linkCheckConcurrency: number;
  linkCheckTimeoutMs: number;
  genericAltTextValues: string[];
  genericAnchorTextPhrases: string[];
  minStructuralElements: number;
  nextGenImageFormats: string[];
  hashLikeFilenamePatterns: RegExp[];
  blockedHttpStatuses: number[];
  blockedPageTitlePatterns: RegExp[];
  entityEstablishingSchemaTypes: string[];
}

export const thresholds: Thresholds = {
  titleLength: { min: 15, max: 60 },
  metaDescriptionLength: { min: 50, max: 160 },

  /** Wall-clock mobile load time budget, in ms, under throttled conditions. */
  mobileLoadBudgetMs: 5000,

  /** Rough, commonly-cited "good" budgets for the finer-grained timing breakdown. */
  ttfbBudgetMs: 800,
  domContentLoadedBudgetMs: 2500,
  loadEventBudgetMs: 4000,

  /** Google's official Core Web Vitals "good" thresholds. */
  lcpBudgetMs: 2500,
  fcpBudgetMs: 1800,
  clsBudget: 0.1,

  /** Roughly matches Lighthouse's "Slow 4G" mobile throttling preset. */
  throttle: {
    network: {
      latencyMs: 150,
      downloadBps: (1.6 * 1024 * 1024) / 8, // ~1.6 Mbps
      uploadBps: (750 * 1024) / 8, // ~750 Kbps
    },
    cpuRate: 4,
  },

  navigationTimeoutMs: 45_000,

  /** Max redirect hops to follow before giving up and flagging the chain as broken. */
  maxRedirectHops: 10,

  /** Max concurrent outbound HTTP requests when checking link statuses. */
  linkCheckConcurrency: 8,

  /** Timeout for an individual link status check, in ms. */
  linkCheckTimeoutMs: 10_000,

  /** alt text values that carry no real information about the image */
  genericAltTextValues: [
    'image',
    'photo',
    'picture',
    'thumbnail',
    'icon',
    'graphic',
    'img',
    'placeholder',
    'untitled',
    '',
  ],

  /** anchor text phrases that give a reader/crawler no signal about the destination */
  genericAnchorTextPhrases: [
    'click here',
    'read more',
    'learn more',
    'here',
    'link',
    'this link',
    'more',
    'more info',
    'find out more',
    'see more',
    'continue reading',
  ],

  /** minimum number of structural block elements (list/table items, etc.) to count as "has structure" */
  minStructuralElements: 2,

  /** image formats considered "next-gen" for delivery (Lighthouse-style "serve images in next-gen formats") */
  nextGenImageFormats: ['webp', 'avif'],

  /**
   * Filename (without extension) patterns that look auto-generated/hashed rather than
   * descriptive and keyword-relevant — a heuristic, not a certainty, so the check that uses
   * this warns rather than fails. Matches e.g. UUIDs, hex hashes, and long unbroken
   * alphanumeric runs with no word separators like "asdifojasidng".
   */
  hashLikeFilenamePatterns: [
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    /^[0-9a-f]{16,64}$/i,
    /^[a-z0-9]{12,}$/i,
  ],

  /** HTTP statuses commonly returned by a WAF/bot-management challenge instead of the real page */
  blockedHttpStatuses: [403, 429, 503],

  /** page <title> text commonly used by bot-protection/challenge interstitials (Cloudflare, etc.) */
  blockedPageTitlePatterns: [
    /checking your browser/i,
    /just a moment/i,
    /attention required/i,
    /access denied/i,
    /are you a human/i,
    /verify you are (a )?human/i,
    /security check/i,
    /ddos protection/i,
    /captcha/i,
    /request blocked/i,
  ],

  /** schema.org @type values that establish page entity well enough that a missing personal byline/Person schema is informational, not a failure */
  entityEstablishingSchemaTypes: ['Organization', 'WebSite'],
};
