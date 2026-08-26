import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { listSerankingProjects, loadSerankingCredentials, saveSerankingCredentials, syncSerankingAiVisibility, testSerankingConnection } from '../src/seranking.js';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

test('stores the SE Ranking key only in the configured owner-readable local file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'scope-seranking-')), previous = process.env.SCOPE_SERANKING_CREDENTIALS_FILE;
  process.env.SCOPE_SERANKING_CREDENTIALS_FILE = join(directory, 'credentials.json');
  try {
    await saveSerankingCredentials({ apiKey: 'private-test-api-key' });
    assert.deepEqual(await loadSerankingCredentials(), { apiKey: 'private-test-api-key' });
    assert.equal((await stat(process.env.SCOPE_SERANKING_CREDENTIALS_FILE)).mode & 0o777, 0o600);
    assert.match(await readFile(process.env.SCOPE_SERANKING_CREDENTIALS_FILE, 'utf8'), /private-test-api-key/);
  } finally { if (previous === undefined) delete process.env.SCOPE_SERANKING_CREDENTIALS_FILE; else process.env.SCOPE_SERANKING_CREDENTIALS_FILE = previous; }
});

test('authenticates, lists projects, and normalizes AI Results Tracker evidence', async () => {
  const calls: Array<{ url: string; authorization: string | null }> = [];
  const mockedFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input); calls.push({ url, authorization: new Headers(init?.headers).get('authorization') });
    if (url.endsWith('/v1/account/subscription')) return json({ plan: 'test' });
    if (url.endsWith('/v1/project-management/sites')) return json([{ id: 12, title: 'Example', domain: 'example.com' }]);
    if (url.includes('/airt/llm?')) return json([{ id: 2, name: 'ChatGPT' }]);
    if (url.includes('/airt/llm/statistics?')) return json({ visibility: 28 });
    if (url.includes('/airt/prompts/answer?')) return json({ text: 'Example and Competitor are options.', sources: [{ url: 'https://example.com/guide', position: 1 }], brands: [{ name: 'Example', position: 1 }, { name: 'Competitor', position: 2 }] });
    if (url.includes('/airt/prompts/rankings?')) return json([{ prompt_llm_id: 9, date: '2026-08-26', position: 1, visibility: 28, mentioned: true }]);
    if (url.includes('/airt/prompts?')) return json([{ id: 9, prompt: 'best example service' }]);
    return json({ error: 'not found' }, 404);
  }) as typeof fetch;
  const credentials = { apiKey: 'secret-api-key' };
  assert.equal((await testSerankingConnection(credentials, mockedFetch)).connected, true);
  assert.deepEqual(await listSerankingProjects(credentials, mockedFetch), [{ id: '12', title: 'Example', domain: 'example.com' }]);
  const result = await syncSerankingAiVisibility(credentials, { siteId: '12', targetDomain: 'example.com', dateFrom: '2026-08-01', dateTo: '2026-08-26', includeAnswerEvidence: true, maximumAnswers: 1 }, mockedFetch);
  assert.equal(result.metrics.promptCount, 1);
  assert.equal(result.metrics.citationCount, 1);
  assert.equal(result.metrics.answersFetched, 1);
  assert.equal((result.rows[0].brands as any[])[1].name, 'Competitor');
  assert.ok(calls.every(call => call.authorization === 'Token secret-api-key'));
});
