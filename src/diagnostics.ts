import { appendFile, chmod, mkdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export type DiagnosticComponent = 'crawl'|'pagespeed'|'pdf'|'gsc'|'ga4'|'seranking'|'database'|'system';
export type DiagnosticSeverity = 'info'|'warning'|'error'|'resolved';
export type IntegrationComponent = 'pagespeed'|'gsc'|'ga4'|'seranking'|'database';

export interface DiagnosticEntry {
  id: string;
  timestamp: string;
  jobId?: string;
  component: DiagnosticComponent;
  severity: DiagnosticSeverity;
  event: string;
  message: string;
  cause?: string;
  reproduction?: string;
  resolution?: string;
  url?: string;
  settings?: Record<string, unknown>;
  external?: boolean;
}

export interface IntegrationHealth {
  state: 'healthy'|'error'|'unknown';
  message: string;
  resolution?: string;
  timestamp?: string;
  jobId?: string;
}

const sensitiveKey = /key|secret|token|authorization|cookie|password|credential|csv|raw|body/i;
const health = new Map<IntegrationComponent, IntegrationHealth>();
const logPath = () => process.env.SCOPE_DIAGNOSTIC_LOG ?? join(process.env.SCOPE_DATA_DIR ?? resolve(process.cwd(), '.scope'), 'diagnostics.jsonl');

function safeUrl(value: string) {
  try {
    const parsed = new URL(value);
    for (const key of [...parsed.searchParams.keys()]) if (sensitiveKey.test(key)) parsed.searchParams.set(key, '[REDACTED]');
    parsed.hash = '';
    return parsed.toString();
  } catch { return value.slice(0, 500); }
}

export function sanitizeDiagnosticValue(value: unknown, key = ''): unknown {
  if (sensitiveKey.test(key)) return '[REDACTED]';
  if (typeof value === 'string') return /^https?:\/\//i.test(value) ? safeUrl(value) : value.slice(0, 2_000);
  if (Array.isArray(value)) return value.slice(0, 100).map(item => sanitizeDiagnosticValue(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([childKey, child]) => [childKey, sanitizeDiagnosticValue(child, childKey)]));
  return value;
}

export async function recordDiagnostic(entry: Omit<DiagnosticEntry, 'id'|'timestamp'>): Promise<DiagnosticEntry> {
  const complete = sanitizeDiagnosticValue({ id: randomUUID(), timestamp: new Date().toISOString(), ...entry }) as DiagnosticEntry;
  const path = logPath();
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await appendFile(path, `${JSON.stringify(complete)}\n`, { encoding: 'utf8', mode: 0o600 });
  try { await chmod(path, 0o600); } catch { /* Best effort on filesystems without POSIX modes. */ }
  return complete;
}

export async function listDiagnostics(limit = 1_000): Promise<DiagnosticEntry[]> {
  try {
    const lines = (await readFile(logPath(), 'utf8')).split('\n').filter(Boolean);
    return lines.slice(-Math.min(10_000, Math.max(1, limit))).reverse().flatMap(line => { try { return [JSON.parse(line) as DiagnosticEntry]; } catch { return []; } });
  } catch { return []; }
}

export async function setIntegrationFailure(component: IntegrationComponent, message: string, resolution: string, options: { jobId?: string; cause?: string; external?: boolean } = {}) {
  const item = await recordDiagnostic({ component, severity: 'error', event: 'integration_failure', message, resolution, ...options });
  health.set(component, { state: 'error', message, resolution, timestamp: item.timestamp, jobId: options.jobId });
}

export async function setIntegrationHealthy(component: IntegrationComponent, message: string, jobId?: string) {
  const previous = health.get(component);
  if (previous?.state === 'error') await recordDiagnostic({ component, severity: 'resolved', event: 'integration_recovered', message, jobId });
  health.set(component, { state: 'healthy', message, timestamp: new Date().toISOString(), jobId });
}

export function getIntegrationHealth(component: IntegrationComponent): IntegrationHealth {
  return health.get(component) ?? { state: 'unknown', message: 'No live request has been completed during this SCOPE session.' };
}

export function getAllIntegrationHealth(): Record<IntegrationComponent, IntegrationHealth> {
  return Object.fromEntries((['database','ga4','gsc','pagespeed','seranking'] as IntegrationComponent[]).map(component => [component, getIntegrationHealth(component)])) as Record<IntegrationComponent, IntegrationHealth>;
}

export async function hydrateIntegrationHealth() {
  const entries = await listDiagnostics(10_000);
  for (const component of ['database','ga4','gsc','pagespeed','seranking'] as IntegrationComponent[]) {
    const latest = entries.find(entry => entry.component === component && (entry.event === 'integration_failure' || entry.event === 'integration_recovered'));
    if (!latest) continue;
    health.set(component, latest.event === 'integration_failure'
      ? { state: 'error', message: latest.message, resolution: latest.resolution, timestamp: latest.timestamp, jobId: latest.jobId }
      : { state: 'healthy', message: latest.message, timestamp: latest.timestamp, jobId: latest.jobId });
  }
}

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[character]!));

