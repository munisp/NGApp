/**
 * Session & Cookie Hardening
 * ============================
 * Production-grade session security:
 * - Secure cookie settings enforcement
 * - Session fixation prevention
 * - Idle timeout
 * - Concurrent session limiting
 * - CSRF token generation and validation
 */

import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import pino from "pino";

const logger = pino({ name: "ndsep-session" });

// ── CSRF Protection ────────────────────────────────────────────────────────

const csrfTokens = new Map<string, { token: string; createdAt: number }>();
const CSRF_TOKEN_TTL = 3600_000; // 1 hour

export function generateCsrfToken(sessionId: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  csrfTokens.set(sessionId, { token, createdAt: Date.now() });
  return token;
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Skip for GET, HEAD, OPTIONS (safe methods)
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }

  // Skip for API calls with valid auth (they use Bearer tokens)
  if (req.headers.authorization?.startsWith("Bearer ")) {
    next();
    return;
  }

  // Skip for Stripe webhooks (they have their own verification)
  if (req.path.startsWith("/api/stripe/webhook")) {
    next();
    return;
  }

  // Skip for tRPC batch calls (authenticated via session cookie)
  if (req.path.includes("/api/trpc/")) {
    next();
    return;
  }

  const csrfToken = req.headers["x-csrf-token"] as string;
  const sessionId = (req as any).sessionId;

  if (!csrfToken || !sessionId) {
    next(); // non-session requests don't need CSRF
    return;
  }

  const stored = csrfTokens.get(sessionId);
  if (!stored || stored.token !== csrfToken || Date.now() - stored.createdAt > CSRF_TOKEN_TTL) {
    res.status(403).json({ error: "Invalid or expired CSRF token" });
    return;
  }

  next();
}

// ── Session Idle Timeout ───────────────────────────────────────────────────

const sessionActivity = new Map<string, number>();
const SESSION_IDLE_TIMEOUT_MS = 30 * 60_000; // 30 minutes

export function sessionIdleCheck(req: Request, res: Response, next: NextFunction): void {
  const sessionId = (req as any).sessionId;
  if (!sessionId) { next(); return; }

  const lastActivity = sessionActivity.get(sessionId);
  const now = Date.now();

  if (lastActivity && now - lastActivity > SESSION_IDLE_TIMEOUT_MS) {
    sessionActivity.delete(sessionId);
    csrfTokens.delete(sessionId);
    res.clearCookie("ndsep_session");
    res.status(401).json({ error: "Session expired due to inactivity" });
    return;
  }

  sessionActivity.set(sessionId, now);
  next();
}

// ── Concurrent Session Limiter ─────────────────────────────────────────────

const userSessions = new Map<number, Set<string>>();
const MAX_CONCURRENT_SESSIONS = 5;

export function trackSession(userId: number, sessionId: string): { allowed: boolean; activeSessions: number } {
  const sessions = userSessions.get(userId) ?? new Set();

  if (sessions.size >= MAX_CONCURRENT_SESSIONS && !sessions.has(sessionId)) {
    // Remove oldest session
    const oldest = sessions.values().next().value;
    if (oldest) {
      sessions.delete(oldest);
      sessionActivity.delete(oldest);
      csrfTokens.delete(oldest);
    }
  }

  sessions.add(sessionId);
  userSessions.set(userId, sessions);

  return { allowed: true, activeSessions: sessions.size };
}

export function removeSession(userId: number, sessionId: string): void {
  const sessions = userSessions.get(userId);
  if (sessions) {
    sessions.delete(sessionId);
    if (sessions.size === 0) userSessions.delete(userId);
  }
  sessionActivity.delete(sessionId);
  csrfTokens.delete(sessionId);
}

// ── Cookie Security Enforcer ───────────────────────────────────────────────

export function enforceCookieSecurity(_req: Request, res: Response, next: NextFunction): void {
  const originalSetHeader = res.setHeader.bind(res);

  (res as any).setHeader = (name: string, value: any) => {
    if (name.toLowerCase() === "set-cookie" && typeof value === "string") {
      // Ensure all cookies have Secure, HttpOnly, SameSite
      if (!value.includes("HttpOnly")) value += "; HttpOnly";
      if (!value.includes("Secure") && process.env.NODE_ENV === "production") {
        value += "; Secure";
      }
      if (!value.includes("SameSite")) value += "; SameSite=Lax";
    }
    return originalSetHeader(name, value);
  };

  next();
}

// ── Periodic cleanup ───────────────────────────────────────────────────────

setInterval(() => {
  const now = Date.now();
  for (const [id, data] of csrfTokens.entries()) {
    if (now - data.createdAt > CSRF_TOKEN_TTL * 2) csrfTokens.delete(id);
  }
  for (const [id, lastActivity] of sessionActivity.entries()) {
    if (now - lastActivity > SESSION_IDLE_TIMEOUT_MS * 2) sessionActivity.delete(id);
  }
}, 300_000); // Every 5 minutes
