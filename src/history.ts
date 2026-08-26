import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir, rename, rm, rmdir, stat } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient, type ComparisonStatus, type DeltaState } from './generated/prisma/client.js';
import { diagnoseTrafficChange } from './trend-diagnostics.js';
import type { AuditReport, Finding, PageResult } from './types.js';

const RULESET_VERSION = '2026-08-25';
let client: PrismaClient | undefined;
export const historyEnabled = () => Boolean(process.env.DATABASE_URL);
const db = () => {
  if (!historyEnabled()) throw new Error('Historical trends require DATABASE_URL. See .env.example and docker-compose.yml.');
  if (client) return client;
  const connection = new URL(process.env.DATABASE_URL!);
  client = new PrismaClient({ adapter: new PrismaMariaDb({ host: connection.hostname, port: Number(connection.port || 3306), user: decodeURIComponent(connection.username), password: decodeURIComponent(connection.password), database: connection.pathname.replace(/^\//, ''), connectionLimit: 8 }) });
  return client;
};
export async function historyStatus() {
  if (!historyEnabled()) return { configured: false, connected: false, initialized: false, state: 'not_configured', message: 'No MariaDB connection is configured.' };
  if (process.env.SCOPE_HISTORY_BOOTSTRAP_ERROR) return { configured: true, connected: false, initialized: false, state: 'unavailable', message: process.env.SCOPE_HISTORY_BOOTSTRAP_ERROR };
  try {
    const runCount = await db().auditRun.count();
    return { configured: true, connected: true, initialized: true, state: runCount ? 'history_available' : 'awaiting_baseline', runCount, message: runCount ? 'Historical audit data is available.' : 'MariaDB is connected and ready. Complete an audit to create the first historical baseline.' };
  } catch (error) {
    return { configured: true, connected: false, initialized: false, state: 'migration_required', message: `MariaDB is reachable, but SCOPE could not read its history schema: ${error instanceof Error ? error.message : String(error)}` };
  }
}
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const json = (value: unknown) => JSON.parse(JSON.stringify(value));

export function normalizeDomain(value: string): string {
  const url = new URL(value.includes('://') ? value : `https://${value}`);
  let host = url.hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
  if (url.port && !((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80'))) host += `:${url.port}`;
  return host;
}

export async function listDomainCompetitors(sourceDomainId: string) {
  const definitions = await db().domainCompetitor.findMany({ where: { sourceDomainId }, orderBy: { normalizedDomain: 'asc' } });
  const audited = await db().domain.findMany({
    where: { normalizedDomain: { in: definitions.map(item => item.normalizedDomain) } },
    select: { id: true, normalizedDomain: true, _count: { select: { runs: true } }, runs: { orderBy: { generatedAt: 'desc' }, take: 1, select: { generatedAt: true, pageCount: true } } }
  });
  const byDomain = new Map(audited.map(item => [item.normalizedDomain, item]));
  return definitions.map(item => ({ ...item, auditedDomain: byDomain.get(item.normalizedDomain) ?? null, evidenceClass: 'configured_competitor' }));
}

export async function addDomainCompetitor(sourceDomainId: string, value: string) {
  const normalizedDomain = normalizeDomain(value);
  const source = await db().domain.findUnique({ where: { id: sourceDomainId } });
  if (!source) throw new Error('Source domain history was not found.');
  if (source.normalizedDomain === normalizedDomain) throw new Error('A domain cannot be its own competitor.');
  return db().domainCompetitor.upsert({
    where: { sourceDomainId_normalizedDomain: { sourceDomainId, normalizedDomain } },
    create: { sourceDomainId, normalizedDomain, displayDomain: normalizedDomain },
    update: { displayDomain: normalizedDomain }
  });
}

export async function removeDomainCompetitor(sourceDomainId: string, competitorId: string) {
  const result = await db().domainCompetitor.deleteMany({ where: { id: competitorId, sourceDomainId } });
  if (!result.count) throw new Error('Competitor definition was not found.');
}

export function normalizePageUrl(value: string): string {
  const url = new URL(value); url.hash = '';
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  for (const key of [...url.searchParams.keys()]) if (/^(utm_.+|gclid|fbclid|msclkid)$/i.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
  const port = url.port && !((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) ? `:${url.port}` : '';
  return `${url.hostname}${port}${url.pathname}${url.search}`;
}

const findingDiscriminator = (finding: Finding) => finding.rule === 'broken_link' || finding.rule.includes('schema') || finding.rule.includes('mixed_content') ? finding.evidence ?? '' : '';
export const findingFingerprint = (domain: string, pageUrl: string, finding: Finding) => hash([domain, normalizePageUrl(pageUrl), finding.rule, findingDiscriminator(finding)].join('\n'));

const persistedConfig = (report: AuditReport) => {
  const { concurrency: _concurrency, delayMs: _delay, userAgent: _userAgent, ...meaningful } = report.config;
  return { ...meaningful, startUrl: normalizePageUrl(meaningful.startUrl) };
};
const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  return JSON.stringify(value);
};
const configFingerprint = (report: AuditReport) => hash(canonicalJson(persistedConfig(report)));
const scanType = (report: AuditReport) => report.config.maxPages === null && report.config.pageSpeed && report.config.analyzeImages && report.config.reportBrokenLinks && report.config.analyzeSchema ? 'FULL' : report.config.maxPages && report.config.maxPages <= 50 ? 'QUICK' : 'CUSTOM';
const findings = (report: AuditReport) => report.pages.flatMap(page => page.findings.map(finding => ({ page, finding })));
const countSeverity = (report: AuditReport, severity: Finding['severity']) => findings(report).filter(item => item.finding.severity === severity).length;
const averageMetric = (report: AuditReport, key: string, field = false) => {
  const values = report.pages.flatMap(page => page.pageSpeed.map(result => field ? result.fieldMetrics?.[key]?.percentile : result.metrics[key])).filter((value): value is number => typeof value === 'number');
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
};
const date = (value?: string) => value ? new Date(`${value}T00:00:00.000Z`) : null;
const schemaAppropriate = (page: PageResult) => page.schemas.some(schema => schema.validJson && schema.types.some(type => !['Organization', 'WebSite', 'BreadcrumbList', 'SiteNavigationElement', 'ImageObject'].includes(type)));
const trafficTotals = (report: AuditReport) => {
  const observed = report.keywords.filter(keyword => keyword.searchConsole), gscClicks = observed.reduce((sum, keyword) => sum + keyword.searchConsole!.clicks, 0), gscImpressions = observed.reduce((sum, keyword) => sum + keyword.searchConsole!.impressions, 0);
  const analytics = report.pages.flatMap(page => page.analytics ? [page.analytics] : []), ga4Sessions = analytics.reduce((sum, item) => sum + item.sessions, 0), ga4Users = analytics.reduce((sum, item) => sum + item.activeUsers, 0), engaged = analytics.reduce((sum, item) => sum + item.engagedSessions, 0), bounceRows = analytics.filter(item => item.bounceRate != null), bounceSessions = bounceRows.reduce((sum, item) => sum + item.sessions, 0);
  return { gscClicks: observed.length ? gscClicks : null, gscImpressions: observed.length ? gscImpressions : null, gscCtr: gscImpressions ? gscClicks / gscImpressions : null, gscKeywordCount: observed.length || null, ga4Sessions: analytics.length ? ga4Sessions : null, ga4Users: analytics.length ? ga4Users : null, ga4EngagementRate: ga4Sessions ? engaged / ga4Sessions : null, ga4BounceRate: bounceSessions ? bounceRows.reduce((sum, item) => sum + item.bounceRate! * item.sessions, 0) / bounceSessions : null };
};
const pageTraffic = (report: AuditReport) => {
  const values = new Map<string, { clicks: number; impressions: number; weightedPosition: number }>();
  for (const keyword of report.keywords) for (const [url, metric] of Object.entries(keyword.searchConsole?.pageMetrics ?? {})) {
    const key = normalizePageUrl(url), current = values.get(key) ?? { clicks: 0, impressions: 0, weightedPosition: 0 };
    current.clicks += metric.clicks; current.impressions += metric.impressions; current.weightedPosition += metric.position * metric.impressions; values.set(key, current);
  }
  return values;
};

function comparison(previous: { configFingerprint: string; rulesetVersion: string } | null, currentFingerprint: string): { status: ComparisonStatus; notes: string | null } {
  if (!previous) return { status: 'BASELINE', notes: 'First retained run for this domain.' };
  const differences = [];
  if (previous.configFingerprint !== currentFingerprint) differences.push('crawl or module configuration differs');
  if (previous.rulesetVersion !== RULESET_VERSION) differences.push('finding ruleset version differs');
  if (!differences.length) return { status: 'COMPARABLE', notes: null };
  return { status: differences.length === 1 && previous.rulesetVersion === RULESET_VERSION ? 'PARTIAL' : 'NOT_COMPARABLE', notes: differences.join('; ') };
}

export async function persistAuditRun(runId: string, report: AuditReport, outputDirectory: string): Promise<void> {
  if (!historyEnabled()) return;
  const prisma = db(), normalized = normalizeDomain(report.config.startUrl), fingerprint = configFingerprint(report);
  const domain = await prisma.domain.upsert({ where: { normalizedDomain: normalized }, update: { displayDomain: report.domain }, create: { normalizedDomain: normalized, displayDomain: report.domain } });
  const previous = await prisma.auditRun.findFirst({ where: { domainId: domain.id }, orderBy: { generatedAt: 'desc' }, include: { findings: true } });
  const comparable = comparison(previous, fingerprint);
  const currentFindings = findings(report).map(({ page, finding }) => ({ fingerprint: findingFingerprint(normalized, page.url, finding), ruleId: finding.rule, normalizedPageUrl: normalizePageUrl(page.url), category: finding.category, severity: finding.severity, message: finding.message, evidenceJson: finding.evidence ? { evidence: finding.evidence } : undefined }));
  const currentSet = new Set(currentFindings.map(item => item.fingerprint)), previousSet = new Set(previous?.findings.map(item => item.fingerprint) ?? []);
  const earlier = previous ? await prisma.runFinding.findMany({ where: { run: { domainId: domain.id, generatedAt: { lt: previous.generatedAt } } }, select: { fingerprint: true }, distinct: ['fingerprint'] }) : [];
  const earlierSet = new Set(earlier.map(item => item.fingerprint));
  const deltas: Array<{ fingerprint: string; state: DeltaState }> = [];
  if (previous && comparable.status !== 'NOT_COMPARABLE') {
    for (const item of currentSet) deltas.push({ fingerprint: item, state: previousSet.has(item) ? 'PERSISTING' : earlierSet.has(item) ? 'REOPENED' : 'OPENED' });
    for (const item of previousSet) if (!currentSet.has(item)) deltas.push({ fingerprint: item, state: 'RESOLVED' });
  }
  const traffic = trafficTotals(report), perPageTraffic = pageTraffic(report);
  await prisma.$transaction(async tx => {
    await tx.auditRun.create({ data: {
      id: runId, domainId: domain.id, rawStartUrl: report.config.startUrl, normalizedDomain: normalized, generatedAt: new Date(report.generatedAt), status: report.partial ? 'PARTIAL' : 'COMPLETE', scanType: scanType(report), configFingerprint: fingerprint, rulesetVersion: RULESET_VERSION, configJson: json(persistedConfig(report)), outputDirectory, reportJsonPath: resolve(outputDirectory, 'report.json'), pageCount: report.summary.indexablePagesAnalyzed, fetchedCount: report.summary.pagesFetched, sitemapUrlCount: report.summary.sitemapPageUrls, criticalCount: countSeverity(report, 'critical'), warningCount: countSeverity(report, 'warning'), infoCount: countSeverity(report, 'info'), orphanPageCount: report.summary.orphanPages ?? 0, averageClickDepth: report.summary.averageClickDepth ?? null, staleContentCount: report.pages.filter(page => (page.contentAgeDays ?? 0) > 730).length, nearDuplicateGroups: report.summary.nearDuplicateGroups ?? 0, headingViolations: report.summary.headingHierarchyViolations ?? 0, mixedContentPages: report.summary.mixedContentPages ?? 0, canonicalSelfRate: report.summary.canonicalSelfReferencePercent ?? null, canonicalChains: report.summary.canonicalChains ?? 0, canonicalNon200: report.summary.canonicalNon200Targets ?? 0, crawlWasteUrls: (report.summary.blockedInternallyLinkedPages ?? 0) + (report.summary.parameterDuplicateUrls ?? 0), schemaCoverage: report.summary.schemaCoveragePercent ?? null, indexableRate: report.summary.crawlableIndexableRate ?? null, gscAveragePosition: report.importedData.gscAveragePosition ?? null, ...traffic, gscPeriodStart: date(report.importedData.gscDateRange?.start), gscPeriodEnd: date(report.importedData.gscDateRange?.end), ga4PeriodStart: date(report.importedData.ga4DateRange?.start), ga4PeriodEnd: date(report.importedData.ga4DateRange?.end), averageLcp: averageMetric(report, 'lcp'), averageCls: averageMetric(report, 'cls'), averageInp: averageMetric(report, 'inp', true), averageTbt: averageMetric(report, 'tbt'), previousRunId: previous?.id, comparisonStatus: comparable.status, comparisonNotes: comparable.notes,
      findings: { create: currentFindings.map(item => ({ ...item, evidenceJson: item.evidenceJson ? json(item.evidenceJson) : undefined })) },
      pageMetrics: { create: report.pages.map(page => { const gsc = perPageTraffic.get(normalizePageUrl(page.url)); return { normalizedPageUrl: normalizePageUrl(page.url), pageType: page.pageType, status: page.status, indexable: page.indexable, incomingInternalLinks: page.incomingInternalLinks, clickDepth: page.clickDepth ?? null, orphan: Boolean(page.orphan), schemaEligible: true, schemaAppropriate: schemaAppropriate(page), contentAgeDays: page.contentAgeDays ?? null, gscClicks: gsc?.clicks ?? null, gscImpressions: gsc?.impressions ?? null, gscCtr: gsc?.impressions ? gsc.clicks / gsc.impressions : null, gscPosition: gsc?.impressions ? gsc.weightedPosition / gsc.impressions : null, ga4Sessions: page.analytics?.sessions ?? null, ga4Users: page.analytics?.activeUsers ?? null, ga4EngagementRate: page.analytics?.engagementRate ?? null, ga4BounceRate: page.analytics?.bounceRate ?? null, lcp: page.pageSpeed[0]?.metrics.lcp ?? null, cls: page.pageSpeed[0]?.metrics.cls ?? null, inp: page.pageSpeed[0]?.fieldMetrics?.inp?.percentile ?? null, tbt: page.pageSpeed[0]?.metrics.tbt ?? null }; }) },
      deltas: previous ? { create: deltas.map(item => ({ ...item, previousRunId: previous.id })) } : undefined
    } });
  });
}

export async function listTrendDomains() {
  if (!historyEnabled()) return [];
  return db().domain.findMany({ where: { runs: { some: {} } }, include: { _count: { select: { runs: true } }, runs: { take: 1, orderBy: { generatedAt: 'desc' }, select: { id: true, generatedAt: true, status: true, scanType: true, pageCount: true, comparisonStatus: true } } }, orderBy: { displayDomain: 'asc' } });
}
export async function getDomainTrend(domainId: string) {
  if (!historyEnabled()) return null;
  const domain = await db().domain.findUnique({ where: { id: domainId }, include: { aliases: { select: { normalizedDomain: true, rawDomain: true, createdAt: true } }, runs: { orderBy: { generatedAt: 'asc' }, select: { id: true, rawStartUrl: true, generatedAt: true, status: true, scanType: true, pageCount: true, fetchedCount: true, sitemapUrlCount: true, criticalCount: true, warningCount: true, infoCount: true, orphanPageCount: true, averageClickDepth: true, staleContentCount: true, nearDuplicateGroups: true, headingViolations: true, mixedContentPages: true, canonicalSelfRate: true, canonicalChains: true, canonicalNon200: true, crawlWasteUrls: true, schemaCoverage: true, indexableRate: true, gscAveragePosition: true, gscClicks: true, gscImpressions: true, gscCtr: true, gscKeywordCount: true, gscPeriodStart: true, gscPeriodEnd: true, ga4Sessions: true, ga4Users: true, ga4EngagementRate: true, ga4BounceRate: true, ga4PeriodStart: true, ga4PeriodEnd: true, averageLcp: true, averageCls: true, averageInp: true, averageTbt: true, previousRunId: true, comparisonStatus: true, comparisonNotes: true, reportJsonPath: true, deltas: { select: { fingerprint: true, state: true } } } }, sourceMerges: { select: { id: true, sourceDomainId: true, targetDomainId: true, performedAt: true, performedBy: true, reason: true } }, targetMerges: { select: { id: true, sourceDomainId: true, targetDomainId: true, performedAt: true, performedBy: true, reason: true } } } });
  if (!domain) return null;
  const runs = await Promise.all(domain.runs.map(async run => {
    let totals = { gscClicks: run.gscClicks, gscImpressions: run.gscImpressions, gscCtr: run.gscCtr, gscKeywordCount: run.gscKeywordCount, ga4Sessions: run.ga4Sessions, ga4Users: run.ga4Users, ga4EngagementRate: run.ga4EngagementRate, ga4BounceRate: run.ga4BounceRate };
    if (run.reportJsonPath && (totals.gscClicks == null || totals.ga4Sessions == null)) try { totals = { ...totals, ...trafficTotals(JSON.parse(await readFile(run.reportJsonPath, 'utf8')) as AuditReport) }; } catch { /* Retain stored metrics when a legacy artifact is unavailable. */ }
    const { reportJsonPath: _reportJsonPath, ...safeRun } = run;
    return { ...safeRun, ...totals };
  }));
  const trafficDiagnosis = diagnoseTrafficChange(runs.at(-2), runs.at(-1));
  const allFindings = await db().runFinding.findMany({ where: { run: { domainId } }, select: { ruleId: true, normalizedPageUrl: true, category: true, severity: true, message: true, runId: true, run: { select: { generatedAt: true } } } });
  const latestRunId = runs.at(-1)?.id, latestRules = new Set(allFindings.filter(item => item.runId === latestRunId).map(item => item.ruleId)), grouped = new Map<string, typeof allFindings>();
  for (const finding of allFindings) if (latestRules.has(finding.ruleId)) grouped.set(finding.ruleId, [...(grouped.get(finding.ruleId) ?? []), finding]);
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  const persistentIssues = [...grouped.entries()].map(([ruleId, items]) => {
    const current = items.filter(item => item.runId === latestRunId), runIds = new Set(items.map(item => item.runId)), firstSeen = items.reduce((earliest, item) => item.run.generatedAt < earliest ? item.run.generatedAt : earliest, items[0].run.generatedAt);
    return { ruleId, category: current[0]?.category ?? items[0].category, severity: current[0]?.severity ?? items[0].severity, message: current[0]?.message ?? items[0].message, affectedPages: new Set(current.map(item => item.normalizedPageUrl)).size, observedRuns: runIds.size, firstSeen, latestSeen: runs.at(-1)?.generatedAt };
  }).filter(issue => issue.observedRuns >= 2).sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9) || b.observedRuns - a.observedRuns || b.affectedPages - a.affectedPages).slice(0, 20);
  return { ...domain, runs, trafficDiagnosis, persistentIssues };
}
export async function locateHistoricalRun(runId: string) {
  if (!historyEnabled()) return null;
  return db().auditRun.findUnique({ where: { id: runId }, select: { id: true, domainId: true, generatedAt: true, comparisonStatus: true } });
}

const safeStoredPath = (stored: string, outputRoot: string) => {
  const target = resolve(stored), root = resolve(outputRoot), rel = relative(root, target);
  if (!rel || rel.startsWith(`..${sep}`) || rel === '..') throw new Error('Stored audit path is outside the configured audit-output root.');
  return target;
};
export async function getHistoricalRunArtifacts(runId: string, outputRoot: string) {
  if (!historyEnabled()) return null;
  const run = await db().auditRun.findUnique({ where: { id: runId }, select: { id: true, domainId: true, generatedAt: true, status: true, outputDirectory: true, reportJsonPath: true } });
  if (!run?.outputDirectory || !run.reportJsonPath) return null;
  const directory = safeStoredPath(run.outputDirectory, outputRoot), reportPath = safeStoredPath(run.reportJsonPath, outputRoot);
  const report = JSON.parse(await readFile(reportPath, 'utf8')) as AuditReport;
  const files = await readdir(directory);
  const docx = files.find(file => /^SCOPE-Audit-.+\.docx$/i.test(file));
  const pdf = files.find(file => /^SCOPE-Audit-.+\.pdf$/i.test(file));
  return { run: { id: run.id, domainId: run.domainId, generatedAt: run.generatedAt, status: run.status }, report, files: { docx: docx ? resolve(directory, docx) : null, pdf: pdf ? resolve(directory, pdf) : null } };
}
export async function deleteRunHistory(runId: string, confirmation: string, outputRoot: string, actor = 'local-user') {
  const prisma = db(), run = await prisma.auditRun.findUnique({ where: { id: runId }, include: { domain: true } });
  if (!run) throw new Error('Run not found.');
  if (confirmation !== `DELETE ${run.id}`) throw new Error(`Type DELETE ${run.id} to confirm irreversible deletion.`);
  let quarantine: string | undefined;
  if (run.outputDirectory) {
    const target = safeStoredPath(run.outputDirectory, outputRoot); try { await stat(target); quarantine = resolve(dirname(target), `.scope-delete-${randomUUID()}`); await rename(target, quarantine); } catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
  }
  try { await prisma.$transaction([prisma.historyEvent.create({ data: { action: 'RUN_DELETED', domainId: run.domainId, runId, actor, detailsJson: { generatedAt: run.generatedAt, outputDirectory: run.outputDirectory } } }), prisma.auditRun.delete({ where: { id: runId } })]); }
  catch (error) { if (quarantine && run.outputDirectory) await rename(quarantine, run.outputDirectory); throw error; }
  if (quarantine) await rm(quarantine, { recursive: true, force: true });
}

export async function deleteDomainHistory(domainId: string, confirmation: string, outputRoot: string, actor = 'local-user') {
  const prisma = db(), domain = await prisma.domain.findUnique({ where: { id: domainId }, include: { runs: true } });
  if (!domain) throw new Error('Domain history was not found.');
  if (confirmation !== `DELETE ${domain.normalizedDomain}`) throw new Error(`Type DELETE ${domain.normalizedDomain} to confirm irreversible deletion.`);
  for (const run of domain.runs) await deleteRunHistory(run.id, `DELETE ${run.id}`, outputRoot, actor);
  await prisma.$transaction([
    prisma.domainMerge.deleteMany({ where: { OR: [{ sourceDomainId: domainId }, { targetDomainId: domainId }] } }),
    prisma.domainAlias.deleteMany({ where: { domainId } }),
    prisma.historyEvent.create({ data: { action: 'DOMAIN_HISTORY_DELETED', domainId, actor, detailsJson: { normalizedDomain: domain.normalizedDomain } } }),
    prisma.domain.delete({ where: { id: domainId } })
  ]);
  const parents = new Set(domain.runs.flatMap(run => run.outputDirectory ? [dirname(safeStoredPath(run.outputDirectory, outputRoot))] : []));
  for (const parent of parents) try { await rmdir(parent); } catch (error: any) { if (!['ENOENT', 'ENOTEMPTY'].includes(error?.code)) throw error; }
}

export async function mergeDomains(sourceDomainId: string, targetDomainId: string, reason: string, actor = 'local-user') {
  if (sourceDomainId === targetDomainId) throw new Error('A domain cannot be merged into itself.');
  const prisma = db(), [source, target] = await Promise.all([prisma.domain.findUnique({ where: { id: sourceDomainId } }), prisma.domain.findUnique({ where: { id: targetDomainId } })]);
  if (!source || !target) throw new Error('Source or target domain was not found.');
  await prisma.$transaction(async tx => {
    await tx.domainMerge.create({ data: { sourceDomainId, targetDomainId, reason, performedBy: actor, metadataJson: { source: source.normalizedDomain, target: target.normalizedDomain } } });
    await tx.domainAlias.upsert({ where: { normalizedDomain: source.normalizedDomain }, update: { domainId: targetDomainId }, create: { domainId: targetDomainId, normalizedDomain: source.normalizedDomain, rawDomain: source.displayDomain } });
    await tx.auditRun.updateMany({ where: { domainId: sourceDomainId }, data: { domainId: targetDomainId } });
    await tx.historyEvent.create({ data: { action: 'DOMAINS_MERGED', domainId: targetDomainId, actor, detailsJson: { sourceDomainId, targetDomainId, reason } } });
  });
}