export function diagnosticsHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SCOPE diagnostics</title><style>:root{font:15px/1.45 Inter,system-ui;color:#12202e;background:#f6f7f4}body{margin:0;padding:32px}main{max-width:1500px;margin:auto}h1{font-size:42px;margin:.2em 0}.note,.controls{background:white;border:1px solid #dde4e7;border-radius:14px;padding:16px;margin:15px 0}.controls{display:flex;gap:12px;flex-wrap:wrap}.controls input,.controls select,.controls a{padding:9px 11px;border:1px solid #ccd7db;border-radius:8px;background:white;color:#12202e}.controls a{background:#102d3d;color:white;text-decoration:none;font-weight:800}.wrap{overflow:auto;background:white;border:1px solid #dde4e7;border-radius:14px}table{border-collapse:collapse;width:100%;min-width:1300px}th,td{text-align:left;vertical-align:top;padding:10px;border-bottom:1px solid #dde4e7;overflow-wrap:anywhere}th{position:sticky;top:0;background:#f1f5f3;font-size:11px;text-transform:uppercase}.error{color:#ba3b46;font-weight:800}.warning{color:#b76a13}.resolved{color:#0c7067}.empty{text-align:center;padding:50px;color:#637083}</style></head><body><main><a href="/">← Current audit dashboard</a><h1>Diagnostic &amp; crawl logs</h1><div class="note"><b>Read-only, privacy-protected log.</b> SCOPE records timestamps, crawl settings, URLs, phases, failures, likely causes, reproduction context, and recommended resolution. API keys, OAuth secrets, tokens, cookies, request bodies, and uploaded CSV contents are redacted or never logged.</div><div class="controls"><input id="search" type="search" placeholder="Search logs"><select id="severity"><option value="">All severities</option><option>error</option><option>warning</option><option>info</option><option>resolved</option></select><select id="component"><option value="">All components</option><option>crawl</option><option>pagespeed</option><option>pdf</option><option>gsc</option><option>ga4</option><option>seranking</option><option>database</option><option>system</option></select><a href="/api/diagnostics/download">Download formatted log</a></div><div class="wrap"><table><thead><tr><th>Timestamp</th><th>Severity</th><th>Component</th><th>Job</th><th>Event / URL</th><th>What happened</th><th>Likely cause</th><th>How to reproduce</th><th>How to resolve</th><th>Settings</th></tr></thead><tbody id="rows"><tr><td class="empty" colspan="10">Loading…</td></tr></tbody></table></div></main><script>const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let entries=[];const render=()=>{const q=document.querySelector('#search').value.toLowerCase(),severity=document.querySelector('#severity').value,component=document.querySelector('#component').value,found=entries.filter(x=>(!severity||x.severity===severity)&&(!component||x.component===component)&&(!q||JSON.stringify(x).toLowerCase().includes(q)));document.querySelector('#rows').innerHTML=found.length?found.map(x=>'<tr><td>'+esc(new Date(x.timestamp).toLocaleString())+'</td><td class="'+esc(x.severity)+'">'+esc(x.severity)+'</td><td>'+esc(x.component)+'</td><td>'+esc(x.jobId||'—')+'</td><td><b>'+esc(x.event)+'</b><br>'+esc(x.url||'')+'</td><td>'+esc(x.message)+'</td><td>'+esc(x.cause||'Not established')+(x.external?' <b>(external service)</b>':'')+'</td><td>'+esc(x.reproduction||'Use the same URL and recorded settings.')+'</td><td>'+esc(x.resolution||'No action required.')+'</td><td><code>'+esc(x.settings?JSON.stringify(x.settings,null,2):'—')+'</code></td></tr>').join(''):'<tr><td class="empty" colspan="10">No matching diagnostic events.</td></tr>'};fetch('/api/diagnostics?limit=5000').then(r=>r.json()).then(x=>{entries=x.entries;render()});document.querySelectorAll('input,select').forEach(x=>x.addEventListener('input',render));</script></body></html>`;
}

export function diagnosticsDownloadHtml(entries: DiagnosticEntry[]) {
  const rows = entries.map(item => `<tr><td>${esc(new Date(item.timestamp).toLocaleString())}</td><td>${esc(item.severity)}</td><td>${esc(item.component)}</td><td>${esc(item.jobId ?? '—')}</td><td>${esc(item.event)}<br>${esc(item.url ?? '')}</td><td>${esc(item.message)}</td><td>${esc(item.cause ?? 'Not established')}</td><td>${esc(item.reproduction ?? 'Use the recorded URL and settings.')}</td><td>${esc(item.resolution ?? 'No action required.')}</td><td><pre>${esc(item.settings ? JSON.stringify(item.settings, null, 2) : '—')}</pre></td></tr>`).join('');
  return `<!doctype html><meta charset="utf-8"><title>SCOPE diagnostic log</title><style>@page{size:landscape;margin:10mm}body{font:9px Arial;color:#12202e}h1{font-size:22px}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border:1px solid #ccd7db;padding:5px;vertical-align:top;overflow-wrap:anywhere}th{background:#eaf2ef}th:nth-child(1){width:9%}th:nth-child(2),th:nth-child(3){width:6%}th:nth-child(4){width:8%}th:nth-child(5){width:12%}th:nth-child(6){width:13%}th:nth-child(7),th:nth-child(8),th:nth-child(9){width:11%}th:nth-child(10){width:13%}pre{white-space:pre-wrap;margin:0}</style><h1>SCOPE diagnostic and crawl log</h1><p>Generated ${esc(new Date().toLocaleString())}. Sensitive credentials, API keys, tokens, cookies, raw request bodies, and imported file contents are redacted or excluded.</p><table><thead><tr><th>Timestamp</th><th>Severity</th><th>Component</th><th>Job</th><th>Event / URL</th><th>What happened</th><th>Likely cause</th><th>Reproduce</th><th>Resolution</th><th>Settings</th></tr></thead><tbody>${rows}</tbody></table>`;
}
