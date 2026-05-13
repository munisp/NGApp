type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel =
  process.env.NODE_ENV === 'production' ? 'warn' : 'debug';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, module: string, message: string, data?: unknown): void {
  if (!shouldLog(level)) return;

  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${module}]`;

  switch (level) {
    case 'debug':
      console.debug(prefix, message, data ?? '');
      break;
    case 'info':
      console.info(prefix, message, data ?? '');
      break;
    case 'warn':
      console.warn(prefix, message, data ?? '');
      break;
    case 'error':
      console.error(prefix, message, data ?? '');
      break;
  }
}

export function createLogger(module: string) {
  return {
    debug: (message: string, data?: unknown) => formatMessage('debug', module, message, data),
    info: (message: string, data?: unknown) => formatMessage('info', module, message, data),
    warn: (message: string, data?: unknown) => formatMessage('warn', module, message, data),
    error: (message: string, data?: unknown) => formatMessage('error', module, message, data),
  };
}

export const logger = createLogger('admin');
