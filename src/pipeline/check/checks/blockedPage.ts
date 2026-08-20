import type { CheckDefinition } from '../../types.js';
import { isBlockedStatus, looksLikeBlockedTitle } from '../../../utils/blockDetection.js';

export const BLOCKED_PAGE_CHECK_ID = 'technical.blocked-or-challenge-page';

/**
 * Detects when the crawl likely hit a bot-protection/challenge page (Cloudflare
 * and similar WAFs fingerprint automated browsers, sometimes even while letting
 * plain curl/HTTP clients through) instead of the real page. When this fires,
 * every other finding in the same crawl reflects the block page, not the site
 * — the report surfaces this prominently rather than letting hollow data pass
 * as a genuine audit.
 */
export const blockedPageCheck: CheckDefinition = {
  id: BLOCKED_PAGE_CHECK_ID,
  name: 'Bot-protection / challenge page detection',
  category: 'technical',
  run: ({ extracted, config }) => {
    const status = extracted.technical.httpStatus;
    const title = extracted.metadata.title ?? '';

    const statusLooksBlocked = isBlockedStatus(status, config.thresholds);
    const titleLooksBlocked = looksLikeBlockedTitle(title, config.thresholds);
    const pageIsSuspiciouslyThin =
      extracted.content.bodyTextLength < 200 && extracted.headings.length <= 1 && extracted.images.length === 0;

    if (statusLooksBlocked && (titleLooksBlocked || pageIsSuspiciouslyThin)) {
      return {
        checkId: BLOCKED_PAGE_CHECK_ID,
        status: 'fail',
        detail:
          `This crawl likely hit a bot-protection/challenge page instead of the real site ` +
          `(HTTP ${status}${title ? `, page title "${title}"` : ''}) — every other finding in this report reflects ` +
          `that blocked page, not your actual content. This is commonly a WAF (e.g. Cloudflare) fingerprinting ` +
          `the automated browser; it can also mean AI/LLM crawlers relevant to GEO, and other SEO tools, are ` +
          `being blocked the same way.`,
        data: { httpStatus: status, title },
      };
    }

    if (titleLooksBlocked) {
      return {
        checkId: BLOCKED_PAGE_CHECK_ID,
        status: 'warn',
        detail: `Page title ("${title}") resembles a bot-protection challenge page, though the HTTP status was ${status ?? 'unknown'}. Double-check this crawl reflects your real content.`,
        data: { httpStatus: status, title },
      };
    }

    return { checkId: BLOCKED_PAGE_CHECK_ID, status: 'pass', detail: 'No signs of a bot-protection/challenge page.' };
  },
};
