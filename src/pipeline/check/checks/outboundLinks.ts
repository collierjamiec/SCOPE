import type { CheckDefinition } from '../../types.js';

export const outboundLinksCheck: CheckDefinition = {
  id: 'geo.outbound-citations',
  name: 'Outbound citations to external sources',
  category: 'geo',
  run: ({ extracted }) => {
    const count = extracted.content.outboundDomains.length;
    if (count === 0) {
      return {
        checkId: 'geo.outbound-citations',
        status: 'warn',
        detail: 'No outbound links to external domains found — no external citations as a trust signal.',
      };
    }
    return {
      checkId: 'geo.outbound-citations',
      status: 'pass',
      detail: `Links to ${count} external domain(s) found: ${extracted.content.outboundDomains.slice(0, 10).join(', ')}${count > 10 ? '…' : ''}.`,
      data: { domains: extracted.content.outboundDomains },
    };
  },
};
