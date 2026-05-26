import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const isSecure = isSecureRequest(req);
  const hostname = req.hostname;
  
  // Determine if we should set a domain (for cross-subdomain cookies)
  const shouldSetDomain =
    hostname &&
    !LOCAL_HOSTS.has(hostname) &&
    !isIpAddress(hostname) &&
    hostname !== "127.0.0.1" &&
    hostname !== "::1";

  const domain = shouldSetDomain && !hostname.startsWith(".")
    ? `.${hostname}`
    : shouldSetDomain
      ? hostname
      : undefined;

  // For secure connections (HTTPS), use SameSite=None with Secure=true
  // For non-secure connections (HTTP), use SameSite=Lax with Secure=false
  // This prevents cookies from being dropped by modern browsers over HTTP
  if (isSecure) {
    return {
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
      ...(domain && { domain }),
    };
  } else {
    // Non-secure (HTTP) - use Lax to allow same-site requests
    return {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: false,
      ...(domain && { domain }),
    };
  }
}
