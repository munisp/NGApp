import { describe, it, expect, vi } from 'vitest';
import { securityHeaders } from './security-headers';
import type { Request, Response, NextFunction } from 'express';

function createMocks(path = '/') {
  const req = { path } as Request;
  const headers: Record<string, string> = {};
  const res = {
    setHeader: vi.fn((key: string, value: string) => { headers[key] = value; }),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next, headers };
}

describe('securityHeaders middleware', () => {
  it('sets Content-Security-Policy header', () => {
    const { req, res, next, headers } = createMocks();
    securityHeaders(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Security-Policy', expect.stringContaining("default-src 'self'"));
    expect(next).toHaveBeenCalled();
  });

  it('sets X-Content-Type-Options to nosniff', () => {
    const { req, res, next } = createMocks();
    securityHeaders(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
  });

  it('sets X-Frame-Options to SAMEORIGIN', () => {
    const { req, res, next } = createMocks();
    securityHeaders(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'SAMEORIGIN');
  });

  it('sets HSTS header', () => {
    const { req, res, next } = createMocks();
    securityHeaders(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  });

  it('sets Referrer-Policy', () => {
    const { req, res, next } = createMocks();
    securityHeaders(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
  });

  it('sets Permissions-Policy', () => {
    const { req, res, next } = createMocks();
    securityHeaders(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('Permissions-Policy', expect.stringContaining('camera=()'));
  });

  it('blocks object-src', () => {
    const { req, res, next } = createMocks();
    securityHeaders(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.stringContaining("object-src 'none'")
    );
  });

  it('sets no-cache for API routes', () => {
    const { req, res, next } = createMocks('/api/trpc/users');
    securityHeaders(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    expect(res.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
  });

  it('does not set no-cache for non-API routes', () => {
    const { req, res, next } = createMocks('/dashboard');
    securityHeaders(req, res, next);
    const calls = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls;
    const cacheCall = calls.find((c: string[]) => c[0] === 'Cache-Control');
    expect(cacheCall).toBeUndefined();
  });

  it('always calls next()', () => {
    const { req, res, next } = createMocks();
    securityHeaders(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
