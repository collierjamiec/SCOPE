export type TrafficRunMetrics = {
  gscClicks?: number | null;
  gscImpressions?: number | null;
  gscCtr?: number | null;
  gscAveragePosition?: number | null;
  ga4Sessions?: number | null;
  gscPeriodStart?: Date | string | null;
  gscPeriodEnd?: Date | string | null;
};

export type TrafficDiagnosis = {
  classification: 'insufficient_evidence' | 'possible_demand_decline' | 'likely_ranking_loss' | 'likely_ctr_loss' | 'analytics_divergence' | 'mixed_decline' | 'stable_or_improving';
  confidence: 'low' | 'medium' | 'high';
  headline: string;
  explanation: string;
  evidence: string[];
  nextSteps: string[];
};

const percent = (previous?: number | null, current?: number | null) => previous && current != null ? ((current - previous) / previous) * 100 : null;
const shown = (value: number | null, suffix = '%') => value == null ? 'unavailable' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}${suffix}`;
const periodKey = (run: TrafficRunMetrics) => run.gscPeriodStart && run.gscPeriodEnd ? `${new Date(run.gscPeriodStart).toISOString().slice(0, 10)}:${new Date(run.gscPeriodEnd).toISOString().slice(0, 10)}` : null;

export function diagnoseTrafficChange(previous: TrafficRunMetrics | undefined, current: TrafficRunMetrics | undefined): TrafficDiagnosis {
  const baseline = { classification: 'insufficient_evidence', confidence: 'low', headline: 'More comparable history is needed', explanation: 'SCOPE does not have two distinct, date-bounded GSC periods with enough metrics to distinguish demand, ranking, and click-through changes.', evidence: [], nextSteps: ['Run another audit with GSC query data for a distinct comparison period.', 'Use equal-length periods and compare year over year when seasonality is plausible.', 'Add competitor or market-demand evidence before attributing a decline to seasonality, an algorithm update, or the market.'] } as TrafficDiagnosis;
  if (!previous || !current) return baseline;
  if (!periodKey(previous) || !periodKey(current) || periodKey(previous) === periodKey(current)) return baseline;
  if (previous.gscImpressions == null || current.gscImpressions == null || previous.gscClicks == null || current.gscClicks == null) return baseline;

  const impressions = percent(previous.gscImpressions, current.gscImpressions), clicks = percent(previous.gscClicks, current.gscClicks), ctr = percent(previous.gscCtr, current.gscCtr), sessions = percent(previous.ga4Sessions, current.ga4Sessions);
  const position = previous.gscAveragePosition != null && current.gscAveragePosition != null ? current.gscAveragePosition - previous.gscAveragePosition : null;
  const evidence = [`GSC impressions ${shown(impressions)}`, `GSC clicks ${shown(clicks)}`, `Average position ${position == null ? 'unavailable' : `${position >= 0 ? '+' : ''}${position.toFixed(1)} positions (positive means worse)`}`, `CTR ${shown(ctr)}`, `GA4 sessions ${shown(sessions)}`];
  const common = ['Review the page and query movers rather than relying only on domain-wide averages.', 'Check releases, migrations, indexing changes, SERP features, and recent content changes during the same dates.'];

  if (sessions != null && sessions <= -15 && clicks != null && clicks > -5) return { classification: 'analytics_divergence', confidence: 'medium', headline: 'Analytics and organic search signals diverge', explanation: 'GA4 sessions fell while GSC clicks remained broadly stable. This is not strong evidence of an SEO traffic loss and may reflect analytics configuration, consent, attribution, or changes in other channels.', evidence, nextSteps: ['Validate GA4 tags, consent mode, channel grouping, and landing-page matching.', ...common] };
  if (position != null && position >= 2 && ((clicks != null && clicks <= -10) || (impressions != null && impressions <= -10))) return { classification: 'likely_ranking_loss', confidence: 'high', headline: 'The decline is consistent with ranking loss', explanation: 'Average position worsened materially while search visibility or clicks declined. Site, content, competitive, indexing, or SERP changes deserve investigation before lower demand is blamed.', evidence, nextSteps: ['Inspect queries and landing pages with the largest position and click losses.', 'Compare affected pages with current ranking competitors for intent coverage, freshness, links, and technical accessibility.', ...common] };
  if (impressions != null && impressions <= -10 && (position == null || position <= 1)) return { classification: 'possible_demand_decline', confidence: 'medium', headline: 'Lower search demand is plausible', explanation: 'Impressions declined while average position stayed broadly stable or improved. This pattern can indicate lower demand or seasonality, but SCOPE cannot confirm a market-wide cause without year-over-year and competitor evidence.', evidence, nextSteps: ['Compare the same period year over year and review query-level impression losses.', 'Compare at least three relevant competitors or an external demand source before labeling the decline market-wide.', ...common] };
  if (clicks != null && clicks <= -10 && ctr != null && ctr <= -10 && (impressions == null || impressions > -10) && (position == null || Math.abs(position) <= 1)) return { classification: 'likely_ctr_loss', confidence: 'high', headline: 'The decline is consistent with lower organic CTR', explanation: 'Visibility and rankings were comparatively stable, but CTR and clicks fell. Search snippets, intent alignment, SERP features, or brand appeal may be reducing clicks.', evidence, nextSteps: ['Inspect queries with stable impressions but falling CTR.', 'Review titles, descriptions, rich-result eligibility, intent match, and new SERP features.', ...common] };
  if ((clicks != null && clicks <= -10) || (impressions != null && impressions <= -10) || (sessions != null && sessions <= -15)) return { classification: 'mixed_decline', confidence: 'low', headline: 'Traffic declined, but the cause is mixed', explanation: 'The available signals do not isolate demand, ranking, CTR, analytics, or site quality as the primary cause. Treat any single-cause explanation as a hypothesis.', evidence, nextSteps: ['Segment the change by query, landing page, device, country, and page type.', 'Add competitor trend data and year-over-year comparisons.', ...common] };
  return { classification: 'stable_or_improving', confidence: 'medium', headline: 'Organic visibility is stable or improving', explanation: 'The compared GSC and GA4 signals do not show a material decline under SCOPE’s diagnostic thresholds.', evidence, nextSteps: ['Continue monitoring the same metrics with comparable date windows.', ...common] };
}
