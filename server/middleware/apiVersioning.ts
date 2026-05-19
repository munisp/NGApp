/**
 * API Versioning Middleware
 * Handles X-API-Version header for backward compatibility
 */

export const CURRENT_API_VERSION = "v2";
export const SUPPORTED_VERSIONS = ["v1", "v2"];
export const DEPRECATED_VERSIONS = ["v1"];

export function apiVersioningMiddleware() {
  return (req: any, res: any, next: any) => {
    const version = (req.headers["x-api-version"] as string) || CURRENT_API_VERSION;
    if (!SUPPORTED_VERSIONS.includes(version)) {
      res.status(400).json({ error: `Unsupported API version: ${version}` });
      return;
    }
    if (DEPRECATED_VERSIONS.includes(version)) {
      res.setHeader("X-API-Version-Deprecated", "true");
      res.setHeader("X-API-Version-Sunset", "2025-12-31");
    }
    (req as any).apiVersion = version;
    res.setHeader("X-API-Version", version);
    next();
  };
}

export default apiVersioningMiddleware;
