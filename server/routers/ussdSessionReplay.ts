import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, gte } from "drizzle-orm";
import { auditLog } from "../../drizzle/schema";

export const ussdSessionReplayRouter = router({
  getSessionSteps: protectedProcedure.input(z.object({ sessionId: z.string().min(1) })).query(async ({ input }) => {
    const db = (await getDb())!;
    const steps = await db.select().from(auditLog).where(and(eq(auditLog.resource, "ussd_sessions"), eq(auditLog.resourceId, input.sessionId))).orderBy(auditLog.createdAt);
    return { sessionId: input.sessionId, steps: steps.map((s, i) => ({ step: i + 1, action: s.action, metadata: s.metadata, timestamp: s.createdAt })), totalSteps: steps.length };
  }),
  listRecentSessions: protectedProcedure.input(z.object({ limit: z.number().min(1).max(100).default(20), hoursBack: z.number().min(1).max(168).default(24) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const since = new Date(Date.now() - (input?.hoursBack ?? 24) * 3600000);
    const rows = await db.select().from(auditLog).where(and(eq(auditLog.action, "ussd_session_started"), gte(auditLog.createdAt, since))).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { sessions: rows.map(r => ({ sessionId: r.resourceId, metadata: r.metadata, startedAt: r.createdAt })), total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.action, "ussd_session_started"));
    const [replayed] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.action, "ussd_session_replayed"));
    return { totalSessions: Number(total.value), totalReplayed: Number(replayed.value) };
  }),
});
