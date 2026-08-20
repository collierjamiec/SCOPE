import type { CheckDefinition, Finding } from '../../types.js';

export const headingStructureCheck: CheckDefinition = {
  id: 'seo.heading-structure',
  name: 'Heading structure',
  category: 'seo',
  run: ({ extracted }) => {
    const findings: Finding[] = [];
    const h1Count = extracted.headings.filter((h) => h.level === 1).length;

    if (h1Count === 0) {
      findings.push({ checkId: 'seo.h1-presence', status: 'fail', detail: 'No H1 found on the page.' });
    } else if (h1Count > 1) {
      findings.push({
        checkId: 'seo.h1-presence',
        status: 'warn',
        detail: `Found ${h1Count} H1 elements; exactly one is recommended.`,
        data: { count: h1Count },
      });
    } else {
      findings.push({ checkId: 'seo.h1-presence', status: 'pass', detail: 'Exactly one H1 found.' });
    }

    let previousLevel = 0;
    const skips: string[] = [];
    for (const heading of extracted.headings) {
      if (previousLevel > 0 && heading.level > previousLevel + 1) {
        skips.push(`H${previousLevel} -> H${heading.level} ("${heading.text.slice(0, 60)}")`);
      }
      previousLevel = heading.level;
    }

    if (skips.length > 0) {
      findings.push({
        checkId: 'seo.heading-nesting',
        status: 'warn',
        detail: `Heading levels skip a level in ${skips.length} place(s): ${skips.join('; ')}`,
        data: { skips },
      });
    } else {
      findings.push({ checkId: 'seo.heading-nesting', status: 'pass', detail: 'Heading levels are properly nested.' });
    }

    return findings;
  },
};
