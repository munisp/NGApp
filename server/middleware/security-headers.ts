import type { Request, Response, NextFunction } from 'express';

const SELF = "'self'";
const NONE = "'none'";
const UNSAFE_INLINE = "'unsafe-inline'";

const CSP_DIRECTIVES: Record<string, string[]> = {
  'default-src': [SELF],
  'script-src': [SELF, UNSAFE_INLINE, 'https://cdn.jsdelivr.net'],
  'style-src': [SELF, UNSAFE_INLINE, 'https://fonts.googleapis.com'],
  'font-src': [SELF, 'https://fonts.gstatic.com'],
  'img-src': [SELF, 'data:', 'https:'],
  'connect-src': [SELF, 'https:', 'wss:'],
  'media-src': [SELF],
  'object-src': [NONE],
  'frame-src': [SELF],
  'frame-ancestors': [SELF],
  'form-action': [SELF],
  'base-uri': [SELF],
  'upgrade-insecure-requests': [],
};

function buildCspString(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([directive, values]) =>
      values.length > 0 ? `${directive} ${values.join(' ')}` : directive
    )
    .join('; ');
}

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Content Security Policy
  res.setHeader('Content-Security-Policy', buildCspString());

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Clickjacking protection
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // XSS protection (legacy browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self), payment=(self)'
  );

  // Strict Transport Security (1 year, include subdomains, preload)
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );

  // Prevent caching of sensitive API responses
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
  }

  next();
}
