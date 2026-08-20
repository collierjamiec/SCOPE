import { describe, it, expect, vi, afterEach } from 'vitest';
import { walkRedirects } from '../src/utils/redirectWalker.js';

function mockResponse(status: number, location?: string): Response {
  return {
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'location' ? (location ?? null) : null) },
  } as unknown as Response;
}

describe('walkRedirects', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns immediately for a non-redirect response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200)));
    const result = await walkRedirects('https://example.com/a', { maxHops: 10, timeoutMs: 1000 });
    expect(result.finalStatus).toBe(200);
    expect(result.chain).toEqual([]);
  });

  it('follows a chain of redirects and records every hop', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(301, 'https://example.com/b'))
      .mockResolvedValueOnce(mockResponse(302, 'https://example.com/c'))
      .mockResolvedValueOnce(mockResponse(200));
    vi.stubGlobal('fetch', fetchMock);

    const result = await walkRedirects('https://example.com/a', { maxHops: 10, timeoutMs: 1000 });
    expect(result.finalStatus).toBe(200);
    expect(result.finalUrl).toBe('https://example.com/c');
    expect(result.chain).toEqual([
      { url: 'https://example.com/a', status: 301 },
      { url: 'https://example.com/b', status: 302 },
    ]);
  });

  it('gives up after exceeding maxHops', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(301, 'https://example.com/loop')));
    const result = await walkRedirects('https://example.com/loop', { maxHops: 2, timeoutMs: 1000 });
    expect(result.finalStatus).toBeNull();
    expect(result.error).toMatch(/Exceeded/);
  });

  it('flags a redirect with no Location header', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(301)));
    const result = await walkRedirects('https://example.com/a', { maxHops: 10, timeoutMs: 1000 });
    expect(result.error).toMatch(/no Location header/);
  });
});
