export const API_VERSION = "v1";
export const SUPPORTED_VERSIONS = ["v1", "v2"];
export function apiVersioningMiddleware() {
  return (req: any, res: any, next: any) => {
    const version = req.headers["x-api-version"] || API_VERSION;
    req.apiVersion = version;
    next();
  };
}
