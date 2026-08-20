import type { CheckDefinition } from '../../types.js';

export const MOBILE_FALLBACK_CHECK_ID = 'technical.mobile-emulation-fallback';

/**
 * Distinct from blockedPageCheck (which judges whether the FINAL data looks
 * like a challenge page): this fires whenever the mobile-emulated attempt was
 * blocked and the crawl fell back to a desktop browser, even if that fallback
 * succeeded and the rest of the report reflects real content. It's a warn, not
 * a fail, because the audit did recover real data — but performance figures
 * (load time, etc.) reflect desktop conditions, not true mobile.
 */
export const mobileEmulationFallbackCheck: CheckDefinition = {
  id: MOBILE_FALLBACK_CHECK_ID,
  name: 'Mobile emulation fallback',
  category: 'technical',
  run: ({ extracted }) => {
    const { mobileBlocked, finalModeIsMobile } = extracted.technical.renderMode;
    if (mobileBlocked && !finalModeIsMobile) {
      return {
        checkId: MOBILE_FALLBACK_CHECK_ID,
        status: 'warn',
        detail:
          `The mobile-emulated crawl was blocked by the site's bot-protection, so this audit fell back to a ` +
          `desktop browser to get real data. Mobile load time and other performance figures below reflect ` +
          `desktop conditions, not true mobile — and this may mean mobile crawlers/bots are blocked too.`,
      };
    }
    return { checkId: MOBILE_FALLBACK_CHECK_ID, status: 'pass', detail: 'Mobile-emulated crawl succeeded normally.' };
  },
};
