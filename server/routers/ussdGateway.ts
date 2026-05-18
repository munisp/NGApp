import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog } from "../../drizzle/schema";

export const ussdGatewayRouter = router({
  listSessions: protectedProcedure.input(z.object({ limit: z.number().default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "ussd_sessions")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    let sessions = rows.map(r => ({ id: r.id, sessionId: r.resourceId, status: r.status, metadata: r.metadata, createdAt: r.createdAt }));
    if (input?.status) sessions = sessions.filter(s => (s.metadata as Record<string, unknown>)?.sessionStatus === input.status);
    return { sessions, total: sessions.length };
  }),
  getSession: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [row] = await db.select().from(auditLog).where(eq(auditLog.id, input.id)).limit(1);
    return row ? { id: row.id, sessionId: row.resourceId, status: row.status, metadata: row.metadata, createdAt: row.createdAt } : null;
  }),
  initiateSession: protectedProcedure.input(z.object({ phoneNumber: z.string(), serviceCode: z.string().default("*347#") })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const sessionId = "USSD-" + crypto.randomUUID();
    const [entry] = await db.insert(auditLog).values({ action: "ussd_session_started", resource: "ussd_sessions", resourceId: sessionId, status: "success", metadata: { phoneNumber: input.phoneNumber, serviceCode: input.serviceCode, sessionStatus: "active" } }).returning();
    return { id: entry.id, sessionId, phoneNumber: input.phoneNumber, serviceCode: input.serviceCode, status: "active" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "ussd_sessions"));
    return { totalSessions: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
