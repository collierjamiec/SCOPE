import type { CheckDefinition, Finding } from '../../types.js';

/** Shared with the report template so "what counts as broken" has one definition. */
export function isBroken(status: number | null): boolean {
  return status === null || status >= 400;
}

export const brokenLinksCheck: CheckDefinition = {
  id: 'technical.broken-link',
  name: 'Broken links',
  category: 'technical',
  run: ({ extracted }) => {
    const findings: Finding[] = [];

    for (const link of extracted.links) {
      if (isBroken(link.finalStatus)) {
        findings.push({
          checkId: 'technical.broken-link',
          status: 'fail',
          detail: link.checkError
            ? `Link to ${link.resolvedUrl} could not be checked: ${link.checkError}`
            : `Link to ${link.resolvedUrl} returned status ${link.finalStatus}.`,
          data: { url: link.resolvedUrl, status: link.finalStatus, anchorText: link.anchorText },
        });
      } else if (link.redirectChain.length > 1) {
        findings.push({
          checkId: 'technical.long-redirect-chain',
          status: 'warn',
          detail: `Link to ${link.resolvedUrl} passes through ${link.redirectChain.length} redirect hops before reaching ${link.finalUrl}.`,
          data: { url: link.resolvedUrl, hops: link.redirectChain.length },
        });
      }
    }

    if (findings.length === 0) {
      findings.push({
        checkId: 'technical.broken-link',
        status: 'pass',
        detail: `All ${extracted.links.length} link(s) resolved without errors or long redirect chains.`,
      });
    }

    return findings;
  },
};
