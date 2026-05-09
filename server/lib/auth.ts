/**
 * JWT Authentication Middleware + Keycloak OIDC Integration
 * Provides: token validation, role extraction, tenant context, and API key support.
 */

import type { Request, Response, NextFunction } from "express";
import * as jose from "jose";
import { logger } from "./logger";

// --- Configuration ---

export interface AuthConfig {
  keycloakUrl: string;
  keycloakRealm: string;
  keycloakClientId: string;
  keycloakClientSecret: string;
  jwtIssuer: string;
  jwtAudience: string;
  jwksUri: string;
  apiKeyHeader: string;
  enableAuth: boolean;
}

const defaultConfig: AuthConfig = {
  keycloakUrl: process.env.KEYCLOAK_URL || "http://localhost:8080",
  keycloakRealm: process.env.KEYCLOAK_REALM || "54bank",
  keycloakClientId: process.env.KEYCLOAK_CLIENT_ID || "54bank-platform",
  keycloakClientSecret: process.env.KEYCLOAK_CLIENT_SECRET || "",
  jwtIssuer: process.env.JWT_ISSUER || "",
  jwtAudience: process.env.JWT_AUDIENCE || "54bank-platform",
  jwksUri: process.env.JWKS_URI || "",
  apiKeyHeader: "x-api-key",
  enableAuth: process.env.ENABLE_AUTH === "true",
};

// --- Types ---

export interface AuthUser {
  sub: string;
  email?: string;
  name?: string;
  roles: string[];
  tenantId?: string;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      tenantId?: string;
      apiKeyId?: string;
    }
  }
}

// --- JWKS Key Store ---

let jwksKeySet: jose.JSONWebKeySet | null = null;
let jwksLastFetch = 0;
const JWKS_CACHE_TTL = 300_000; // 5 minutes

async function getJWKS(config: AuthConfig): Promise<jose.JSONWebKeySet> {
  const now = Date.now();
  if (jwksKeySet && now - jwksLastFetch < JWKS_CACHE_TTL) {
    return jwksKeySet;
  }

  const jwksUrl = config.jwksUri ||
    `${config.keycloakUrl}/realms/${config.keycloakRealm}/protocol/openid-connect/certs`;

  try {
    const res = await fetch(jwksUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
    jwksKeySet = (await res.json()) as jose.JSONWebKeySet;
    jwksLastFetch = now;
    return jwksKeySet;
  } catch (err) {
    if (jwksKeySet) {
      logger.warn("JWKS refresh failed, using cached keys");
      return jwksKeySet;
    }
    throw err;
  }
}

// --- Token Validation ---

async function validateToken(token: string, config: AuthConfig): Promise<AuthUser> {
  const jwks = await getJWKS(config);
  const keyStore = jose.createLocalJWKSet(jwks);

  const { payload } = await jose.jwtVerify(token, keyStore, {
    issuer: config.jwtIssuer || `${config.keycloakUrl}/realms/${config.keycloakRealm}`,
    audience: config.jwtAudience,
  });

  const realmRoles = ((payload as Record<string, unknown>).realm_access as { roles?: string[] })?.roles ?? [];
  const resourceRoles = ((payload as Record<string, unknown>).resource_access as Record<string, { roles?: string[] }>)?.[config.keycloakClientId]?.roles ?? [];
  const allRoles = Array.from(new Set([...realmRoles, ...resourceRoles]));

  const permissions: string[] = [];
  if (allRoles.includes("admin")) permissions.push("*");
  if (allRoles.includes("teller")) permissions.push("teller:*", "customers:read");
  if (allRoles.includes("compliance")) permissions.push("compliance:*", "reports:*");
  if (allRoles.includes("operations")) permissions.push("operations:read", "monitoring:read");

  return {
    sub: payload.sub ?? "unknown",
    email: (payload as Record<string, unknown>).email as string | undefined,
    name: (payload as Record<string, unknown>).preferred_username as string | undefined,
    roles: allRoles,
    tenantId: (payload as Record<string, unknown>).tenant_id as string | undefined,
    permissions,
  };
}

// --- API Key Store (in-memory, replace with DB in production) ---

const apiKeys = new Map<string, { id: string; tenantId: string; roles: string[]; rateLimit: number }>([
  ["dev-api-key-54bank", { id: "key-dev-001", tenantId: "default", roles: ["admin"], rateLimit: 1000 }],
]);

function validateApiKey(key: string): AuthUser | null {
  const entry = apiKeys.get(key);
  if (!entry) return null;
  return {
    sub: `apikey:${entry.id}`,
    roles: entry.roles,
    tenantId: entry.tenantId,
    permissions: entry.roles.includes("admin") ? ["*"] : [],
  };
}

// --- Middleware ---

export function authMiddleware(config: AuthConfig = defaultConfig) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!config.enableAuth) {
      req.user = { sub: "anonymous", roles: ["admin"], tenantId: "default", permissions: ["*"] };
      req.tenantId = "default";
      next();
      return;
    }

    // Check API key first
    const apiKey = req.headers[config.apiKeyHeader] as string | undefined;
    if (apiKey) {
      const user = validateApiKey(apiKey);
      if (user) {
        req.user = user;
        req.tenantId = user.tenantId;
        req.apiKeyId = `apikey:${apiKey.slice(0, 8)}...`;
        next();
        return;
      }
      res.status(401).json({ error: "Invalid API key" });
      return;
    }

    // Check Bearer token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing authorization header. Provide Bearer token or API key." });
      return;
    }

    const token = authHeader.slice(7);
    try {
      const user = await validateToken(token, config);
      req.user = user;
      req.tenantId = user.tenantId ?? "default";
      next();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Token validation failed";
      logger.warn(`Auth failed: ${message}`);
      res.status(401).json({ error: "Invalid or expired token" });
    }
  };
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (req.user.roles.includes("admin")) {
      next();
      return;
    }
    const hasRole = roles.some((r) => req.user!.roles.includes(r));
    if (!hasRole) {
      res.status(403).json({ error: `Requires one of roles: ${roles.join(", ")}` });
      return;
    }
    next();
  };
}

export function requirePermission(...perms: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (req.user.permissions.includes("*")) {
      next();
      return;
    }
    const hasPerm = perms.some((p) => req.user!.permissions.includes(p));
    if (!hasPerm) {
      res.status(403).json({ error: `Requires permission: ${perms.join(" or ")}` });
      return;
    }
    next();
  };
}
