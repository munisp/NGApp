import type { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skipPaths?: string[];
  message?: string;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

function getStore(name: string): Map<string, RateLimitEntry> {
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }
  return stores.get(name)!;
}

function cleanupStore(store: Map<string, RateLimitEntry>) {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function createRateLimiter(name: string, config: RateLimiterConfig) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (req: Request) => req.ip || req.socket.remoteAddress || 'unknown',
    skipPaths = ['/api/health'],
    message = 'Too many requests, please try again later.',
  } = config;

  const store = getStore(name);

  setInterval(() => cleanupStore(store), windowMs);

  return (req: Request, res: Response, next: NextFunction) => {
    if (skipPaths.some((p) => req.path.startsWith(p))) {
      return next();
    }

    const key = keyGenerator(req);
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      res.set('X-RateLimit-Limit', String(maxRequests));
      res.set('X-RateLimit-Remaining', String(maxRequests - 1));
      res.set('X-RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)));
      return next();
    }

    entry.count += 1;

    res.set('X-RateLimit-Limit', String(maxRequests));
    res.set('X-RateLimit-Remaining', String(Math.max(0, maxRequests - entry.count)));
    res.set('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > maxRequests) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: message, retryAfter: Math.ceil((entry.resetAt - now) / 1000) });
    }

    return next();
  };
}

export const globalRateLimiter = createRateLimiter('global', {
  windowMs: 60_000,
  maxRequests: 100,
});

export const authRateLimiter = createRateLimiter('auth', {
  windowMs: 900_000,
  maxRequests: 15,
  keyGenerator: (req) => `auth:${req.ip || 'unknown'}`,
  message: 'Too many authentication attempts. Please wait 15 minutes.',
});

export const paymentRateLimiter = createRateLimiter('payment', {
  windowMs: 60_000,
  maxRequests: 10,
  keyGenerator: (req) => `pay:${req.ip || 'unknown'}`,
  message: 'Too many payment requests. Please try again in a minute.',
});

export const uploadRateLimiter = createRateLimiter('upload', {
  windowMs: 300_000,
  maxRequests: 5,
  keyGenerator: (req) => `upload:${req.ip || 'unknown'}`,
  message: 'Too many upload attempts. Please wait before trying again.',
});
