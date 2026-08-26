import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { listDiagnostics, recordDiagnostic, sanitizeDiagnosticValue } from '../src/diagnostics.js';

test('diagnostic sanitization redacts secrets but preserves useful crawl context', () => {
  const sanitized = sanitizeDiagnosticValue({ apiKey: 'secret-value', clientSecret: 'hidden', startUrl: 'https://example.com/page?utm_source=test&token=secret', settings: { concurrency: 5 } }) as any;
  assert.equal(sanitized.apiKey, '[REDACTED]');
  assert.equal(sanitized.clientSecret, '[REDACTED]');
  assert.match(sanitized.startUrl, /utm_source=test/);
  assert.match(sanitized.startUrl, /token=%5BREDACTED%5D/);
  assert.equal(sanitized.settings.concurrency, 5);
});

test('diagnostics persist as readable JSONL without raw credentials', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'scope-diagnostics-'));
  const path = join(directory, 'diagnostics.jsonl');
  const previous = process.env.SCOPE_DIAGNOSTIC_LOG;
  process.env.SCOPE_DIAGNOSTIC_LOG = path;
  try {
    await recordDiagnostic({ component: 'crawl', severity: 'info', event: 'audit_started', message: 'Started', settings: { pageSpeedConcurrency: 10, pageSpeedApiKey: 'must-not-leak' } });
    const entries = await listDiagnostics();
    assert.equal(entries.length, 1);
    assert.equal(entries[0].settings?.pageSpeedConcurrency, 10);
    assert.equal(entries[0].settings?.pageSpeedApiKey, '[REDACTED]');
    assert.doesNotMatch(await readFile(path, 'utf8'), /must-not-leak/);
  } finally {
    if (previous === undefined) delete process.env.SCOPE_DIAGNOSTIC_LOG; else process.env.SCOPE_DIAGNOSTIC_LOG = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
