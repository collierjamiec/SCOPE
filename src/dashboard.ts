#!/usr/bin/env node
import { createServer, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve } from 'node:path';
import { crawlSite, type CrawlProgress } from './crawler.js';
import { auditDocumentFilename, createAuditDocument } from './document.js';
import { imagesCsv, keywordsCsv, linksCsv, pagesCsv } from './report.js';
import { convertDocxToPdf } from './pdf.js';
import type { AuditConfig, AuditReport } from './types.js';

try { process.loadEnvFile(); } catch { /* Environment variables may be supplied by the host. */ }

type Job = { id: string; status: 'running'|'complete'|'failed'; progress: CrawlProgress; report?: AuditReport; error?: string; directory?: string; docx?: string; pdf?: string; listeners: Set<ServerResponse> };
const jobs = new Map<string, Job>();
const outputRoot = resolve(process.env.AUDIT_OUTPUT_DIR ?? 'audit-output');
const port = Number(process.env.PORT ?? 4173);
const copyrightOwner = process.env.SCOPE_COPYRIGHT_OWNER ?? 'Jamie C. Collier';
const creatorName = process.env.SCOPE_CREATOR_NAME ?? 'Jamie C. Collier';

const json = (response: ServerResponse, status: number, value: unknown) => { response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(value)); };
const sendEvent = (job: Job, event: string, data: unknown) => {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const listener of job.listeners) listener.write(payload);
};
async function body(request: import('node:http').IncomingMessage): Promise<any> {
  let raw = '';
  for await (const chunk of request) { raw += String(chunk); if (raw.length > 100_000) throw new Error('Request too large'); }
  return raw ? JSON.parse(raw) : {};
}
function artifact(response: ServerResponse, path: string, type: string, name: string) {
  response.writeHead(200, { 'content-type': type, 'content-disposition': `attachment; filename="${name}"` });
  createReadStream(path).pipe(response);
}

