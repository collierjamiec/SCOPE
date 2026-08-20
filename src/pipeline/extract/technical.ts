import type { AppConfig } from '../../config/index.js';
import type { ExtractedTechnical } from '../types.js';
import type { FetchRenderOutput } from '../fetchRender/index.js';
import { checkRobotsTxt } from '../../utils/robotsTxt.js';
import { checkSitemap } from '../../utils/sitemap.js';
import { originOf } from '../../utils/url.js';
import { discardBody } from '../../utils/http.js';

async function checkLlmsTxt(url: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${originOf(url)}/llms.txt`, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
    await discardBody(res);
    return res.ok;
  } catch {
    clearTimeout(timer);
    return false;
  }
}

export async function extractTechnical(
  fetched: FetchRenderOutput,
  config: AppConfig,
): Promise<ExtractedTechnical> {
  const isHttps = fetched.url.startsWith('https://');

  const mixedContentResources = isHttps
    ? Array.from(
        new Set(
          fetched.responses
            .filter((r) => r.url.startsWith('http://'))
            .map((r) => r.url),
        ),
      )
    : [];

  const [robotsTxt, sitemap, llmsTxtPresent] = await Promise.all([
    checkRobotsTxt(fetched.url, config.thresholds.linkCheckTimeoutMs),
    checkSitemap(fetched.url, config.thresholds.linkCheckTimeoutMs),
    checkLlmsTxt(fetched.url, config.thresholds.linkCheckTimeoutMs),
  ]);

  return {
    isHttps,
    mixedContentResources,
    robotsTxt,
    sitemap,
    llmsTxt: { present: llmsTxtPresent },
    consoleErrors: fetched.consoleEntries,
    performance: {
      mobileLoadMs: fetched.mobileLoadMs,
      ttfbMs: fetched.navigationTiming.ttfbMs,
      domContentLoadedMs: fetched.navigationTiming.domContentLoadedMs,
      loadEventMs: fetched.navigationTiming.loadEventMs,
      fcpMs: fetched.navigationTiming.fcpMs,
      lcpMs: fetched.navigationTiming.lcpMs,
      cls: fetched.navigationTiming.cls,
    },
    httpStatus: fetched.httpStatus,
    pageRedirectChain: fetched.pageRedirectChain,
    renderMode: {
      mobileBlocked: fetched.mobileBlocked,
      finalModeIsMobile: fetched.finalModeIsMobile,
    },
  };
}
