/**
 * Checklist of schema.org @type values worth having on a page, and what they're
 * called in reports. This is plain data, not logic — adding a new expected type
 * is a one-line edit here and needs no other file changed
 * (see pipeline/check/checks/schemaPresence.ts).
 */
export interface SchemaChecklistEntry {
  type: string;
  label: string;
}

export const schemaChecklist: SchemaChecklistEntry[] = [
  { type: 'FAQPage', label: 'FAQ Page' },
  { type: 'Review', label: 'Review' },
  { type: 'AggregateRating', label: 'Aggregate Rating' },
  { type: 'Offer', label: 'Offer' },
  { type: 'BreadcrumbList', label: 'Breadcrumb' },
  { type: 'VideoObject', label: 'Video' },
  { type: 'Person', label: 'Person' },
  { type: 'Service', label: 'Service' },
];
