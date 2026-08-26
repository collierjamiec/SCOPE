import assert from 'node:assert/strict';
import test from 'node:test';
import { diagnoseTrafficChange } from '../src/trend-diagnostics.js';

const previous = { gscClicks: 100, gscImpressions: 1000, gscCtr: .1, gscAveragePosition: 5, ga4Sessions: 120, gscPeriodStart: '2026-01-01', gscPeriodEnd: '2026-01-31' };

test('identifies possible demand loss without claiming seasonality as fact', () => {
  const result = diagnoseTrafficChange(previous, { ...previous, gscClicks: 75, gscImpressions: 700, gscAveragePosition: 4.8, ga4Sessions: 90, gscPeriodStart: '2026-02-01', gscPeriodEnd: '2026-02-28' });
  assert.equal(result.classification, 'possible_demand_decline');
  assert.match(result.explanation, /cannot confirm/i);
});

test('distinguishes ranking loss from lower demand', () => {
  const result = diagnoseTrafficChange(previous, { ...previous, gscClicks: 60, gscImpressions: 750, gscAveragePosition: 9, ga4Sessions: 70, gscPeriodStart: '2026-02-01', gscPeriodEnd: '2026-02-28' });
  assert.equal(result.classification, 'likely_ranking_loss');
});

test('requires distinct date-bounded periods', () => {
  assert.equal(diagnoseTrafficChange(previous, { ...previous }).classification, 'insufficient_evidence');
});
