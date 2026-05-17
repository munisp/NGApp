/**
 * context.ts — tRPC request context
 *
 * Authenticates the request using the Keycloak session cookie (kc_session).
 * The cookie contains a server-signed HS256 JWT. We verify it locally, then
 * resolve the user record from the database by keycloakSub.
 *
 * Public procedures receive user=null; protectedProcedure throws UNAUTHORIZED.
 */
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { verifySessionJwt, KC_SESSION_COOKIE } from "./keycloakAuth";
import { getUserByKeycloakSub } from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

function parseCookies(cookieHeader: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of cookieHeader.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) map.set(k.trim(), decodeURIComponent(v.join("=")));
  }
  return map;
}

/**
 * DEV-ONLY: Returns a mock admin user when the database is unavailable.
 * This allows the admin dashboard UI to render without a live DB connection.
 */
function createDevFallbackUser(session: { sub: string; name: string; email: string; role: string }): User {
  return {
    id: 1,
    keycloakSub: session.sub,
    name: session.name || "Dev Admin",
    email: session.email || "admin@54link.dev",
    role: (session.role as "admin" | "user") || "admin",
    loginMethod: "keycloak",
    lastSignedIn: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    const cookies = parseCookies(opts.req.headers.cookie ?? "");
    const sessionToken = cookies.get(KC_SESSION_COOKIE);

    if (sessionToken) {
      const session = await verifySessionJwt(sessionToken);
      if (session?.sub) {
        // Try DB lookup first — wrap in its own try-catch so DB errors
        // don't prevent the dev fallback from activating
        let dbUser: User | undefined;
        try {
          dbUser = await getUserByKeycloakSub(session.sub);
        } catch (dbErr) {
          // DB connection error (ECONNREFUSED, timeout, etc.)
          // In dev mode we'll fall through to the mock user below
          if (process.env.NODE_ENV === "development") {
            console.warn("[context] DB lookup failed, using dev fallback user");
          }
        }

        if (dbUser) {
          user = dbUser;
        } else if (process.env.NODE_ENV === "development") {
          // DEV fallback: DB unavailable or user not seeded — use session data
          user = createDevFallbackUser(session);
        }
      }
    }

    // DEV PREVIEW MODE: When no session cookie exists in development,
    // create a mock admin user so dashboard pages can be previewed
    if (!user && process.env.NODE_ENV === "development") {
      user = createDevFallbackUser({
        sub: "dev-preview-user",
        name: "Dev Admin",
        email: "admin@54link.dev",
        role: "admin",
      });
    }
  } catch {
    // JWT verification failed or other auth error — public procedures get user=null
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
