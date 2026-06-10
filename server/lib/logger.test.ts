import { describe, it, expect } from 'vitest';
import { logger, createChildLogger } from './logger';

describe('logger', () => {
  it('creates a pino logger instance', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.fatal).toBe('function');
  });

  it('creates child loggers with module name', () => {
    const child = createChildLogger('test-module');
    expect(child).toBeDefined();
    expect(typeof child.info).toBe('function');
  });

  it('child logger inherits parent level', () => {
    const child = createChildLogger('test');
    expect(child.level).toBe(logger.level);
  });
});
