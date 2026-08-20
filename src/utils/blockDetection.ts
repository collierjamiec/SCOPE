import type { Thresholds } from '../config/thresholds.js';

export function isBlockedStatus(
  httpStatus: number | null,
  thresholds: Pick<Thresholds, 'blockedHttpStatuses'>,
): boolean {
  return httpStatus !== null && thresholds.blockedHttpStatuses.includes(httpStatus);
}

export function looksLikeBlockedTitle(
  title: string | null,
  thresholds: Pick<Thresholds, 'blockedPageTitlePatterns'>,
): boolean {
  return title ? thresholds.blockedPageTitlePatterns.some((pattern) => pattern.test(title)) : false;
}

/**
 * High-confidence check: both the status AND the title must look like a
 * challenge page. Used by FetchRenderStage to decide whether a retry is worth
 * the extra navigation round-trip, so it's deliberately conservative — a page
 * that merely returns one of the blocked-range statuses without a telltale
 * title isn't enough on its own to trigger a retry. The Check stage's
 * blockedPageCheck applies a looser, OR-based combination of these same two
 * predicates after the fact, since by then extraction is already done and
 * there's no cost to being more sensitive.
 */
export function looksLikeBlockedResponse(
  httpStatus: number | null,
  title: string | null,
  thresholds: Pick<Thresholds, 'blockedHttpStatuses' | 'blockedPageTitlePatterns'>,
): boolean {
  return isBlockedStatus(httpStatus, thresholds) && looksLikeBlockedTitle(title, thresholds);
}
