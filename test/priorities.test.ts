import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPriorities } from '../src/priorities.js';

test('ranks widespread critical findings ahead of informational findings', () => {
  const pages: any[] = [
    { url: 'https://example.com/a', findings: [{ rule: 'missing_title', category: 'seo', severity: 'critical', message: 'Missing title' }] },
    { url: 'https://example.com/b', findings: [{ rule: 'missing_title', category: 'seo', severity: 'critical', message: 'Missing title' }, { rule: 'minor', category: 'aio', severity: 'info', message: 'Minor note' }] }
  ];
  const result = buildPriorities(pages);
  assert.equal(result[0].issue, 'Missing title');
  assert.equal(result[0].impact, 'high');
  assert.equal(result[0].affectedPages, 2);
  assert.deepEqual(result[0].affectedUrls, ['https://example.com/a', 'https://example.com/b']);
});

test('does not promote a widespread informational archive review to high impact', () => {
  const pages: any[] = Array.from({ length: 20 }, (_, index) => ({ url: `https://example.com/category/${index}`, findings: [{ rule: 'indexable_archive_review', category: 'seo', severity: 'info', message: 'Indexable category archive confirmed.' }] }));
  const [result] = buildPriorities(pages);
  assert.equal(result.impact, 'low');
  assert.match(result.recommendation, /currently indexable/i);
});
