import cors from 'cors';

const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const isDev = process.env.NODE_ENV !== 'production';

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // same-origin requests
  if (isDev && (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'))) {
    return true;
  }
  return ALLOWED_ORIGINS.includes(origin);
}

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Idempotency-Key'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'ETag'],
  maxAge: 86400, // 24 hours
});
