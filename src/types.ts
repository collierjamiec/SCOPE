export interface AuditConfig {
  startUrl: string;
  /** null means crawl every discoverable, allowed same-host HTML URL. */
  maxPages: number | null;
  maxKeywords: number;
  /** Licensed SERP checks stay separately bounded even when discovery returns thousands of keywords. */
  maxRankings?: number;
  concurrency: number;
  delayMs: number;
  userAgent: string;
  pageSpeed: boolean;
  pageSpeedApiKey?: string;
  serp?: SerpConfig;
  imageAnalysis?: ImageAnalysisConfig;
  /** URL path prefixes to omit, for example /blog excludes /blog and /blog/*. */
  excludePaths?: string[];
  analyzeImages?: boolean;
  reportBrokenLinks?: boolean;
  analyzeSchema?: boolean;
  /** Raw exports are consumed locally and omitted from the persisted report config. */
  gscCsv?: string;
  gscCsvFiles?: string[];
  gscQueryPageCsv?: string;
  /** Reporting period supplied by a direct Search Console API query. */
  gscDateRangeOverride?: { start: string; end: string; label: string; source: 'Google Search Console API' };
  gscProperty?: string;
  ga4Csv?: string;
  ga4DateRangeOverride?: { start: string; end: string; label: string; source: 'User-entered for GA4 CSV' };
  /** Safety controls for unlimited and highly faceted sites. */
  maxDepth?: number | null;
  maxUrlsPerPath?: number;
  stripTrackingParameters?: boolean;
  renderJavaScript?: boolean;
  /** Restrict the crawl to the seed URL and URLs declared in XML sitemaps. */
  sitemapOnly?: boolean;
  /** Skip common low-value archive surfaces such as tags, authors, feeds, and pagination. */
  excludeArchives?: boolean;
  /** 0 inventories external links without requesting them; 1-3 follows external HTML links to that depth. */
  externalCrawlDepth?: number;
  maxExternalPages?: number;
}

export interface ImageAnalysisConfig {
  endpoint: string;
  apiKey: string;
}

export interface SerpConfig {
  endpoint: string;
  apiKey: string;
  country?: string;
  language?: string;
  device?: "desktop" | "mobile";
}

export interface Heading { text: string; level: 1 | 2 | 3 | 4 | 5 | 6 }
export interface LinkInfo { text: string; url: string; internal: boolean }
export interface ImageRecommendation {
  src: string;
  currentAlt: string;
  currentFilename: string;
  issue: "missing_alt" | "unoptimized_filename" | "both";
  suggestedAlt: string;
  suggestedFilename: string;
  basis: "vision" | "page_context";
  visualDescription?: string;
}

export interface ImageInventoryItem {
  src: string;
  alt: string;
  filename: string;
  cdnManaged: boolean;
}

export interface AioIndicator {
  key: string;
  label: string;
  status: "pass" | "opportunity" | "blocked";
  evidence: string;
  recommendation?: string;
}

export interface AioAssessment {
  score: number;
  label: "strong" | "generally_ready" | "partial" | "significant_barriers";
  dimensions: {
    accessibility: number;
    extractability: number;
    evidence: number;
    entityClarity: number;
    intentCoverage: number;
    freshness: number;
    multimodal: number;
  };
  questionsDetected: string[];
  answerPassages: string[];
  indicators: AioIndicator[];
  /** Supplemental diagnostics do not change the 100-point readiness score. */
  advancedSignals?: {
    directAnswerPairs: number;
    definitionPassages: number;
    comparisonStructures: number;
    attributedQuotes: number;
    unattributedQuotes: number;
    numericClaims: number;
    originalDataClaims: number;
    vagueClaims: number;
    recognizablePrimarySources: number;
    volatileClaims: number;
    dataRichImages: number;
    dataRichImagesWithContext: number;
  };
  visibilityMeasured: false;
}
export interface CtaInfo extends LinkInfo {
  location: "header" | "hero" | "main" | "footer" | "unknown";
  confidence: number;
  evidence: string[];
}

export interface SchemaMarkup {
  raw: string;
  parsed: unknown | null;
  types: string[];
  validJson: boolean;
  error?: string;
  validationIssues?: string[];
}

export interface SuggestedSchema {
  type: string;
  reason: string;
  confidence: "high" | "medium";
}

export interface PageSpeedResult {
  strategy: "mobile" | "desktop";
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
  metrics: Record<string, number | null>;
  fieldMetrics?: Record<string, { percentile: number | null; category: string | null }>;
  error?: string;
  errorCode?: "rate_limited" | "http_error" | "network_error" | "skipped_after_rate_limit";
}

export interface ContentMetrics {
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  averageWordsPerSentence: number;
  fleschReadingEase: number | null;
  fleschKincaidGrade: number | null;
  readingTimeMinutes: number;
  textToHtmlRatio: number;
}

export interface KeywordCandidate {
  keyword: string;
  score: number;
  confidence: number;
  pages: Array<{ url: string; score: number; evidence: string[] }>;
  ranking: RankingResult | null;
  searchConsole?: { clicks: number; impressions: number; ctr: number; position: number; pages: string[]; pageMetrics?: Record<string, { clicks: number; impressions: number; ctr: number; position: number }> };
}

export interface RankingResult {
  position: number | null;
  rankingUrl: string | null;
  checkedAt: string;
  country?: string;
  language?: string;
  device?: string;
  provider: string;
}

export interface Finding {
  category: "seo" | "geo" | "aio";
  severity: "info" | "warning" | "critical";
  rule: string;
  message: string;
  evidence?: string;
}

