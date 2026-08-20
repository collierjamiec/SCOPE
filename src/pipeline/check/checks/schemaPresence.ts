import type { CheckDefinition, Finding } from '../../types.js';

/** Entirely driven by config/schemaChecklist.ts — adding an expected type there needs no code change here. */
export const schemaPresenceCheck: CheckDefinition = {
  id: 'geo.schema-presence',
  name: 'Structured data checklist',
  category: 'geo',
  run: ({ extracted, config }) => {
    const findings: Finding[] = config.schemaChecklist.map((entry) => {
      const present = extracted.schema.detectedTypes.includes(entry.type);
      return {
        checkId: `geo.schema-${entry.type.toLowerCase()}`,
        // 'info', not 'warn': not every page needs every schema type on the
        // checklist (a blog post has no reason to carry Offer schema), so
        // absence is situational, not a recommendation to act.
        status: present ? 'pass' : 'info',
        detail: present ? `${entry.label} schema detected.` : `${entry.label} schema not found — may not be applicable to this page.`,
        data: { type: entry.type },
      };
    });

    if (extracted.schema.parseErrors.length > 0) {
      findings.push({
        checkId: 'geo.schema-invalid-json-ld',
        status: 'fail',
        detail: `${extracted.schema.parseErrors.length} JSON-LD block(s) failed to parse: ${extracted.schema.parseErrors.join('; ')}`,
      });
    }

    return findings;
  },
};
