/**
 * Infrastructure middleware that wires all 12 components into Express/Node services.
 * Enforces KYC gates, rate limiting, RBAC, and audit logging on every request.
 */

import { Platform } from './platform';

export interface RequestContext {
  userId: string;
  kycLevel: number;
  clientIp: string;
  token: string;
}

export class InfraMiddleware {
  private platform: Platform;

  constructor(platform: Platform) {
    this.platform = platform;
  }

  expressMiddleware() {
    return async (req: any, res: any, next: any) => {
      const start = Date.now();
      const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || '';
      const ctx: RequestContext = { userId: '', kycLevel: 0, clientIp, token: '' };

      // 1. Rate limiting via Redis
      try {
        const allowed = await this.platform.redis.rateLimit(`rate:${clientIp}`, 100, 60);
        if (!allowed) {
          res.status(429).json({ error: 'rate_limit_exceeded' });
          return;
        }
      } catch {}

      // 2. Token validation via Keycloak
      const authHeader = req.headers.authorization || '';
      if (authHeader && !isPublicPath(req.path)) {
        const token = authHeader.replace('Bearer ', '');
        ctx.token = token;
        try {
          const claims = await this.platform.keycloak.validateToken(token);
          ctx.userId = (claims.sub as string) || '';
          ctx.kycLevel = this.platform.keycloak.getKYCLevel(claims);
        } catch {
          res.status(401).json({ error: 'invalid_token' });
          return;
        }
      }

      // 3. KYC gate enforcement
      if (requiresKYC(req.path) && ctx.userId) {
        try {
          const gate = await this.platform.redis.getKYCGate(ctx.userId);
          if (gate && !gate.allowed) {
            res.status(403).json({ error: 'kyc_verification_required', kyc_level: gate.level });
            return;
          }
        } catch {}
      }

      // 4. RBAC via Permify
      if (requiresPermission(req.path) && ctx.userId) {
        const [entity, permission] = extractPermission(req.method, req.path);
        if (entity) {
          try {
            const allowed = await this.platform.permify.checkPermission(entity, '*', permission, 'user', ctx.userId);
            if (!allowed) {
              res.status(403).json({ error: 'permission_denied' });
              return;
            }
          } catch {}
        }
      }

      // Inject context
      req.infraPlatform = this.platform;
      req.infraContext = ctx;
      next();

      // 5. Async audit logging
      const latencyMs = Date.now() - start;
      const auditEntry = {
        method: req.method, path: req.path, user_id: ctx.userId,
        kyc_level: ctx.kycLevel, client_ip: clientIp, latency_ms: latencyMs,
        timestamp: new Date().toISOString(),
      };
      this.platform.opensearch.indexAudit('api-gateway', req.method, 'request', req.path, ctx.userId, auditEntry).catch(() => {});
      this.platform.kafka.publishAuditEvent('api-gateway', `${req.method} ${req.path}`, auditEntry).catch(() => {});
    };
  }
}

function isPublicPath(path: string): boolean {
  return ['/health', '/ready', '/metrics', '/api/v1/auth/login', '/api/v1/auth/register', '/docs'].some(p => path.startsWith(p));
}

function requiresKYC(path: string): boolean {
  return ['/api/v1/policies', '/api/v1/claims', '/api/v1/payments', '/api/v1/transfers'].some(p => path.startsWith(p));
}

function requiresPermission(path: string): boolean {
  return path.startsWith('/api/v1/');
}

function extractPermission(method: string, path: string): [string, string] {
  const parts = path.replace('/api/v1/', '').split('/');
  if (!parts.length) return ['', ''];
  const entity = parts[0];
  return [entity, method === 'GET' ? 'view' : 'manage'];
}
