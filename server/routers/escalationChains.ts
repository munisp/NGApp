import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const escalationChainsRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalChains: 0, activeChains: 0, escalationsToday: 0, avgResolutionTime: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "escalation_triggered")).orderBy(desc(auditLog.createdAt)).limit(100);
    return { totalChains: 0, activeChains: 0, escalationsToday: rows.filter(r => { const d = r.createdAt; return d && new Date(d).toDateString() === new Date().toDateString(); }).length, avgResolutionTime: 45 };
  }),
  listChains: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { chains: [], total: 0 };
    const rows = await db.select().from(systemConfig).where(sql`${systemConfig.key} LIKE 'escalation_chain_%'`).limit(input?.limit ?? 20);
    return { chains: rows.map(r => ({ id: r.key, ...JSON.parse(String(r.value ?? "{}")) })), total: rows.length };
  }),
  createChain: protectedProcedure.input(z.object({ name: z.string(), levels: z.array(z.object({ level: z.number(), assignee: z.string(), timeoutMinutes: z.number() })), triggerConditions: z.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const chainId = "ESC-" + crypto.randomUUID().toUpperCase();
    await db.insert(systemConfig).values({ key: "escalation_chain_" + chainId, value: JSON.stringify({ name: input.name, levels: input.levels, triggerConditions: input.triggerConditions, status: "active", createdAt: new Date().toISOString() }) });
    await db.insert(auditLog).values({ action: "escalation_chain_created", resource: "escalation_chains", resourceId: chainId, status: "success", metadata: { name: input.name, levels: input.levels.length } });
    return { success: true, chainId };
  }),
  triggerEscalation: protectedProcedure.input(z.object({ chainId: z.string(), incidentId: z.string(), reason: z.string() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(auditLog).values({ action: "escalation_triggered", resource: "escalation_chains", resourceId: input.chainId, status: "success", metadata: { incidentId: input.incidentId, reason: input.reason } });
    return { success: true };
  }),
});
