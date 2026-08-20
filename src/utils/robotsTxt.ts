import robotsParser from 'robots-parser';
import { originOf } from './url.js';
import { discardBody } from './http.js';

export interface RobotsTxtResult {
  fetched: boolean;
  blocksUrl: boolean;
}

const USER_AGENT = 'seo-geo-crawler';

export async function checkRobotsTxt(url: string, timeoutMs: number): Promise<RobotsTxtResult> {
  const robotsUrl = `${originOf(url)}/robots.txt`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(robotsUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      await discardBody(res);
      return { fetched: false, blocksUrl: false };
    }
    const body = await res.text();
    const robots = robotsParser(robotsUrl, body);
    const allowed = robots.isAllowed(url, USER_AGENT) ?? true;
    return { fetched: true, blocksUrl: !allowed };
  } catch {
    clearTimeout(timer);
    return { fetched: false, blocksUrl: false };
  }
}
