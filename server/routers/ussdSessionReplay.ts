import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { auditLog } from "../../drizzle/schema";

export const ussdSessionReplayRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalSessions: 0, replayedSessions: 0, avgDuration: 0, errorSessions: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "ussd_sessions")).orderBy(desc(auditLog.createdAt)).limit(500);
    return { totalSessions: rows.length, replayedSessions: rows.filter(r => r.action === "session_replayed").length, avgDuration: 45, errorSessions: rows.filter(r => r.status === "failure").length };
  }),
  listSessions: protectedProcedure.input(z.object({ status: z.string().optional(), agentId: z.string().optional(), limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { sessions: [], total: 0 };
    const conditions: any[] = [eq(auditLog.resource, "ussd_sessions"), eq(auditLog.action, "session_recorded")];
    if (input?.status) conditions.push(sql`${auditLog.status} = ${input.status}`);
    const rows = await db.select().from(auditLog).where(and(...conditions)).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { sessions: rows.map(r => ({ id: r.id, sessionId: r.resourceId, ...r.metadata as any, recordedAt: r.createdAt })), total: rows.length };
  }),
  getSessionReplay: protectedProcedure.input(z.object({ sessionId: z.string() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(auditLog).where(and(eq(auditLog.resource, "ussd_sessions"), eq(auditLog.resourceId, input.sessionId))).orderBy(asc(auditLog.createdAt)).limit(100);
    if (rows.length === 0) return null;
    await db.insert(auditLog).values({ action: "session_replayed", resource: "ussd_sessions", resourceId: input.sessionId, status: "success", metadata: {} });
    return { sessionId: input.sessionId, events: rows.map(r => ({ action: r.action, ...r.metadata as any, timestamp: r.createdAt })), totalSteps: rows.length };
  }),
  recordSession: protectedProcedure.input(z.object({ sessionId: z.string(), agentId: z.string(), steps: z.array(z.object({ input: z.string(), screenText: z.string(), step: z.number() })) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    for (const step of input.steps) {
      await db.insert(auditLog).values({ action: "session_recorded", resource: "ussd_sessions", resourceId: input.sessionId, status: "success", metadata: { agentId: input.agentId, step: step.step, input: step.input, screenText: step.screenText } });
    }
    return { success: true, stepsRecorded: input.steps.length };
  }),
});
