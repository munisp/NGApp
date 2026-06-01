import { describe, it, expect } from "vitest";
import { getDb } from "./db";

describe("PostgreSQL connection", () => {
  it("should connect to the local PostgreSQL instance", async () => {
    const db = await getDb();
    expect(db).not.toBeNull();
  });

  it("should be able to query the users table", async () => {
    const db = await getDb();
    expect(db).not.toBeNull();
    if (!db) return;
    const { users } = await import("../drizzle/schema");
    const result = await db.select().from(users).limit(1);
    expect(Array.isArray(result)).toBe(true);
  });
});
