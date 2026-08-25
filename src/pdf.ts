import { mkdir, rename } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { spawn } from 'node:child_process';

export async function convertDocxToPdf(docxPath: string, pdfPath: string): Promise<void> {
  await mkdir(dirname(pdfPath), { recursive: true });
  const profile = join(dirname(pdfPath), `.lo-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(profile, { recursive: true });
  await new Promise<void>((resolve, reject) => {
    const child = spawn('soffice', ['--headless', `-env:UserInstallation=file://${profile}`, '--convert-to', 'pdf', '--outdir', dirname(pdfPath), docxPath], { stdio: ['ignore', 'pipe', 'pipe'] });
    let error = '';
    child.stderr.on('data', chunk => { error += String(chunk); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`PDF conversion failed (${code}): ${error}`)));
  });
  const generated = join(dirname(pdfPath), `${basename(docxPath, extname(docxPath))}.pdf`);
  if (generated !== pdfPath) await rename(generated, pdfPath);
}
