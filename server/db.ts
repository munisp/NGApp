import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

/**
 * Resolve the PostgreSQL connection URL.
 * Priority:
 *   1. POSTGRES_URL  — explicitly set PostgreSQL URL (local or remote)
 *   2. Local sandbox PostgreSQL — always available in the sandbox
 *
 * DATABASE_URL is intentionally ignored here because the Manus platform
 * injects a TiDB/MySQL URL into that variable, which is incompatible with
 * the PostgreSQL schema used by this application.
 */
function resolveDbUrl(): string {
  if (process.env.POSTGRES_URL) {
    return process.env.POSTGRES_URL;
  }
  // Default to local sandbox PostgreSQL
  return "postgresql://ogrmm:ogrmm_secure_2026@localhost:5432/og_rmm";
}

/**
 * Determine SSL config based on the host.
 * - localhost / 127.0.0.1 → no SSL
 * - Any remote host → require SSL
 */
function sslConfig(url: string): boolean | { rejectUnauthorized: boolean } {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return false; // No SSL for local
    }
    return { rejectUnauthorized: false }; // SSL for remote (allow self-signed)
  } catch {
    return false;
  }
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db) {
    const dbUrl = resolveDbUrl();
    try {
      _pool = new Pool({
        connectionString: dbUrl,
        ssl: sslConfig(dbUrl),
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
      _db = drizzle(_pool);
      // Quick connectivity check
      await _pool.query("SELECT 1");
      console.log(`[Database] PostgreSQL connected → ${new URL(dbUrl).host}`);
    } catch (error) {
      console.warn("[Database] Failed to connect to PostgreSQL:", error instanceof Error ? error.message : error);
      _db = null;
      _pool = null;
    }
  }
  return _db;
}

/** Get the raw pg Pool for executing raw SQL queries */
export async function getPool(): Promise<Pool | null> {
  await getDb(); // ensure pool is initialized
  return _pool;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    // PostgreSQL upsert using ON CONFLICT DO UPDATE
    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}
