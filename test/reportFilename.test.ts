import { describe, it, expect } from 'vitest';
import { buildReportFilename } from '../src/utils/reportFilename.js';

describe('buildReportFilename', () => {
  const date = new Date(2026, 7, 20, 1, 0, 3); // 2026-08-20 01:00:03 local

  it('builds a readable name for the homepage', () => {
    expect(buildReportFilename('https://gaywitch.com/', date, 22)).toBe(
      'gaywitch.com__home__2026-08-20_010003__crawl-22.html',
    );
  });

  it('slugifies a path with multiple segments', () => {
    expect(buildReportFilename('https://example.com/Blog/My Post!', date, 5)).toBe(
      'example.com__blog-my-post__2026-08-20_010003__crawl-5.html',
    );
  });

  it('strips a leading www from the domain, matching getDomain', () => {
    expect(buildReportFilename('https://www.example.com/', date, 1)).toBe(
      'example.com__home__2026-08-20_010003__crawl-1.html',
    );
  });

  it('produces distinct filenames for the same URL crawled twice, via the crawl id', () => {
    const a = buildReportFilename('https://example.com/', date, 1);
    const b = buildReportFilename('https://example.com/', date, 2);
    expect(a).not.toBe(b);
  });
});
