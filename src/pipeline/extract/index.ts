import type { AppConfig } from '../../config/index.js';
import type { ExtractedData, Stage } from '../types.js';
import type { ProgressReporter } from '../../utils/progress.js';
import type { FetchRenderOutput } from '../fetchRender/index.js';
import { extractMetadata } from './metadata.js';
import { extractHeadings } from './headings.js';
import { extractImages } from './images.js';
import { extractSchema } from './schema.js';
import { extractLinkElements, checkLinkStatuses } from './links.js';
import { extractTechnical } from './technical.js';
import { extractContentDomSignals, buildContent } from './content.js';

export class ExtractStage implements Stage<FetchRenderOutput, ExtractedData> {
  name = 'extract' as const;

  async run(fetched: FetchRenderOutput, config: AppConfig, progress: ProgressReporter): Promise<ExtractedData> {
    progress.startStage('extract', 'Reading page content…');
    // Every page.evaluate() extractor runs in this one batch, immediately after
    // navigation — before any slow network I/O (link-status checking below can
    // take many seconds). Waiting until afterward risks the live page navigating
    // away on its own (client-side redirect, consent-wall bounce, etc.), which
    // destroys the execution context and fails any pending page.evaluate().
    const [metadata, headings, images, schema, rawLinks, contentDomSignals] = await Promise.all([
      extractMetadata(fetched.page, fetched.url),
      extractHeadings(fetched.page),
      extractImages(fetched.page, fetched.responses, config),
      extractSchema(fetched.page),
      extractLinkElements(fetched.page),
      extractContentDomSignals(fetched.page),
    ]);

    progress.update('extract', 0.25, 'Checking links…');
    const links = await checkLinkStatuses(rawLinks, fetched.url, config, progress);

    progress.update('extract', 0.85, 'Checking robots.txt, sitemap.xml, llms.txt…');
    const technical = await extractTechnical(fetched, config);

    progress.update('extract', 0.95, 'Assembling content signals…');
    const content = buildContent(contentDomSignals, links, schema.detectedTypes);

    await fetched.close();
    progress.finishStage('extract');

    return {
      url: fetched.url,
      fetchedAt: new Date().toISOString(),
      metadata,
      headings,
      images,
      schema,
      links,
      technical,
      content,
    };
  }
}
