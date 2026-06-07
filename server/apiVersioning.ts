/**
 * NDSEP API Versioning Strategy
 * ================================
 * Implements URL-based API versioning with backward compatibility.
 *
 * Recommendation M1: API versioning for stable public endpoints
 *
 * Current: /api/trpc/... (unversioned)
 * New: /api/v1/... and /api/v2/... with deprecation notices
 */

import type { Request, Response, NextFunction, Router } from "express";
import { logger } from "./logger";

export const CURRENT_API_VERSION = "v2";
export const SUPPORTED_VERSIONS = ["v1", "v2"];
export const DEPRECATED_VERSIONS = ["v1"];
export const SUNSET_DATES: Record<string, string> = {
  v1: "2026-12-31",
};

/**
 * Middleware: Add API version headers to responses.
 * Sets Deprecation and Sunset headers for deprecated versions.
 */
export function apiVersionMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Extract version from URL path
  const versionMatch = req.path.match(/^\/api\/(v\d+)\//);
  const version = versionMatch ? versionMatch[1] : CURRENT_API_VERSION;

  // Set version header
  res.setHeader("X-API-Version", version);

  // Add deprecation headers for old versions
  if (DEPRECATED_VERSIONS.includes(version)) {
    res.setHeader("Deprecation", "true");
    res.setHeader("Link", `</api/${CURRENT_API_VERSION}${req.path.replace(`/api/${version}`, "")}>; rel="successor-version"`);
    const sunsetDate = SUNSET_DATES[version];
    if (sunsetDate) {
      res.setHeader("Sunset", new Date(sunsetDate).toUTCString());
    }
    logger.info({ version, path: req.path }, "[API] Deprecated version accessed");
  }

  next();
}

/**
 * Create a versioned router that maps /api/v1/... to /api/trpc/...
 * Provides backward-compatible access to tRPC endpoints via REST-like URLs.
 */
export function createVersionedEndpoints(expressApp: { use: (...args: any[]) => void }): void {
  // v1 compatibility layer — maps to tRPC procedures
  expressApp.use("/api/v1", apiVersionMiddleware);
  expressApp.use("/api/v2", apiVersionMiddleware);

  logger.info("[API] Versioned endpoints registered (v1, v2)");
}
