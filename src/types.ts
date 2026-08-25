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
  ga4Csv?: string;
  /** Safety controls for unlimited and highly faceted sites. */
  maxDepth?: number | null;
  maxUrlsPerPath?: number;
  stripTrackingParameters?: boolean;
  renderJavaScript?: boolean;
  /** Restrict the crawl to the seed URL and URLs declared in XML sitemaps. */
  sitemapOnly?: boolean;
  /** Skip common low-value archive surfaces such as tags, authors, feeds, and pagination. */
  excludeArchives?: boolean;
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

export interface Heading { text: string; level: 1 | 2 }
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
  error?: string;
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
  searchConsole?: { clicks: number; impressions: number; ctr: number; position: number; pages: string[] };
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
  imageCount: number;
  imagesMissingAltText: number;
  imageRecommendations: ImageRecommendation[];
  aio: AioAssessment;
  htmlLang: string | null;
  hasViewportMeta: boolean;
  canonicalMatchesUrl: boolean | null;
  responseTimeMs: number | null;
  keywordSignals: Array<{ phrase: string; score: number; evidence: string }>;
  findings: Finding[];
  pageSpeed: PageSpeedResult[];
  crawledAt: string;
  analytics?: { sessions: number; activeUsers: number; engagedSessions: number; engagementRate: number; keyEvents: number };
}

export interface CannibalizationIssue {
  keyword: string;
  severity: "possible" | "likely";
  pages: Array<{ url: string; score: number }>;
  reason: string;
}

export interface AuditReport {
  domain: string;
  config: Omit<AuditConfig, "pageSpeedApiKey" | "serp" | "imageAnalysis" | "gscCsv" | "ga4Csv"> & { serpConfigured: boolean; imageAnalysisConfigured: boolean };
  summary: {
    pagesFetched: number;
    indexablePagesAnalyzed: number;
    excludedNonIndexable: number;
    keywordsIdentified: number;
    rankingsChecked: number;
    sitemapPageUrls: number;
  };
  sitemaps: SitemapResult[];
  redirects: RedirectResult[];
  brokenLinks: BrokenLinkResult[];
  pages: PageResult[];
  excludedPages: Array<{ url: string; reason: string; status?: number }>;
  keywords: KeywordCandidate[];
  cannibalization: CannibalizationIssue[];
  aiCrawlerAccess: Array<{ crawler: string; allowed: boolean; note: string }>;
  importedData: { gscRows: number; ga4Rows: number; gscKeywords: number; ga4MatchedPages: number };
  priorities: Array<{ rank: number; area: string; issue: string; impact: 'high' | 'medium' | 'low'; effort: 'low' | 'medium' | 'high'; affectedPages: number; recommendation: string }>;
  generatedAt: string;
  partial?: boolean;
}

export interface RedirectResult {
  source: string;
  sourcePages: string[];
  chain: string[];
  finalUrl: string;
  finalStatus: number;
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
