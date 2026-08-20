import { chromium, type Browser, type BrowserContext, type Page, type Response } from 'playwright';
import type { AppConfig } from '../../config/index.js';
import type { ConsoleEntry, RedirectHop, Stage } from '../types.js';
import type { ProgressReporter } from '../../utils/progress.js';
import { applyThrottling } from './throttle.js';
import { looksLikeBlockedResponse } from '../../utils/blockDetection.js';

const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

/** Set by the addInitScript in attemptNavigation, read back after the page settles. */
declare global {
  interface Window {
    __vitals?: { lcp: number | null; cls: number };
  }
}

export interface ResponseRecord {
  url: string;
  status: number;
  resourceType: string;
  contentType: string | null;
}

export interface NavigationTiming {
  ttfbMs: number | null;
  domContentLoadedMs: number | null;
  loadEventMs: number | null;
  fcpMs: number | null;
  lcpMs: number | null;
  cls: number | null;
}

export interface FetchRenderOutput {
  page: Page;
  context: BrowserContext;
  browser: Browser;
  url: string;
  httpStatus: number | null;
  pageRedirectChain: RedirectHop[];
  consoleEntries: ConsoleEntry[];
  responses: ResponseRecord[];
  mobileLoadMs: number;
  navigationTiming: NavigationTiming;
  /** true if the mobile-emulated attempt looked like a bot-protection/challenge page */
  mobileBlocked: boolean;
  /** false when mobileBlocked forced a fallback to a desktop browser context */
  finalModeIsMobile: boolean;
  close(): Promise<void>;
}

interface Attempt {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  response: Response | null;
  loadMs: number;
  consoleEntries: ConsoleEntry[];
  responses: ResponseRecord[];
}

export class FetchRenderStage implements Stage<string, FetchRenderOutput> {
  name = 'fetch' as const;

  private async attemptNavigation(
    url: string,
    config: AppConfig,
    mobile: boolean,
  ): Promise<Attempt> {
    const browser = await chromium.launch();
    const context = await browser.newContext(
      mobile
        ? {
            viewport: { width: 412, height: 823 },
            userAgent: MOBILE_UA,
            deviceScaleFactor: 2.625,
            isMobile: true,
            hasTouch: true,
          }
        : {
            viewport: { width: 1366, height: 768 },
            userAgent: DESKTOP_UA,
            deviceScaleFactor: 1,
            isMobile: false,
            hasTouch: false,
          },
    );
    const page = await context.newPage();

    const consoleEntries: ConsoleEntry[] = [];
    page.on('console', (msg) => {
      consoleEntries.push({ type: msg.type(), text: msg.text(), location: msg.location()?.url ?? null });
    });
    page.on('pageerror', (err) => {
      consoleEntries.push({ type: 'pageerror', text: err.message, location: null });
    });

    const responses: ResponseRecord[] = [];
    const pendingResponses: Promise<void>[] = [];
    page.on('response', (res) => {
      // headerValue() is async, so track each lookup and await them all below before
      // returning — otherwise late-resolving headers (e.g. for images) could still be
      // in flight when the Extract stage reads `responses` for image format detection.
      pendingResponses.push(
        res
          .headerValue('content-type')
          .catch(() => null)
          .then((contentType) => {
            responses.push({ url: res.url(), status: res.status(), resourceType: res.request().resourceType(), contentType });
          }),
      );
    });

    // Registered before navigation so it runs on every new document (including
    // after redirects) before any page script — required to catch paint/layout-
    // shift entries from the very start rather than missing early ones.
    await page.addInitScript(() => {
      window.__vitals = { lcp: null, cls: 0 };
      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          if (last && window.__vitals) window.__vitals.lcp = last.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true } as PerformanceObserverInit);
      } catch {
        // LCP not supported in this browser context — leave lcp as null
      }
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & { hadRecentInput?: boolean; value?: number })[]) {
            if (!entry.hadRecentInput && window.__vitals) {
              window.__vitals.cls += entry.value ?? 0;
            }
          }
        }).observe({ type: 'layout-shift', buffered: true } as PerformanceObserverInit);
      } catch {
        // CLS not supported in this browser context — leave cls as 0
      }
    });

    const cdp = await context.newCDPSession(page);
    await applyThrottling(cdp, config.thresholds.throttle);

    const navStart = Date.now();
    const response = await page.goto(url, {
      waitUntil: 'load',
      timeout: config.thresholds.navigationTimeoutMs,
    });
    const loadMs = Date.now() - navStart;

    await Promise.all(pendingResponses);

    return { browser, context, page, response, loadMs, consoleEntries, responses };
  }

  async run(url: string, config: AppConfig, progress: ProgressReporter): Promise<FetchRenderOutput> {
    progress.startStage('fetch', 'Launching browser (mobile, throttled)…');
    let attempt = await this.attemptNavigation(url, config, true);
    let finalModeIsMobile = true;
    let mobileBlocked = false;

    const title = await attempt.page.title().catch(() => null);
    if (looksLikeBlockedResponse(attempt.response?.status() ?? null, title, config.thresholds)) {
      mobileBlocked = true;
      finalModeIsMobile = false;
      progress.update('fetch', 0.6, 'Mobile crawl appears blocked — retrying with a desktop browser…');
      await attempt.context.close();
      await attempt.browser.close();
      attempt = await this.attemptNavigation(url, config, false);
    }

    progress.update('fetch', 0.85, 'Reading navigation timing…');
    const pageRedirectChain: RedirectHop[] = [];
    let req = attempt.response?.request();
    while (req?.redirectedFrom()) {
      const prev = req.redirectedFrom();
      if (!prev) break;
      const prevResponse = await prev.response();
      pageRedirectChain.unshift({ url: prev.url(), status: prevResponse?.status() ?? 0 });
      req = prev;
    }

    // LCP can still arrive briefly after the load event (e.g. a hero image
    // finishing decode) — a short settle wait catches those candidates instead
    // of reading window.__vitals.lcp prematurely.
    await attempt.page.waitForTimeout(500);

    const navigationTiming = await attempt.page.evaluate<NavigationTiming>(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      const fcpEntry = performance.getEntriesByType('paint').find((e) => e.name === 'first-contentful-paint');
      const vitals = window.__vitals;
      return {
        ttfbMs: nav?.responseStart ?? null,
        domContentLoadedMs: nav?.domContentLoadedEventEnd ?? null,
        loadEventMs: nav?.loadEventEnd ?? null,
        fcpMs: fcpEntry?.startTime ?? null,
        lcpMs: vitals?.lcp ?? null,
        cls: vitals ? vitals.cls : null,
      };
    });

    progress.finishStage('fetch');

    const { browser, context, page } = attempt;
    return {
      page,
      context,
      browser,
      url,
      httpStatus: attempt.response?.status() ?? null,
      pageRedirectChain,
      consoleEntries: attempt.consoleEntries,
      responses: attempt.responses,
      mobileLoadMs: attempt.loadMs,
      navigationTiming,
      mobileBlocked,
      finalModeIsMobile,
      close: async () => {
        await context.close();
        await browser.close();
      },
    };
  }
}
