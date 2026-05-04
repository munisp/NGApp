/**
 * Service for managing detailed retry attempt logs
 */

import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { retryAttemptLogs } from "../../drizzle/schema";

/**
 * Get all retry attempts for a delivery log
 */
export async function getRetryAttempts(deliveryLogId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const attempts = await db
    .select()
    .from(retryAttemptLogs)
    .where(eq(retryAttemptLogs.deliveryLogId, deliveryLogId))
    .orderBy(retryAttemptLogs.attemptNumber);

  return attempts;
}

/**
 * Get retry attempt statistics for a delivery
 */
export async function getRetryStats(deliveryLogId: number) {
  const attempts = await getRetryAttempts(deliveryLogId);

  const totalAttempts = attempts.length;
  const successfulAttempts = attempts.filter((a) => a.success).length;
  const failedAttempts = attempts.filter((a) => !a.success).length;
  
  const avgDuration =
    attempts.filter((a) => a.durationMs).reduce((sum, a) => sum + (a.durationMs || 0), 0) /
    (attempts.filter((a) => a.durationMs).length || 1);

  return {
    totalAttempts,
    successfulAttempts,
    failedAttempts,
    avgDurationMs: Math.round(avgDuration),
    attempts,
  };
}
