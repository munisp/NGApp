/**
 * ptwScheduler.ts — Permit-to-Work expiry auto-close scheduler
 *
 * Runs hourly to:
 *  1. Query all ACTIVE permits where validUntil < NOW()
 *  2. Flip their status to CANCELLED (closest to EXPIRED in the enum)
 *  3. Send an owner notification listing the expired permits
 *
 * Note: The permit_status enum does not include "EXPIRED" — we use "CANCELLED"
 * with a system-generated comment to distinguish auto-expiry from manual cancellation.
 * To add a proper EXPIRED status, extend the enum in drizzle/schema.ts and run db:push.
 */

import { getDb } from "./db";
import { permits } from "../drizzle/schema";
import { and, eq, lt, isNotNull } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export async function expireOverduePermits(): Promise<{ expired: number; permitIds: string[] }> {
  const db = await getDb();
  if (!db) {
    console.warn("[PTWScheduler] Database unavailable — skipping expiry check");
    return { expired: 0, permitIds: [] };
  }

  const now = new Date();

  // Find all ACTIVE permits that have passed their validUntil timestamp
  const overduePermits = await db
    .select({
      id: permits.id,
      permitId: permits.permitId,
      title: permits.title,
      validUntil: permits.validUntil,
      requestedBy: permits.requestedBy,
    })
    .from(permits)
    .where(
      and(
        eq(permits.status, "ACTIVE"),
        isNotNull(permits.validUntil),
        lt(permits.validUntil, now),
      )
    );

  if (overduePermits.length === 0) {
    return { expired: 0, permitIds: [] };
  }

  // Flip each to CANCELLED (auto-expiry)
  const permitIds: string[] = [];
  for (const permit of overduePermits) {
    await db
      .update(permits)
      .set({
        status: "EXPIRED",
        updatedAt: now,
        description: `[AUTO-EXPIRED] Permit automatically closed at ${now.toISOString()} — validUntil was ${permit.validUntil?.toISOString() ?? "unknown"}`,
        closedBy: "SYSTEM",
        closedAt: now,
      })
      .where(eq(permits.id, permit.id));
    permitIds.push(permit.permitId);
  }

  // Notify owner
  const permitList = overduePermits
    .map(p => `• ${p.permitId} — "${p.title}" (requested by ${p.requestedBy}, expired ${p.validUntil?.toISOString().slice(0, 16).replace("T", " ")} UTC)`)
    .join("\n");

  try {
    await notifyOwner({
      title: `[PTW] ${overduePermits.length} Permit${overduePermits.length > 1 ? "s" : ""} Auto-Expired`,
      content: `The following active permit${overduePermits.length > 1 ? "s have" : " has"} passed their validity window and been automatically closed:\n\n${permitList}\n\nPlease review and reissue if work is still in progress.`,
    });
  } catch (err) {
    console.error("[PTWScheduler] Failed to send owner notification:", err);
  }

  console.log(`[PTWScheduler] Auto-expired ${overduePermits.length} permit(s): ${permitIds.join(", ")}`);
  return { expired: overduePermits.length, permitIds };
}

export function startPTWScheduler(): void {
  if (schedulerInterval) {
    console.warn("[PTWScheduler] Already running — skipping duplicate start");
    return;
  }

  // Run immediately on startup to catch any permits that expired while the server was down
  expireOverduePermits().catch(err =>
    console.error("[PTWScheduler] Startup expiry check failed:", err)
  );

  schedulerInterval = setInterval(() => {
    expireOverduePermits().catch(err =>
      console.error("[PTWScheduler] Hourly expiry check failed:", err)
    );
  }, INTERVAL_MS);

  console.log(`[PTWScheduler] Started — hourly expiry checks active | interval: ${INTERVAL_MS / 60_000} min`);
}

export function stopPTWScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[PTWScheduler] Stopped");
  }
}
