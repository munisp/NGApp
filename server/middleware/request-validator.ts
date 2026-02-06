import type { Request, Response, NextFunction } from 'express';

const BLOCKED_PATTERNS = [
  /(<script[^>]*>)/i,
  /(javascript:)/i,
  /(on\w+\s*=)/i,
  /(union\s+select)/i,
  /(;\s*drop\s+table)/i,
  /(;\s*delete\s+from)/i,
  /(\bexec\s*\()/i,
  /(\/etc\/passwd)/i,
  /(\.\.\/(\.\.\/)*)/,
];

const MAX_BODY_DEPTH = 10;
const MAX_STRING_LENGTH = 50000;
const MAX_ARRAY_LENGTH = 1000;

function checkDepth(obj: unknown, depth: number): boolean {
  if (depth > MAX_BODY_DEPTH) return false;
  if (obj === null || obj === undefined) return true;
  if (typeof obj !== 'object') return true;
  if (Array.isArray(obj)) {
    if (obj.length > MAX_ARRAY_LENGTH) return false;
    return obj.every((item) => checkDepth(item, depth + 1));
  }
  return Object.values(obj).every((val) => checkDepth(val, depth + 1));
}

function containsMaliciousContent(value: string): boolean {
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(value));
}

function sanitizeValue(value: unknown): boolean {
  if (typeof value === 'string') {
    if (value.length > MAX_STRING_LENGTH) return false;
    if (containsMaliciousContent(value)) return false;
  }
  if (typeof value === 'object' && value !== null) {
    for (const val of Object.values(value)) {
      if (!sanitizeValue(val)) return false;
    }
  }
  return true;
}

export function requestValidator() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.body && typeof req.body === 'object') {
      if (!checkDepth(req.body, 0)) {
        return res.status(400).json({
          error: 'Request body too deeply nested',
          code: 'VALIDATION_DEPTH',
        });
      }

      if (!sanitizeValue(req.body)) {
        return res.status(400).json({
          error: 'Request contains invalid content',
          code: 'VALIDATION_CONTENT',
        });
      }
    }

    if (req.query) {
      for (const [, value] of Object.entries(req.query)) {
        if (typeof value === 'string' && containsMaliciousContent(value)) {
          return res.status(400).json({
            error: 'Invalid query parameter',
            code: 'VALIDATION_QUERY',
          });
        }
      }
    }

    next();
  };
}
