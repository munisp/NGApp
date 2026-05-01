/**
 * NDSEP Authentication Middleware for Express routes
 * Used to protect PDF download endpoints and other non-tRPC routes.
 */
import type { Request, Response, NextFunction } from "express";
import { parse as parseCookieHeader } from "cookie";
import { sdk } from "./_core/sdk";
import { COOKIE_NAME } from "@shared/const";
import { logger } from "./logger";
import { getUserByOpenId } from "./db";

function extractToken(req: Request): string | undefined {
  if (req.cookies?.[COOKIE_NAME]) return req.cookies[COOKIE_NAME] as string;
  const header = req.headers.cookie;
  if (!header) return undefined;
  const parsed = parseCookieHeader(header);
  return parsed[COOKIE_NAME] || undefined;
}

/**
 * requireSession: validates the session cookie and attaches user to req.
 * Returns 401 if no valid session exists.
 */
export async function requireSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const session = await sdk.verifySession(token);
    if (!session) {
      res.status(401).json({ error: "Invalid or expired session" });
      return;
    }
    const user = await getUserByOpenId(session.openId);
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    (req as any).sessionUser = user;
    next();
  } catch (err) {
    logger.warn({ err }, "[requireSession] Session validation failed");
    res.status(401).json({ error: "Authentication required" });
  }
}

/**
 * requireAdmin: validates session AND checks that user has admin role.
 * Returns 403 if user is not an admin.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireSession(req, res, async () => {
    const user = (req as any).sessionUser;
    if (!user || user.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  });
}
