import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { agents, transactions, auditLog } from "../../drizzle/schema";

export const bulkOperationsRouter = router({
  listOperations: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "bulk_operation")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    return { operations: rows.map(r => ({ id: r.resourceId, status: r.status, metadata: r.metadata, timestamp: r.createdAt })), total: rows.length };
  }),
  bulkUpdateAgents: protectedProcedure.input(z.object({ agentIds: z.array(z.number()), updates: z.object({ isActive: z.boolean().optional(), tier: z.string().optional(), location: z.string().optional() }) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    let updated = 0;
    for (const agentId of input.agentIds) {
      const updateData: Record<string, unknown> = {};
      if (input.updates.isActive !== undefined) updateData.isActive = input.updates.isActive;
      if (input.updates.tier) updateData.tier = input.updates.tier;
      if (input.updates.location) updateData.location = input.updates.location;
      await db.update(agents).set(updateData).where(eq(agents.id, agentId));
      updated++;
    }
    await db.insert(auditLog).values({ action: "bulk_operation", resource: "agents", resourceId: "bulk-" + crypto.randomUUID(), status: "success", metadata: { type: "bulk_update_agents", count: updated, updates: input.updates } });
    return { success: true, updated, total: input.agentIds.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.action, "bulk_operation"));
    return { totalOperations: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
