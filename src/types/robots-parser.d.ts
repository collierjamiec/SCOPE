/**
 * The robots-parser package ships a malformed index.d.ts (an empty ambient
 * `declare module 'robots-parser';` on its own line shadows the real
 * declarations below it in the same file). This re-declares the module
 * correctly; TypeScript merges ambient module declarations across files.
 */
declare module 'robots-parser' {
  interface Robot {
    isAllowed(url: string, ua?: string): boolean | undefined;
    isDisallowed(url: string, ua?: string): boolean | undefined;
    getMatchingLineNumber(url: string, ua?: string): number;
    getCrawlDelay(ua?: string): number | undefined;
    getSitemaps(): string[];
    getPreferredHost(): string | null;
  }

  export default function robotsParser(url: string, robotstxt: string): Robot;
}
