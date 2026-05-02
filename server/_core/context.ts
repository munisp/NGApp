import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { COOKIE_NAME } from "@shared/const";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  session: { openId: string; appId: string; name: string; twoFactorVerified: boolean } | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let session: { openId: string; appId: string; name: string; twoFactorVerified: boolean } | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
    // Also get session information for 2FA status
    // Use the same COOKIE_NAME constant that oauth.ts uses to set the cookie
    const cookies = opts.req.headers.cookie;
    if (cookies && typeof cookies === 'string') {
      const parsedCookies = require('cookie').parse(cookies);
      const sessionCookie = parsedCookies[COOKIE_NAME];
      if (sessionCookie) {
        session = await sdk.verifySession(sessionCookie);
      }
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    // In development (no Keycloak/DB), provide a default participant user
    // so the platform can be demonstrated with seed data.
    if (process.env.NODE_ENV !== 'production' && !user) {
      const devRole = (opts.req.headers['x-dev-role'] as string) || 'participant';
      const devUserId = devRole === 'admin' || devRole === 'cbn' ? 200 : 101;
      user = {
        id: devUserId,
        sub: `dev-${devRole}-${devUserId}`,
        name: devRole === 'admin' ? 'Platform Admin' : devRole === 'cbn' ? 'CBN Regulator' : 'PayApp Nigeria Ltd',
        email: `${devRole}@switch.dev`,
        loginMethod: 'dev',
        role: devRole as any,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
        twoFactorSecret: null,
        twoFactorEnabled: 'false' as any,
        twoFactorBackupCodes: null,
      };
    } else {
      user = null;
    }
    session = null;
  }

  // Development fallback: if no auth succeeded and we're not in production,
  // provide a default user so the platform can be demonstrated with seed data.
  if (!user && process.env.NODE_ENV !== 'production' && !process.env.DISABLE_DEV_AUTH) {
    const devRole = (opts.req.headers['x-dev-role'] as string) || 'participant';
    const devUserId = devRole === 'admin' || devRole === 'cbn' ? 200 : 101;
    user = {
      id: devUserId,
      sub: `dev-${devRole}-${devUserId}`,
      name: devRole === 'admin' ? 'Platform Admin' : devRole === 'cbn' ? 'CBN Regulator' : 'PayApp Nigeria Ltd',
      email: `${devRole}@switch.dev`,
      loginMethod: 'dev',
      role: devRole as any,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      twoFactorSecret: null,
      twoFactorEnabled: 'false' as any,
      twoFactorBackupCodes: null,
    };
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    session,
  };
}
