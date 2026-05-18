import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { kycSessions, kycDocuments, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const agentKycRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalSessions: 0, pending: 0, approved: 0, rejected: 0 };
    const [total] = await db.select({ value: count() }).from(kycSessions).limit(100);
    const statusCounts = await db.select({ status: kycSessions.status, cnt: count() }).from(kycSessions).groupBy(kycSessions.status).limit(100);
    const byStatus: Record<string, number> = {};
    statusCounts.forEach(r => { byStatus[r.status] = Number(r.cnt); });
    return { totalSessions: Number(total.value), pending: byStatus["pending"] ?? 0, approved: byStatus["approved"] ?? 0, rejected: byStatus["rejected"] ?? 0 };
  }),
  listSessions: protectedProcedure.input(z.object({ agentId: z.number().optional(), status: z.string().optional(), limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    try {
      const db = await getDb();
      if (!db) return { sessions: [], total: 0 };
      const conditions: any[] = [];
      if (input?.agentId) conditions.push(eq(kycSessions.agentId, input.agentId));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const rows = await db.select().from(kycSessions).where(where).orderBy(desc(kycSessions.createdAt)).limit(input?.limit ?? 20);
      return { sessions: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  createSession: protectedProcedure.input(z.object({ agentId: z.number(), type: z.string().default("standard") })).mutation(async ({ input }) => {
    try {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const [session] = await db.insert(kycSessions).values({ agentId: input.agentId, type: input.type, status: "pending" }).returning();
      await db.insert(auditLog).values({ action: "kyc_session_created", resource: "kyc_sessions", resourceId: String(session.id), status: "success", metadata: { agentId: input.agentId } });
      return { success: true, session };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  approveSession: protectedProcedure.input(z.object({ sessionId: z.number(), reviewNotes: z.string().optional() })).mutation(async ({ input }) => {
    try {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const [updated] = await db.update(kycSessions).set({ status: "approved", reviewedAt: new Date() }).where(eq(kycSessions.id, input.sessionId)).returning();
      await db.insert(auditLog).values({ action: "kyc_approved", resource: "kyc_sessions", resourceId: String(input.sessionId), status: "success" });
      return { success: true, session: updated };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
});
