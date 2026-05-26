/**
 * Daily Damage Digest Scheduler
 * Runs at 06:00 UTC every day.
 * Queries all open damage assessments with no repair ticket and sends
 * the owner a push notification with a summary table of unaddressed critical assets.
 */

import { getPool } from "./db";
import { notifyOwner } from "./_core/notification";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UnaddressedAsset {
  id: string;
  well_name: string | null;
  field_name: string | null;
  asset_type: string;
  damage_level: string;
  repair_priority: number;
  days_since_assessment: number;
}

// ─── Core logic ───────────────────────────────────────────────────────────────

async function runDamageDigest(): Promise<void> {
  const pool = await getPool();
  if (!pool) {
    console.warn("[DamageDigest] Database pool unavailable — skipping digest");
    return;
  }

  try {
    // Find all damage assessments that have no repair ticket
    const rows = await pool.query<UnaddressedAsset>(`
      SELECT
        da.id::text,
        w.name AS well_name,
        da.field_name,
        da.asset_type,
        da.damage_level,
        da.repair_priority,
        EXTRACT(DAY FROM NOW() - da.created_at)::int AS days_since_assessment
      FROM damage_assessments da
      LEFT JOIN wells w ON w.id = da.well_id
      LEFT JOIN repair_tickets rt ON rt.assessment_id = da.id
      WHERE rt.id IS NULL
        AND da.damage_level IN ('DESTROYED', 'SEVERELY_DAMAGED', 'MODERATELY_DAMAGED')
      ORDER BY da.repair_priority DESC, da.created_at ASC
      LIMIT 50
    `);

    const assets = rows.rows;

    if (assets.length === 0) {
      console.log("[DamageDigest] No unaddressed damage assessments — skipping notification");
      return;
    }

    // Build summary counts by damage level
    const counts = assets.reduce<Record<string, number>>((acc, a) => {
      acc[a.damage_level] = (acc[a.damage_level] || 0) + 1;
      return acc;
    }, {});

    const countSummary = Object.entries(counts)
      .map(([lvl, cnt]) => `${cnt} ${lvl.replace("_", " ")}`)
      .join(", ");

    // Build a compact table for the notification
    const tableRows = assets.slice(0, 10).map(a => {
      const location = a.well_name || a.field_name || a.id;
      const age = a.days_since_assessment === 0 ? "today" : `${a.days_since_assessment}d ago`;
      return `• [P${a.repair_priority}] ${location} — ${a.asset_type} — ${a.damage_level.replace("_", " ")} (assessed ${age})`;
    });

    const moreCount = assets.length > 10 ? `\n…and ${assets.length - 10} more.` : "";

    const title = `⚠️ Daily Damage Digest: ${assets.length} Unaddressed Asset${assets.length !== 1 ? "s" : ""}`;
    const content = [
      `**${assets.length} damage assessments have no repair ticket assigned** (${countSummary}).`,
      "",
      "**Top Priority Assets:**",
      ...tableRows,
      moreCount,
      "",
      "Please review the War Damage Assessment module and assign repair tickets.",
    ].join("\n");

    const sent = await notifyOwner({ title, content });
    if (sent) {
      console.log(`[DamageDigest] Digest sent — ${assets.length} unaddressed assets`);
    } else {
      console.warn("[DamageDigest] Notification service unavailable — digest not sent");
    }
  } catch (err) {
    console.error("[DamageDigest] Error running digest:", err instanceof Error ? err.message : err);
  }
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

/**
 * Start the daily damage digest scheduler.
 * Fires at 06:00 UTC every day.
 */
export function startDamageDigestScheduler(): void {
  console.log("[DamageDigest] Scheduler started — daily digest at 06:00 UTC");

  function scheduleNext(): void {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(6, 0, 0, 0);
    if (next <= now) {
      // Already past 06:00 UTC today — schedule for tomorrow
      next.setUTCDate(next.getUTCDate() + 1);
    }
    const msUntilNext = next.getTime() - now.getTime();
    const hoursUntil = Math.round(msUntilNext / 3_600_000 * 10) / 10;
    console.log(`[DamageDigest] Next digest in ${hoursUntil}h (${next.toISOString()})`);

    setTimeout(async () => {
      await runDamageDigest();
      scheduleNext(); // Re-schedule for the following day
    }, msUntilNext);
  }

  scheduleNext();
}

/**
 * Trigger an immediate digest (for testing or manual dispatch).
 */
export async function triggerDamageDigestNow(): Promise<void> {
  console.log("[DamageDigest] Manual trigger");
  await runDamageDigest();
}
