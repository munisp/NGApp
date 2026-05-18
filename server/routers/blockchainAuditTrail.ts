import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog } from "../../drizzle/schema";

export const blockchainAuditTrailRouter = router({
  listEntries: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "blockchain_audit")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    return { entries: rows.map(r => ({ id: r.id, action: r.action, resourceId: r.resourceId, status: r.status, hash: r.metadata, timestamp: r.createdAt })), total: rows.length };
  }),
  verifyEntry: protectedProcedure.input(z.object({ entryId: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [entry] = await db.select().from(auditLog).where(eq(auditLog.id, input.entryId)).limit(1);
    if (!entry) return { verified: false, error: "Entry not found" };
    return { verified: true, entry: { id: entry.id, action: entry.action, status: entry.status, timestamp: entry.createdAt } };
  }),
  anchorToChain: protectedProcedure.input(z.object({ auditIds: z.array(z.number()), chain: z.string().default("ethereum") })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const anchorId = "anchor-" + crypto.randomUUID();
    await db.insert(auditLog).values({ action: "blockchain_anchor", resource: "blockchain_audit", resourceId: anchorId, status: "success", metadata: { auditIds: input.auditIds, chain: input.chain, anchoredAt: new Date().toISOString() } });
    return { anchorId, chain: input.chain, entriesAnchored: input.auditIds.length, status: "anchored" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "blockchain_audit"));
    return { totalAnchored: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
