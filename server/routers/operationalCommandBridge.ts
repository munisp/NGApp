import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { auditLog, systemConfig, agents, transactions } from "../../drizzle/schema";

export const operationalCommandBridgeRouter = router({
  dashboard: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { activeCommands: 0, totalExecuted: 0, systemStatus: "unknown", alerts: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "command_executed")).orderBy(desc(auditLog.createdAt)).limit(500);
    const secEvents = await db.select().from(auditLog).where(eq(auditLog.action, "security_event")).orderBy(desc(auditLog.createdAt)).limit(100);
    return { activeCommands: 0, totalExecuted: rows.length, systemStatus: "operational", alerts: secEvents.length };
  }),
  executeCommand: protectedProcedure.input(z.object({ command: z.string(), target: z.string(), parameters: z.record(z.string(), z.any()).optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const cmdId = "CMD-" + crypto.randomUUID().toUpperCase();
    await db.insert(auditLog).values({ action: "command_executed", resource: "command_bridge", resourceId: cmdId, status: "success", metadata: { command: input.command, target: input.target, parameters: input.parameters } });
    return { success: true, commandId: cmdId };
  }),
  listCommands: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { commands: [], total: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "command_executed")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { commands: rows.map(r => ({ id: r.id, commandId: r.resourceId, status: r.status, executedAt: r.createdAt })), total: rows.length };
  }),
});
