import type { Page } from 'playwright';
import type { AppConfig } from '../../config/index.js';
import type { ExtractedImage, ImageFormat } from '../types.js';
import type { ResponseRecord } from '../fetchRender/index.js';

const CONTENT_TYPE_TO_FORMAT: Record<string, ImageFormat> = {
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};

const EXTENSION_TO_FORMAT: Record<string, ImageFormat> = {
  webp: 'webp',
  avif: 'avif',
  jpg: 'jpeg',
  jpeg: 'jpeg',
  png: 'png',
  gif: 'gif',
  svg: 'svg',
  bmp: 'bmp',
  tiff: 'tiff',
  tif: 'tiff',
  ico: 'ico',
};

/** Content-Type header is authoritative; falls back to the URL's file extension. */
function detectFormat(resolvedSrc: string | null, contentTypeByUrl: Map<string, string | null>): ImageFormat | null {
  if (!resolvedSrc) return null;

  const contentType = contentTypeByUrl.get(resolvedSrc)?.split(';')[0]?.trim().toLowerCase();
  if (contentType && CONTENT_TYPE_TO_FORMAT[contentType]) {
    return CONTENT_TYPE_TO_FORMAT[contentType];
  }

  try {
    const ext = new URL(resolvedSrc).pathname.split('.').pop()?.toLowerCase();
    if (ext && EXTENSION_TO_FORMAT[ext]) return EXTENSION_TO_FORMAT[ext];
  } catch {
    // not a resolvable absolute URL (e.g. a data: URI) — format stays undetermined
  }
  return null;
}

interface RawImage {
  src: string;
  resolvedSrc: string | null;
  alt: string | null;
  width: number | null;
  height: number | null;
}

async function extractRawImages(page: Page): Promise<RawImage[]> {
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLImageElement>('img'));
    return nodes.map((el) => {
      const rawSrc = el.getAttribute('src') ?? el.getAttribute('data-src') ?? '';
      // `.src` (the IDL property, not getAttribute) is browser-resolved against the
      // document's base URL, including any <base href>, so prefer it when present.
      let resolvedSrc: string | null = null;
      if (el.hasAttribute('src') && el.src) {
        resolvedSrc = el.src;
      } else if (rawSrc) {
        try {
          resolvedSrc = new URL(rawSrc, document.baseURI).href;
        } catch {
          resolvedSrc = null;
        }
      }
      // The width/height ATTRIBUTES (not the rendered/CSS size) are what let the
      // browser reserve layout space before the image loads, preventing CLS.
      const widthAttr = el.getAttribute('width');
      const heightAttr = el.getAttribute('height');
      const width = widthAttr !== null && /^\d+$/.test(widthAttr) ? Number(widthAttr) : null;
      const height = heightAttr !== null && /^\d+$/.test(heightAttr) ? Number(heightAttr) : null;
      return {
        src: rawSrc,
        resolvedSrc,
        alt: el.hasAttribute('alt') ? el.getAttribute('alt') : null,
        width,
        height,
      };
    });
  });
}

export async function extractImages(
  page: Page,
  responses: ResponseRecord[],
  config: AppConfig,
): Promise<ExtractedImage[]> {
  const rawImages = await extractRawImages(page);
  const contentTypeByUrl = new Map(responses.map((r) => [r.url, r.contentType]));
  const nextGenFormats = new Set(config.thresholds.nextGenImageFormats);

  return rawImages.map((img) => {
    const format = detectFormat(img.resolvedSrc, contentTypeByUrl);
    return {
      src: img.src,
      resolvedSrc: img.resolvedSrc,
      alt: img.alt,
      format,
      isNextGenFormat: format === null ? null : nextGenFormats.has(format),
      width: img.width,
      height: img.height,
    };
  });
}
