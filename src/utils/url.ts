import { createHash } from 'node:crypto';

export function hashUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex');
}

export function getDomain(url: string): string {
  return new URL(url).hostname.replace(/^www\./, '');
}

export function resolveUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

export function isInternalUrl(candidate: string, baseUrl: string): boolean {
  try {
    return new URL(candidate).hostname === new URL(baseUrl).hostname;
  } catch {
    return false;
  }
}

export function isHttpUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

export function originOf(url: string): string {
  return new URL(url).origin;
}
