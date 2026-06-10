import { describe, it, expect } from 'vitest';
import { corsMiddleware } from './cors-config';

describe('corsMiddleware', () => {
  it('exports a function', () => {
    expect(typeof corsMiddleware).toBe('function');
  });

  it('cors middleware is a valid express middleware (takes 3 args)', () => {
    expect(corsMiddleware.length).toBe(3);
  });
});
