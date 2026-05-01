/**
 * NDSEP Authentication Middleware for Express routes
 * Used to protect PDF download endpoints and other non-tRPC routes.
 */
import type { Request, Response, NextFunction } from "express";
import { sdk } from "./_core/sdk";
import { COOKIE_NAME } from "@shared/const";
import { logger } from "./logger";

/**
 * requireSession: validates the session cookie and attaches user to req.
 * Returns 401 if no valid session exists.
 */
export async function requireSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[COOKIE_NAME] as string | undefined;
    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const user = await sdk.verifySession(token);
    if (!user) {
      res.status(401).json({ error: "Invalid or expired session" });
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
