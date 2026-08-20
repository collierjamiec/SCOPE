type Level = 'debug' | 'info' | 'warn' | 'error';

const PREFIX: Record<Level, string> = {
  debug: '[debug]',
  info: '[info]',
  warn: '[warn]',
  error: '[error]',
};

function log(level: Level, ...args: unknown[]): void {
  const stream = level === 'error' || level === 'warn' ? console.error : console.log;
  stream(PREFIX[level], ...args);
}

export const logger = {
  debug: (...args: unknown[]) => log('debug', ...args),
  info: (...args: unknown[]) => log('info', ...args),
  warn: (...args: unknown[]) => log('warn', ...args),
  error: (...args: unknown[]) => log('error', ...args),
};
