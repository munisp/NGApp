/**
 * 54Link POS Shell — API Versioning Middleware
 * 
 * Supports header-based versioning via X-API-Version header.
 * Default version: v1 (current)
 * 
 * Strategy:
 * - v1: Current stable API (tRPC procedures as-is)
 * - v2: Future breaking changes (field renames, removed endpoints)
 * - Deprecation headers warn clients 90 days before removal
 */
import type { Request, Response, NextFunction } from "express";

export const CURRENT_API_VERSION = "v1";
export const SUPPORTED_VERSIONS = ["v1"] as const;
export const DEPRECATED_VERSIONS: string[] = [];
export type ApiVersion = (typeof SUPPORTED_VERSIONS)[number];

export function apiVersioningMiddleware(req: Request, res: Response, next: NextFunction) {
  // Extract version from header or query param
  const requestedVersion = (req.headers["x-api-version"] as string) || 
                           (req.query["api_version"] as string) || 
                           CURRENT_API_VERSION;
  
  // Set version headers in response
  res.setHeader("X-API-Version", requestedVersion);
  res.setHeader("X-API-Current-Version", CURRENT_API_VERSION);
  
  if (DEPRECATED_VERSIONS.includes(requestedVersion)) {
    res.setHeader("X-API-Deprecated", "true");
    res.setHeader("Sunset", new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString());
    console.warn(`[API] Deprecated version ${requestedVersion} used by ${req.ip}`);
  }
  
  if (!(SUPPORTED_VERSIONS as readonly string[]).includes(requestedVersion) && !DEPRECATED_VERSIONS.includes(requestedVersion)) {
    return res.status(400).json({
      error: "Unsupported API version",
      requestedVersion,
      supportedVersions: SUPPORTED_VERSIONS,
      currentVersion: CURRENT_API_VERSION,
    });
  }
  
  (req as any).apiVersion = requestedVersion as ApiVersion;
  next();
}
