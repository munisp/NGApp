import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { logger } from "./lib/logger";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: mysql.Pool | null = null;

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getPool() {
  if (_pool || !ENV.databaseUrl) {
    return _pool;
  }

  _pool = mysql.createPool({
    uri: ENV.databaseUrl,
    waitForConnections: true,
    connectionLimit: parsePositiveInt(process.env.DB_POOL_MAX, 10),
    maxIdle: parsePositiveInt(process.env.DB_POOL_IDLE_MAX, 10),
    idleTimeout: parsePositiveInt(process.env.DB_POOL_IDLE_TIMEOUT_MS, 60_000),
    queueLimit: parsePositiveInt(process.env.DB_POOL_QUEUE_LIMIT, 100),
    enableKeepAlive: true,
    keepAliveInitialDelay: parsePositiveInt(process.env.DB_POOL_KEEPALIVE_DELAY_MS, 10_000),
  });

  return _pool;
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && ENV.databaseUrl) {
    try {
      const pool = getPool();
      if (!pool) {
        return null;
      }
      _db = drizzle(pool as any, { mode: "default" }) as ReturnType<typeof drizzle>;
    } catch (error) {
      logger.warn("Failed to connect to database", { error: String(error) });
      _db = null;
      _pool = null;
    }
  }
  return _db;
}

export async function closeDbPool() {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
  }
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    logger.warn("Cannot upsert user: database not available");
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
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    logger.error("Failed to upsert user", { error: String(error) });
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    logger.warn("Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}
