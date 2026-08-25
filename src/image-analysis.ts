import type { ImageAnalysisConfig, PageResult } from './types.js';

export async function enrichImageRecommendations(page: PageResult, config?: ImageAnalysisConfig): Promise<void> {
  if (!config) return;
  const primaryKeywords = page.keywordSignals.slice(0, 5).map(signal => signal.phrase);
  for (const image of page.imageRecommendations) {
    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({ imageUrl: image.src, pageUrl: page.url, pageTitle: page.title, primaryKeywords, currentAlt: image.currentAlt }),
        signal: AbortSignal.timeout(30000)
      });
      if (!response.ok) continue;
      const result = await response.json() as { description?: string; suggestedAlt?: string; suggestedFilename?: string };
      if (result.suggestedAlt) image.suggestedAlt = result.suggestedAlt.slice(0, 160);
      if (result.suggestedFilename) image.suggestedFilename = result.suggestedFilename;
      if (result.description) image.visualDescription = result.description;
      image.basis = 'vision';
    } catch { /* Preserve the deterministic page-context recommendation. */ }
  }
}
