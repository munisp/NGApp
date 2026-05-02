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
    user = null;
    session = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    session,
  };
}
