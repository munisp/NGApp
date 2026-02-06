import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const CSRF_HEADER = 'x-csrf-token';
const CSRF_COOKIE = '_csrf';
const TOKEN_LENGTH = 32;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function generateToken(): string {
  return crypto.randomBytes(TOKEN_LENGTH).toString('hex');
}

export function csrfProtection() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(req.method)) {
      let token = req.cookies?.[CSRF_COOKIE];
      if (!token) {
        token = generateToken();
        res.cookie(CSRF_COOKIE, token, {
          httpOnly: false,
          sameSite: 'strict',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 86400000,
        });
      }
      res.locals.csrfToken = token;
      return next();
    }

    const cookieToken = req.cookies?.[CSRF_COOKIE];
    const headerToken = req.headers[CSRF_HEADER] as string | undefined;

    if (!cookieToken || !headerToken) {
      return res.status(403).json({
        error: 'CSRF validation failed: missing token',
        code: 'CSRF_MISSING',
      });
    }

    if (!crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
      return res.status(403).json({
        error: 'CSRF validation failed: token mismatch',
        code: 'CSRF_MISMATCH',
      });
    }

    return next();
  };
}

export function csrfTokenEndpoint() {
  return (_req: Request, res: Response) => {
    const token = generateToken();
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 86400000,
    });
    res.json({ token });
  };
}
