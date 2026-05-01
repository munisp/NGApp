import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { verifyKeycloakToken, mapKeycloakRoleToNdsep } from "../keycloak";
import { getUserByOpenId, upsertUser } from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

/**
 * Try to authenticate via Keycloak Bearer token.
 * Returns a User record (upserted into the DB) or null.
 */
async function tryKeycloakAuth(authHeader: string | undefined): Promise<User | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    const kcUser = await verifyKeycloakToken(token);
    if (!kcUser) return null;
    // Map to NDSEP platform role
    const role = mapKeycloakRoleToNdsep(kcUser);
    // Upsert the user in our DB using Keycloak sub as openId
    await upsertUser({
      openId: `kc:${kcUser.sub}`,
      name: kcUser.name ?? kcUser.username,
      email: kcUser.email ?? null,
      role,
    });
    const user = await getUserByOpenId(`kc:${kcUser.sub}`);
    return user ?? null;
  } catch {
    return null;
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // 1. Try Keycloak SSO (Authorization: Bearer <jwt>)
  const kcUser = await tryKeycloakAuth(opts.req.headers.authorization);
  if (kcUser) {
    user = kcUser;
  } else {
    // 2. Fall back to Manus OAuth session cookie
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
