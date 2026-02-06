import type { Request, Response, NextFunction } from 'express';

interface SecurityHeadersConfig {
  enableHSTS: boolean;
  hstsMaxAge: number;
  contentSecurityPolicy: string;
  permissionsPolicy: string;
}

const defaultConfig: SecurityHeadersConfig = {
  enableHSTS: process.env.NODE_ENV === 'production',
  hstsMaxAge: 31536000,
  contentSecurityPolicy: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join('; '),
  permissionsPolicy: [
    'camera=(self)',
    'microphone=(self)',
    'geolocation=(self)',
    'payment=(self)',
    'fullscreen=(self)',
  ].join(', '),
};

export function securityHeaders(config: Partial<SecurityHeadersConfig> = {}) {
  const cfg = { ...defaultConfig, ...config };

  return (_req: Request, res: Response, next: NextFunction) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('X-XSS-Protection', '1; mode=block');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.set('X-DNS-Prefetch-Control', 'off');
    res.set('X-Download-Options', 'noopen');
    res.set('X-Permitted-Cross-Domain-Policies', 'none');
    res.set('Content-Security-Policy', cfg.contentSecurityPolicy);
    res.set('Permissions-Policy', cfg.permissionsPolicy);

    if (cfg.enableHSTS) {
      res.set(
        'Strict-Transport-Security',
        `max-age=${cfg.hstsMaxAge}; includeSubDomains; preload`
      );
    }

    res.removeHeader('X-Powered-By');

    next();
  };
}
