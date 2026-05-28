/**
 * hseEscalation.ts — HSE incident severity escalation
 * Escalates CRITICAL/HIGH incidents that have been open > 24h without investigation
 */
import { getDb } from "../db";
import { hseIncidents } from "../../drizzle/schema";
import { isNull, lt, or, eq } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";

export async function checkHSEEscalations(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const cutoff = new Date(Date.now() - 24 * 3600 * 1000);

  const unresolved = await db.select().from(hseIncidents)
    .where(
      or(eq(hseIncidents.severity, "CRITICAL"), eq(hseIncidents.severity, "HIGH"))
    )
    .limit(50);

  const escalate = unresolved.filter(i =>
    !i.closedAt &&
    !i.investigatedBy &&
    i.occurredAt < cutoff
  );

  if (escalate.length === 0) return;

  await notifyOwner({
    title: `[HSE ESCALATION] ${escalate.length} critical/high incidents require investigation`,
    content: escalate.map(i =>
      `${i.incidentId}: ${i.title} (${i.severity}) — Occurred: ${i.occurredAt.toISOString().split("T")[0]} — Location: ${i.location || "Unknown"}`
    ).join("\n"),
  });

  console.log(`[HSEEscalation] Escalated ${escalate.length} incidents`);
}

export function startHSEEscalationScheduler(): void {
  checkHSEEscalations().catch(console.error);
  setInterval(() => checkHSEEscalations().catch(console.error), 4 * 3600 * 1000);
  console.log("[HSEEscalation] Scheduler started (every 4h)");
}
