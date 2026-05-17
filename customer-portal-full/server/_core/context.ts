import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

async function getDevUser(): Promise<User | null> {
  if (process.env.NODE_ENV !== "development") return null;
  try {
    let user = await db.getUserByOpenId("test-user-123");
    if (!user) {
      await db.upsertUser({
        openId: "test-user-123",
        name: "John Doe",
        email: "john.doe@example.com",
        role: "admin",
      });
      user = await db.getUserByOpenId("test-user-123");
    }
    return user ?? null;
  } catch {
    return null;
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // In development, fall back to a dev user for local testing
    user = await getDevUser();
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
