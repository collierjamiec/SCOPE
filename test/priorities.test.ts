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
});
