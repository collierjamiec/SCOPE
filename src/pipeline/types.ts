import type { AppConfig } from '../config/index.js';
import type { ProgressReporter, StageKey } from '../utils/progress.js';

/**
 * A pipeline stage: plain input -> output transform. Stages compose by function
 * call in the orchestrator (cli/commands/audit.ts), not inheritance, so a future
 * stage (e.g. a v2 LLM review stage) can be inserted between existing stages
 * without changing either of them.
 */
export interface Stage<TIn, TOut> {
  name: StageKey;
  run(input: TIn, config: AppConfig, progress: ProgressReporter): Promise<TOut>;
}

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface ExtractedHeading {
  level: HeadingLevel;
  text: string;
}

export type ImageFormat = 'webp' | 'avif' | 'jpeg' | 'png' | 'gif' | 'svg' | 'bmp' | 'tiff' | 'ico';

export interface ExtractedImage {
  src: string;
  resolvedSrc: string | null;
  alt: string | null;
  /** Detected from the response Content-Type header, falling back to the URL's file extension. */
  format: ImageFormat | null;
  /** null when format could not be determined (e.g. a data: URI with no matching response). */
  isNextGenFormat: boolean | null;
  /** From the width/height HTML attributes (not CSS/rendered size) — what actually reserves layout space and prevents CLS. */
  width: number | null;
  height: number | null;
}

export interface RedirectHop {
  url: string;
  status: number;
}

export interface ExtractedLink {
  href: string;
  resolvedUrl: string;
  isInternal: boolean;
  anchorText: string;
  /** true if the link wraps an <img> — explains an empty anchorText that isn't actually a problem */
  hasImageContent: boolean;
  /** alt text of the wrapped image, when hasImageContent is true — the effective accessible name for an image-only link */
  imageAlt: string | null;
  finalStatus: number | null;
  finalUrl: string;
  redirectChain: RedirectHop[];
  checkError: string | null;
}

export interface ExtractedMetadata {
  title: string | null;
  metaDescription: string | null;
  og: {
    title: string | null;
    description: string | null;
    image: string | null;
  };
  twitter: {
    card: string | null;
    title: string | null;
    description: string | null;
    image: string | null;
  };
  canonical: {
    href: string | null;
    isSelfReferential: boolean | null;
  };
  robotsMeta: {
    index: boolean;
    follow: boolean;
    raw: string | null;
  };
  viewportPresent: boolean;
  publishDate: string | null;
}

export interface ExtractedSchema {
  detectedTypes: string[];
  raw: unknown[];
  parseErrors: string[];
}

export interface ConsoleEntry {
  type: string;
  text: string;
  location: string | null;
}

export interface ExtractedTechnical {
  isHttps: boolean;
  mixedContentResources: string[];
  robotsTxt: {
    fetched: boolean;
    blocksUrl: boolean;
  };
  sitemap: {
    fetched: boolean;
    present: boolean;
    urlListed: boolean | null;
  };
  llmsTxt: {
    present: boolean;
  };
  consoleErrors: ConsoleEntry[];
  performance: {
    /** Load time from whichever attempt succeeded — see renderMode.finalModeIsMobile
     *  below; when false, this is a desktop fallback timing, not true mobile. */
    mobileLoadMs: number;
    ttfbMs: number | null;
    domContentLoadedMs: number | null;
    loadEventMs: number | null;
    /** First Contentful Paint, ms */
    fcpMs: number | null;
    /** Largest Contentful Paint, ms — observed up to a short settle window after load, not a true field-data value */
    lcpMs: number | null;
    /** Cumulative Layout Shift score */
    cls: number | null;
  };
  httpStatus: number | null;
  pageRedirectChain: RedirectHop[];
  renderMode: {
    /** true if the mobile-emulated attempt looked like a bot-protection/challenge page */
    mobileBlocked: boolean;
    /** false when mobileBlocked forced a fallback to a desktop browser context */
    finalModeIsMobile: boolean;
  };
}

export interface ExtractedContent {
  authorByline: string | null;
  hasPersonSchema: boolean;
  outboundDomains: string[];
  structuralElementCount: number;
  bodyTextLength: number;
}

export interface ExtractedData {
  url: string;
  fetchedAt: string;
  metadata: ExtractedMetadata;
  headings: ExtractedHeading[];
  images: ExtractedImage[];
  schema: ExtractedSchema;
  links: ExtractedLink[];
  technical: ExtractedTechnical;
  content: ExtractedContent;
}

/**
 * 'info' is distinct from 'warn': it's for signals that are situational rather
 * than a real recommendation to act (e.g. an optional schema type that simply
 * doesn't apply to every page). It never affects a crawl's overall_status.
 */
export type FindingStatus = 'pass' | 'info' | 'warn' | 'fail';

export interface Finding {
  checkId: string;
  status: FindingStatus;
  detail: string;
  data?: Record<string, unknown>;
}

export type CheckCategory = 'seo' | 'geo' | 'technical' | 'performance' | 'accessibility';

export interface CheckContext {
  extracted: ExtractedData;
  config: AppConfig;
}

/**
 * The extension point: a new check is a new file exporting a CheckDefinition,
 * registered in pipeline/check/registry.ts. No other file needs to change.
 */
export interface CheckDefinition {
  id: string;
  name: string;
  category: CheckCategory;
  run(ctx: CheckContext): Finding | Finding[] | null;
}

export interface CrawlResult {
  extracted: ExtractedData;
  findings: Finding[];
}
