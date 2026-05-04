/**
 * API Versioning Middleware
 * =========================
 * Supports version negotiation via:
 *   1. URL prefix: /api/v1/...
 *   2. Accept header: Accept: application/vnd.ndsep.v1+json
 *   3. Custom header: X-API-Version: 1
 *
 * Default version: 1 (current)
 * Supported versions: [1]
 */
import type { Request, Response, NextFunction } from "express";

export const SUPPORTED_VERSIONS = [1] as const;
export const DEFAULT_VERSION = 1;
export const LATEST_VERSION = Math.max(...SUPPORTED_VERSIONS);

const ACCEPT_PATTERN = /application\/vnd\.ndsep\.v(\d+)\+json/;

/**
 * Extract API version from the request.
 * Priority: URL > Accept header > X-API-Version header > default
 */
export function extractVersion(req: Request): number {
  // 1. URL prefix: /api/v1/...
  const urlMatch = req.path.match(/^\/api\/v(\d+)\//);
  if (urlMatch) return parseInt(urlMatch[1], 10);

  // 2. Accept header
  const accept = req.headers.accept ?? "";
  const acceptMatch = accept.match(ACCEPT_PATTERN);
  if (acceptMatch) return parseInt(acceptMatch[1], 10);

  // 3. Custom header
  const headerVersion = req.headers["x-api-version"];
  if (typeof headerVersion === "string") {
    const v = parseInt(headerVersion, 10);
    if (!isNaN(v)) return v;
  }

  return DEFAULT_VERSION;
}

/**
 * Express middleware that validates and attaches API version.
 * Returns 400 for unsupported versions.
 */
export function apiVersionMiddleware(req: Request, res: Response, next: NextFunction): void {
  const version = extractVersion(req);

  if (!SUPPORTED_VERSIONS.includes(version as any)) {
    res.status(400).json({
      error: "Unsupported API version",
      code: "UNSUPPORTED_API_VERSION",
      requestedVersion: version,
      supportedVersions: [...SUPPORTED_VERSIONS],
      latestVersion: LATEST_VERSION,
    });
    return;
  }

  // Attach to request for downstream use
  (req as any).apiVersion = version;

  // Add version info to response headers
  res.setHeader("X-API-Version", String(version));
  res.setHeader("X-API-Latest-Version", String(LATEST_VERSION));
  res.setHeader("X-API-Supported-Versions", SUPPORTED_VERSIONS.join(","));

  next();
}

/**
 * Helper to strip version prefix from URL for routing.
 * /api/v1/trpc/... → /api/trpc/...
 */
export function stripVersionPrefix(req: Request, _res: Response, next: NextFunction): void {
  req.url = req.url.replace(/^\/api\/v\d+\//, "/api/");
  next();
}