async function run(job: Job, config: AuditConfig) {
  try {
    const report = await crawlSite(config, progress => { job.progress = progress; sendEvent(job, 'progress', progress); });
    const safeDomain = report.domain.replace(/[^a-z0-9.-]+/gi, '_');
    const directory = resolve(outputRoot, safeDomain);
    await mkdir(directory, { recursive: true });
    const docxName = auditDocumentFilename(new Date(report.generatedAt));
    const docxPath = resolve(directory, docxName);
    const pdfPath = resolve(directory, docxName.replace(/\.docx$/i, '.pdf'));
    const documentBuffer = await createAuditDocument(report);
    await Promise.all([
      writeFile(resolve(directory, 'report.json'), JSON.stringify(report, null, 2)),
      writeFile(resolve(directory, 'pages.csv'), pagesCsv(report)),
      writeFile(resolve(directory, 'keywords.csv'), keywordsCsv(report)),
      writeFile(resolve(directory, 'links.csv'), linksCsv(report)),
      writeFile(resolve(directory, 'images.csv'), imagesCsv(report)),
      writeFile(docxPath, documentBuffer)
    ]);
    try { await convertDocxToPdf(docxPath, pdfPath); job.pdf = pdfPath; } catch { /* DOCX remains available if LibreOffice is absent. */ }
    job.status = 'complete'; job.report = report; job.directory = directory; job.docx = docxPath;
    sendEvent(job, 'complete', { id: job.id, report, downloads: { docx: `/api/audits/${job.id}/download/docx`, pdf: job.pdf ? `/api/audits/${job.id}/download/pdf` : null } });
  } catch (error) {
    job.status = 'failed'; job.error = error instanceof Error ? error.message : String(error);
    sendEvent(job, 'failed', { error: job.error });
  }
}

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SCOPE — Search & Content Optimization Performance Engine</title><meta name="description" content="Robots-aware SEO, GEO and AI answer-readiness website audits with live crawl progress."><style>
:root{--ink:#12202e;--muted:#637083;--line:#dde4e7;--paper:#f6f7f4;--card:#fff;--teal:#0c7067;--lime:#c7ff65;--navy:#102d3d;--red:#ba3b46;--amber:#b76a13}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 85% 0,#dff8ee 0,transparent 28%),var(--paper);color:var(--ink);font:15px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,sans-serif}header{padding:28px clamp(20px,5vw,72px);display:flex;align-items:center;justify-content:space-between}.brand{font-weight:900;letter-spacing:.16em}.brand span{color:var(--teal)}.pill{border:1px solid var(--line);border-radius:99px;padding:7px 12px;color:var(--muted);background:#ffffffaa}.hero{padding:58px clamp(20px,8vw,120px) 42px;max-width:1400px;margin:auto}.eyebrow{color:var(--teal);font-weight:800;text-transform:uppercase;letter-spacing:.13em;font-size:12px}h1{font-size:clamp(42px,7vw,86px);line-height:.94;letter-spacing:-.055em;max-width:920px;margin:16px 0 24px}h1 em{font-style:normal;color:var(--teal)}.lead{font-size:18px;color:var(--muted);max-width:680px}.launch{margin-top:34px;background:var(--navy);padding:10px;border-radius:18px;display:grid;grid-template-columns:1fr auto auto;gap:10px;box-shadow:0 18px 50px #0c2b3b26}.launch input,.launch select{border:0;border-radius:11px;padding:15px 16px;font:inherit;min-width:0}.launch button,.button{border:0;border-radius:11px;background:var(--lime);color:#183626;font-weight:900;padding:0 22px;cursor:pointer}.check{display:flex;gap:8px;align-items:center;color:white;padding:0 8px;white-space:nowrap}.workspace{max-width:1400px;margin:0 auto;padding:20px clamp(20px,5vw,72px) 80px}.progress-card,.panel{background:var(--card);border:1px solid var(--line);border-radius:18px;box-shadow:0 10px 35px #183b4420}.progress-card{display:none;padding:22px;margin-bottom:24px}.progress-top{display:flex;justify-content:space-between;gap:18px}.bar{height:10px;background:#e5eaeb;border-radius:99px;overflow:hidden;margin:17px 0}.bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--teal),#45b879);transition:width .35s}.activity{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:20px 0}.metric{background:var(--card);border:1px solid var(--line);border-radius:15px;padding:18px}.metric b{display:block;font-size:29px;letter-spacing:-.04em}.metric span{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.08em}.tabs{display:flex;gap:4px;overflow:auto;margin-bottom:14px}.tabs button{border:0;background:transparent;padding:10px 14px;border-radius:9px;font-weight:750;color:var(--muted);cursor:pointer}.tabs button.active{background:var(--navy);color:white}.panel{padding:22px;overflow:hidden}.panel-head{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-bottom:16px}.panel h2{margin:0;font-size:24px}.downloads{display:flex;gap:8px}.downloads a{background:var(--navy);color:white;text-decoration:none;border-radius:9px;padding:9px 12px;font-weight:700}.table-wrap{overflow:auto;max-height:640px}table{border-collapse:collapse;width:100%;min-width:850px}th,td{text-align:left;padding:12px;border-bottom:1px solid var(--line);vertical-align:top}th{position:sticky;top:0;background:#f8faf9;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}td a{color:var(--teal)}.score{font-weight:850}.badge{display:inline-flex;border-radius:99px;padding:3px 8px;background:#e6f4ef;color:var(--teal);font-size:12px;font-weight:800}.bad{background:#fdebed;color:var(--red)}.empty{padding:70px;text-align:center;color:var(--muted)}.error{color:var(--red)}@media(max-width:800px){.launch{grid-template-columns:1fr}.launch button{padding:15px}.metrics{grid-template-columns:repeat(2,1fr)}.check{padding:8px}.hero{padding-top:25px}}
</style></head><body><header><div class="brand"><span>SCOPE</span> / SITE INTELLIGENCE</div><div class="pill">Robots-aware • Indexable pages only</div></header><main><section class="hero"><div class="eyebrow">Organic visibility, explained</div><h1>See the whole site.<br><em>Know what to fix.</em></h1><p class="lead">Launch a complete SEO, GEO and AI answer-readiness crawl from any starting page. Watch it work, inspect every finding, and export the full audit.</p><form class="launch" id="launch"><input id="url" type="url" required placeholder="https://example.com/start-page" aria-label="Starting page"><select id="limit" aria-label="Crawl scope"><option value="all">Entire website</option><option value="50">First 50 pages</option><option value="250">First 250 pages</option><option value="500">First 500 pages</option></select><label class="check"><input id="pagespeed" type="checkbox"> PageSpeed</label><button>Start audit</button></form></section><section class="workspace"><div class="progress-card" id="progress"><div class="progress-top"><strong id="phase">Preparing crawl</strong><span id="counts">0 fetched</span></div><div class="bar"><i id="bar"></i></div><div class="activity" id="activity">Waiting to begin…</div></div><div id="results"></div></section></main><footer>© ${new Date().getFullYear()} ${copyrightOwner}. All rights reserved. ${creatorName ? `Created by ${creatorName}.` : ''}<br>SCOPE — Search & Content Optimization Performance Engine</footer><script>
const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let report,downloads,maxProgress=0;
document.body.style.cssText+=';min-height:100vh;display:flex;flex-direction:column';document.querySelector('main').style.flex='1';document.querySelector('footer').style.cssText='margin-top:auto;padding:24px clamp(20px,5vw,72px) 40px;border-top:1px solid #dde4e7;color:#637083;font-size:13px;line-height:1.7';
function metrics(){const findings=report.pages.flatMap(p=>p.findings),aio=report.pages.length?Math.round(report.pages.reduce((n,p)=>n+(p.aio?.score??0),0)/report.pages.length):0;return [['Pages',report.summary.indexablePagesAnalyzed],['AI readiness',aio+'/100'],['Keywords',report.summary.keywordsIdentified],['Warnings',findings.filter(f=>f.severity==='warning').length],['Images to improve',report.pages.reduce((n,p)=>n+p.imageRecommendations.length,0)]].map(x=>'<div class="metric"><b>'+x[1]+'</b><span>'+x[0]+'</span></div>').join('')}
const link=u=>'<a href="'+esc(u)+'" target="_blank" rel="noreferrer">'+esc(u)+'</a>';
function rows(kind){if(kind==='pages')return report.pages.map(p=>'<tr><td>'+link(p.url)+'</td><td>'+p.status+'</td><td>'+esc(p.title)+'</td><td>'+p.metaDescriptionCharacters+'</td><td>'+p.wordCount+'</td><td>'+p.internalLinkCount+' / '+p.externalLinkCount+'</td><td>'+p.findings.length+'</td></tr>').join('');if(kind==='aio')return report.pages.map(p=>'<tr><td>'+link(p.url)+'</td><td class="score">'+(p.aio?.score??'n/a')+'</td><td>'+esc((p.aio?.label??'not assessed').replaceAll('_',' '))+'</td><td>'+(p.aio?.dimensions.extractability??'')+'</td><td>'+(p.aio?.dimensions.evidence??'')+'</td><td>'+(p.aio?.dimensions.entityClarity??'')+'</td><td>'+(p.aio?.indicators.filter(i=>i.status!=='pass').length??0)+'</td></tr>').join('');if(kind==='keywords')return report.keywords.map(k=>'<tr><td><b>'+esc(k.keyword)+'</b></td><td class="score">'+(k.pages[0]?.score??0)+'</td><td>'+Math.round(k.confidence*100)+'%</td><td>'+link(k.pages[0]?.url??'')+'</td><td>'+(k.ranking?.position??'Unavailable')+'</td></tr>').join('');if(kind==='images')return report.pages.flatMap(p=>p.imageRecommendations.map(i=>'<tr><td>'+link(p.url)+'</td><td>'+esc(i.currentFilename)+'</td><td><span class="badge '+(i.issue.includes('missing')?'bad':'')+'">'+esc(i.issue.replaceAll('_',' '))+'</span></td><td>'+esc(i.suggestedFilename)+'</td><td>'+esc(i.suggestedAlt)+'</td><td>'+esc(i.basis.replace('_',' '))+'</td></tr>')).join('');return report.pages.flatMap(p=>p.findings.map(f=>'<tr><td><span class="badge '+(f.severity!=='info'?'bad':'')+'">'+esc(f.severity)+'</span></td><td>'+esc(f.category.toUpperCase())+'</td><td>'+esc(f.message)+'</td><td>'+link(p.url)+'</td></tr>')).join('')}
const heads={pages:['URL','HTTP','SEO title','Description chars','Words','Internal / external','Findings'],aio:['Page','Readiness score','Label','Extractability /20','Evidence /20','Entity clarity /15','Opportunities'],keywords:['Keyword','Target score','Confidence','Primary page','Organic rank'],images:['Page','Current filename','Issue','Suggested filename','Suggested alt text','Basis'],findings:['Severity','Area','Finding','Page']};
function render(kind='pages'){const notes=kind==='keywords'?'<p class="activity"><b>Target score</b> weights exact-phrase evidence in title (+8), H1 (+7), H2 (+4), description (+3), and body (+0.12/occurrence). <b>Confidence</b> is a capped evidence-strength heuristic—not ranking probability.</p>':kind==='aio'?'<p class="activity"><b>AI Answer Readiness</b> measures accessibility, extractability, evidence, entity clarity, intent coverage, freshness, and multimodal accessibility. <b>AI visibility is not measured</b> without citation or referral data.</p>':'';$('#results').innerHTML='<div class="metrics">'+metrics()+'</div><div class="tabs">'+Object.keys(heads).map(k=>'<button data-tab="'+k+'" class="'+(k===kind?'active':'')+'">'+k[0].toUpperCase()+k.slice(1)+'</button>').join('')+'</div><section class="panel"><div class="panel-head"><h2>'+kind[0].toUpperCase()+kind.slice(1)+'</h2><div class="downloads"><a href="'+downloads.docx+'">DOCX</a>'+(downloads.pdf?'<a href="'+downloads.pdf+'">Download full PDF</a>':'')+'</div></div>'+notes+'<div class="table-wrap"><table><thead><tr>'+heads[kind].map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows(kind)+'</tbody></table></div></section>';document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>render(b.dataset.tab))}
$('#launch').onsubmit=async e=>{e.preventDefault();report=null;downloads=null;maxProgress=0;$('#results').innerHTML='';$('#progress').style.display='block';const response=await fetch('/api/audits',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({startUrl:$('#url').value,maxPages:$('#limit').value==='all'?null:Number($('#limit').value),pageSpeed:$('#pagespeed').checked})});const started=await response.json();if(!response.ok){$('#activity').innerHTML='<span class="error">'+esc(started.error)+'</span>';return}window.auditId=started.id;const stream=new EventSource('/api/audits/'+started.id+'/events');stream.addEventListener('progress',e=>{const p=JSON.parse(e.data);maxProgress=Math.max(maxProgress,p.percent??maxProgress);$('#bar').style.width=maxProgress+'%';$('#phase').textContent=p.message;$('#counts').textContent=p.fetched+' fetched • '+p.analyzed+' analyzed • '+p.queued+' queued';$('#activity').textContent=p.currentUrl??p.phase});stream.addEventListener('complete',e=>{const data=JSON.parse(e.data);report=data.report;downloads=data.downloads;$('#bar').style.width='100%';$('#phase').textContent='Audit complete';$('#activity').textContent='Results are ready to explore and download.';stream.close();render()});stream.addEventListener('failed',e=>{const data=JSON.parse(e.data);$('#activity').innerHTML='<span class="error">'+esc(data.error)+'</span>';stream.close()})};
</script></body></html>`;

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    if (request.method === 'GET' && url.pathname === '/') { response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return response.end(html); }
    if (request.method === 'POST' && url.pathname === '/api/audits') {
      const input = await body(request);
      const startUrl = String(input.startUrl ?? ''); new URL(startUrl);
      const id = randomUUID();
      const initial: CrawlProgress = { phase: 'starting', message: 'Queued', fetched: 0, analyzed: 0, queued: 1, percent: 0 };
      const job: Job = { id, status: 'running', progress: initial, listeners: new Set() }; jobs.set(id, job);
      const config: AuditConfig = { startUrl, maxPages: input.maxPages === null ? null : Number(input.maxPages ?? 50), maxKeywords: 100, concurrency: 1, delayMs: 250, userAgent: 'SCOPEOrganicAuditor/0.2 (+respectful SEO audit)', pageSpeed: Boolean(input.pageSpeed), pageSpeedApiKey: process.env.PAGESPEED_API_KEY,
        serp: process.env.SERP_ENDPOINT && process.env.SERP_API_KEY ? { endpoint: process.env.SERP_ENDPOINT, apiKey: process.env.SERP_API_KEY } : undefined,
        imageAnalysis: process.env.IMAGE_ANALYSIS_ENDPOINT && process.env.IMAGE_ANALYSIS_API_KEY ? { endpoint: process.env.IMAGE_ANALYSIS_ENDPOINT, apiKey: process.env.IMAGE_ANALYSIS_API_KEY } : undefined };
      void run(job, config); return json(response, 202, { id });
    }
    const eventMatch = url.pathname.match(/^\/api\/audits\/([^/]+)\/events$/);
    if (request.method === 'GET' && eventMatch) {
      const job = jobs.get(eventMatch[1]); if (!job) return json(response, 404, { error: 'Audit not found' });
      response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      job.listeners.add(response); response.write(`event: progress\ndata: ${JSON.stringify(job.progress)}\n\n`);
      if (job.status === 'complete') response.write(`event: complete\ndata: ${JSON.stringify({ id: job.id, report: job.report, downloads: { docx: `/api/audits/${job.id}/download/docx`, pdf: job.pdf ? `/api/audits/${job.id}/download/pdf` : null } })}\n\n`);
      if (job.status === 'failed') response.write(`event: failed\ndata: ${JSON.stringify({ error: job.error })}\n\n`);
      request.on('close', () => job.listeners.delete(response)); return;
    }
    const downloadMatch = url.pathname.match(/^\/api\/audits\/([^/]+)\/download\/(docx|pdf)$/);
    if (request.method === 'GET' && downloadMatch) {
      const job = jobs.get(downloadMatch[1]); const kind = downloadMatch[2]; const path = kind === 'pdf' ? job?.pdf : job?.docx;
      if (!job || !path) return json(response, 404, { error: 'Artifact not available' });
      return artifact(response, path, kind === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', path.split('/').pop()!);
    }
    json(response, 404, { error: 'Not found' });
  } catch (error) { json(response, 400, { error: error instanceof Error ? error.message : String(error) }); }
});
server.listen(port, '127.0.0.1', () => console.log(`SCOPE dashboard: http://127.0.0.1:${port}`));
