/**
 * API versioning middleware for OG-RMM.
 *
 * Implements formal API version negotiation via:
 *   - Accept header: "Accept: application/vnd.og-rmm.v2+json"
 *   - Query parameter: "?api-version=2"
 *   - X-API-Version header: "X-API-Version: 2"
 *
 * Current supported versions:
 *   v1 — original API (deprecated, supported until 2027-01-01)
 *   v2 — current stable API (default)
 *   v3 — preview API (opt-in only)
 *
 * The version is injected into the tRPC context as ctx.apiVersion.
 * Procedures can use this to return version-specific responses.
 */

import type { Request, Response, NextFunction } from 'express';

export type ApiVersion = 'v1' | 'v2' | 'v3';

const SUPPORTED_VERSIONS: ApiVersion[] = ['v1', 'v2', 'v3'];
const DEFAULT_VERSION: ApiVersion = 'v2';
const DEPRECATED_VERSIONS: ApiVersion[] = ['v1'];
const DEPRECATED_SUNSET_DATES: Record<string, string> = {
  v1: '2027-01-01',
};

/**
 * Extracts the requested API version from the incoming request.
 * Priority: X-API-Version header > Accept header > api-version query param > default
 */
export function extractApiVersion(req: Request): ApiVersion {
  // 1. X-API-Version header (highest priority)
  const headerVersion = req.headers['x-api-version'];
  if (headerVersion && typeof headerVersion === 'string') {
    const normalized = normalizeVersion(headerVersion);
    if (SUPPORTED_VERSIONS.includes(normalized as ApiVersion)) {
      return normalized as ApiVersion;
    }
  }

  // 2. Accept header: "application/vnd.og-rmm.v2+json"
  const acceptHeader = req.headers['accept'];
  if (acceptHeader) {
    const match = acceptHeader.match(/application\/vnd\.og-rmm\.(v\d+)\+json/);
    if (match) {
      const normalized = normalizeVersion(match[1]);
      if (SUPPORTED_VERSIONS.includes(normalized as ApiVersion)) {
        return normalized as ApiVersion;
      }
    }
  }

  // 3. Query parameter: ?api-version=2
  const queryVersion = req.query['api-version'];
  if (queryVersion && typeof queryVersion === 'string') {
    const normalized = normalizeVersion(queryVersion);
    if (SUPPORTED_VERSIONS.includes(normalized as ApiVersion)) {
      return normalized as ApiVersion;
    }
  }

  return DEFAULT_VERSION;
}

/**
 * Express middleware that:
 * 1. Extracts the requested API version
 * 2. Validates it against supported versions
 * 3. Adds deprecation warnings for deprecated versions
 * 4. Injects the version into req.apiVersion
 */
export function apiVersionMiddleware(req: Request, res: Response, next: NextFunction): void {
  const version = extractApiVersion(req);

  // Validate version
  if (!SUPPORTED_VERSIONS.includes(version)) {
    res.status(400).json({
      error: 'Unsupported API version',
      message: `Version "${version}" is not supported. Supported versions: ${SUPPORTED_VERSIONS.join(', ')}`,
      supportedVersions: SUPPORTED_VERSIONS,
      defaultVersion: DEFAULT_VERSION,
    });
    return;
  }

  // Add deprecation warning headers for deprecated versions
  if (DEPRECATED_VERSIONS.includes(version)) {
    const sunsetDate = DEPRECATED_SUNSET_DATES[version];
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', sunsetDate);
    res.setHeader(
      'Link',
      `<https://docs.og-rmm.io/api/migration/${version}-to-v2>; rel="deprecation"`,
    );
    res.setHeader(
      'Warning',
      `299 - "API version ${version} is deprecated and will be removed on ${sunsetDate}. Please migrate to v2."`,
    );
  }

  // Inject version into request for downstream use
  (req as Request & { apiVersion: ApiVersion }).apiVersion = version;

  // Add version to response headers for client awareness
  res.setHeader('X-API-Version', version);
  res.setHeader('X-API-Supported-Versions', SUPPORTED_VERSIONS.join(', '));

  next();
}

/**
 * Normalizes a version string to the "vN" format.
 * Accepts: "1", "v1", "V1", "1.0", "v1.0"
 */
function normalizeVersion(input: string): string {
  const cleaned = input.toLowerCase().replace(/^v/, '').split('.')[0];
  return `v${cleaned}`;
}

/**
 * Returns the API version info endpoint response.
 * Mount at GET /api/version
 */
export function getVersionInfo() {
  return {
    currentVersion: DEFAULT_VERSION,
    supportedVersions: SUPPORTED_VERSIONS,
    deprecatedVersions: DEPRECATED_VERSIONS,
    sunsetDates: DEPRECATED_SUNSET_DATES,
    documentation: 'https://docs.og-rmm.io/api',
    changelog: 'https://docs.og-rmm.io/api/changelog',
  };
}
