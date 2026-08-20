import { describe, it, expect } from 'vitest';
import { isBlockedStatus, looksLikeBlockedTitle, looksLikeBlockedResponse } from '../src/utils/blockDetection.js';
import { testConfig } from './fixtures.js';

describe('blockDetection', () => {
  it('isBlockedStatus matches configured blocked statuses only', () => {
    expect(isBlockedStatus(403, testConfig.thresholds)).toBe(true);
    expect(isBlockedStatus(200, testConfig.thresholds)).toBe(false);
    expect(isBlockedStatus(null, testConfig.thresholds)).toBe(false);
  });

  it('looksLikeBlockedTitle matches known challenge-page phrasing', () => {
    expect(looksLikeBlockedTitle('Checking your browser...', testConfig.thresholds)).toBe(true);
    expect(looksLikeBlockedTitle('Just a moment...', testConfig.thresholds)).toBe(true);
    expect(looksLikeBlockedTitle('Queer and Unbroken | Home', testConfig.thresholds)).toBe(false);
    expect(looksLikeBlockedTitle(null, testConfig.thresholds)).toBe(false);
  });

  it('looksLikeBlockedResponse requires both status and title to match', () => {
    expect(looksLikeBlockedResponse(403, 'Checking your browser...', testConfig.thresholds)).toBe(true);
    expect(looksLikeBlockedResponse(200, 'Checking your browser...', testConfig.thresholds)).toBe(false);
    expect(looksLikeBlockedResponse(403, 'A Normal Page Title', testConfig.thresholds)).toBe(false);
  });
});
