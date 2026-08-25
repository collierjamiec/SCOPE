import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGoogleAuthorization, googleCredentialPath, saveGoogleCredentials } from '../src/google-search-console.js';

test('creates a read-only Google OAuth authorization request with PKCE and account selection', () => {
  const result = createGoogleAuthorization('client.apps.googleusercontent.com', 'http://127.0.0.1:4173/api/google/callback', 'state-123');
  const url = new URL(result.url);
  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.searchParams.get('scope'), 'https://www.googleapis.com/auth/webmasters.readonly');
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.match(url.searchParams.get('prompt') ?? '', /select_account/);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(result.verifier.length > 40);
});

test('stores Google credentials in the configured local directory with owner-only permissions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'scope-google-'));
  const previous = process.env.SCOPE_DATA_DIR; process.env.SCOPE_DATA_DIR = directory;
  try {
    await saveGoogleCredentials({ clientId: 'client.apps.googleusercontent.com', clientSecret: 'local-secret', refreshToken: 'local-token' });
    assert.equal((await stat(googleCredentialPath())).mode & 0o777, 0o600);
    assert.match(await readFile(googleCredentialPath(), 'utf8'), /local-token/);
  } finally {
    if (previous === undefined) delete process.env.SCOPE_DATA_DIR; else process.env.SCOPE_DATA_DIR = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
