import { html, type Html } from '../html.js';
import type { FindingStatus } from '../../pipeline/types.js';

const BADGE_META: Record<FindingStatus, { icon: string; label: string; className: string }> = {
  pass: { icon: '✓', label: 'Pass', className: 'badge-pass' },
  info: { icon: 'i', label: 'Info', className: 'badge-info' },
  warn: { icon: '!', label: 'Warn', className: 'badge-warn' },
  fail: { icon: '✕', label: 'Fail', className: 'badge-fail' },
};

/** Status is conveyed by icon + text label, not color alone, for colorblind/contrast accessibility. */
export function statusBadge(status: FindingStatus): Html {
  const meta = BADGE_META[status];
  return html`<span class="badge ${meta.className}"
    ><span class="badge-icon" aria-hidden="true">${meta.icon}</span> ${meta.label}</span
  >`;
}

/** Same visual treatment as statusBadge but with a custom label (e.g. "Too long", "Over budget"). */
export function rangeBadge(status: FindingStatus, label: string): Html {
  const meta = BADGE_META[status];
  return html`<span class="badge ${meta.className}"
    ><span class="badge-icon" aria-hidden="true">${meta.icon}</span> ${label}</span
  >`;
}