export interface PageResult {
  requestedUrl: string;
  url: string;
  pageType?: "home" | "article" | "landing" | "category_archive" | "tag_archive" | "author_archive" | "search_archive" | "pagination_archive" | "feed";
  status: number;
  redirectChain: string[];
  contentType: string;
  title: string;
  titleCharacters: number;
  metaDescription: string;
  metaDescriptionCharacters: number;
  canonical: string | null;
  robotsDirectives: string[];
  indexable: boolean;
  h1s: string[];
  h2s: string[];
  headings: Heading[];
  primaryCta: CtaInfo | null;
  schemas: SchemaMarkup[];
  suggestedSchemas: SuggestedSchema[];
  wordCount: number;
  contentMetrics: ContentMetrics;
  text: string;
  links: LinkInfo[];
  internalLinkCount: number;
  externalLinkCount: number;
  incomingInternalLinks: number;
  /** Minimum internal-link distance from the audited homepage; null means unreachable. */
  clickDepth?: number | null;
  /** True only when the crawl was exhaustive enough to make the zero-inlink signal meaningful. */
  orphan?: boolean;
  publishedDate?: string | null;
  modifiedDate?: string | null;
  contentAgeDays?: number | null;
  mixedContentResources?: string[];
  contentFingerprint?: string;
  imageCount: number;
  imagesMissingAltText: number;
  images: ImageInventoryItem[];
  imageRecommendations: ImageRecommendation[];
  aio: AioAssessment;
  /** Named entities declared in structured data; used for sitewide consistency review. */
  entityNames?: Array<{ name: string; type: string }>;
  htmlLang: string | null;
  hasViewportMeta: boolean;
  canonicalMatchesUrl: boolean | null;
  responseTimeMs: number | null;
  keywordSignals: Array<{ phrase: string; score: number; evidence: string }>;
  findings: Finding[];
  pageSpeed: PageSpeedResult[];
  crawledAt: string;
  analytics?: { sessions: number; activeUsers: number; engagedSessions: number; engagementRate: number | null; bounceRate: number | null; keyEvents: number };
}

export interface CannibalizationIssue {
  keyword: string;
  severity: "possible" | "likely";
  intentType?: "question_answer" | "keyword_target";
  pages: Array<{ url: string; score: number; clicks?: number; impressions?: number; position?: number }>;
  reason: string;
}

export interface AuditReport {
  /** Stable local run identifier used to deep-link report findings back to retained history. */
  historyRunId?: string;
  domain: string;
  config: Omit<AuditConfig, "pageSpeedApiKey" | "serp" | "imageAnalysis" | "gscCsv" | "gscCsvFiles" | "gscQueryPageCsv" | "ga4Csv"> & { serpConfigured: boolean; imageAnalysisConfigured: boolean };
  summary: {
    pagesFetched: number;
    indexablePagesAnalyzed: number;
    excludedNonIndexable: number;
    keywordsIdentified: number;
    rankingsChecked: number;
    sitemapPageUrls: number;
    orphanPages?: number;
    averageClickDepth?: number | null;
    schemaCoveragePercent?: number | null;
    crawlableIndexableRate?: number | null;
    nearDuplicateGroups?: number;
    headingHierarchyViolations?: number;
    mixedContentPages?: number;
    canonicalSelfReferencePercent?: number | null;
    canonicalChains?: number;
    canonicalNon200Targets?: number;
    blockedInternallyLinkedPages?: number;
    parameterDuplicateUrls?: number;
  };
  sitemaps: SitemapResult[];
  redirects: RedirectResult[];
  brokenLinks: BrokenLinkResult[];
  externalPages?: ExternalPageResult[];
  pages: PageResult[];
  excludedPages: Array<{ url: string; reason: string; status?: number }>;
  keywords: KeywordCandidate[];
  cannibalization: CannibalizationIssue[];
  aiCrawlerAccess: Array<{ crawler: string; allowed: boolean; note: string }>;
  importedData: { gscRows: number; ga4Rows: number; gscKeywords: number; ga4MatchedPages: number; gscAveragePosition?: number; gscProperty?: string; gscDateRange?: { start?: string; end?: string; label: string; source: 'Filters export' | 'Date dimension export' | 'Google Search Console API' }; ga4DateRange?: { start?: string; end?: string; label: string; source: 'GA4 export metadata' | 'GA4 date dimension' | 'User-entered for GA4 CSV' } };
  priorities: Array<{ rank: number; area: string; issue: string; impact: 'high' | 'medium' | 'low'; effort: 'low' | 'medium' | 'high'; affectedPages: number; affectedUrls: string[]; recommendation: string }>;
  generatedAt: string;
  partial?: boolean;
}

export interface ExternalPageResult {
  url: string;
  finalUrl: string;
  depth: number;
  status: number | null;
  contentType: string;
  responseTimeMs: number | null;
  redirectChain: string[];
  sourcePages: string[];
  robotsAllowed: boolean;
  error?: string;
}

export interface RedirectResult {
  source: string;
  sourcePages: string[];
  chain: string[];
  finalUrl: string;
  finalStatus: number;
  classification?: 'deliberate' | 'automatic' | 'unknown';
  sourceStatus?: number;
  interpretation?: string;
}

export interface BrokenLinkResult {
  sourcePage: string;
  anchorText: string;
  destination: string;
  status: number | null;
  error: string;
}

export interface SitemapResult {
  url: string;
  type: "sitemapindex" | "urlset" | "unknown";
  status: number | null;
  entries: number;
  pageUrls: number;
  childSitemaps: number;
  error?: string;
}
