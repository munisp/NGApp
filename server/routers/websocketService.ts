import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const websocketServiceRouter = router({
  getStatus: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, "websocket_config")).limit(1);
    return config ? { ...JSON.parse(String(config.value)), status: "running" } : { status: "running", connections: 0, maxConnections: 10000, uptime: "0h" };
  }),
  getConnections: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "websocket_connection")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    return { connections: rows.map(r => ({ id: r.resourceId, action: r.action, status: r.status, timestamp: r.createdAt })), total: rows.length };
  }),
  broadcast: protectedProcedure.input(z.object({ channel: z.string(), message: z.string(), data: z.record(z.string(), z.unknown()).optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.insert(auditLog).values({ action: "ws_broadcast", resource: "websocket_connection", resourceId: input.channel, status: "success", metadata: { message: input.message, data: input.data } });
    return { success: true, channel: input.channel, deliveredAt: new Date().toISOString() };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "websocket_connection"));
    return { totalEvents: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
