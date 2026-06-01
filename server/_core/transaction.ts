/**
 * Database transaction helper for Drizzle ORM.
 * Wraps multi-table operations in PostgreSQL transactions.
 */
import { getDb, getPool } from "../db";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { TRPCError } from "@trpc/server";

export async function withTransaction<T>(
  fn: (tx: NodePgDatabase) => Promise<T>
): Promise<T> {
  const pool = await getPool();
  if (!pool) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Database unavailable",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const tx = drizzle(client);
    const result = await fn(tx);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
