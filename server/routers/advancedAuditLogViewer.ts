// Sprint 95: Production implementation — advancedAuditLogViewer
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { auditLog } from "../../drizzle/schema";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const advancedAuditLogViewerRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().default(50), offset: z.number().default(0), actor: z.string().optional(), action: z.string().optional() }))
    .query(async ({ input }) => {
      try {
        const db = (await getDb())!;
        const rows = await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(input.limit).offset(input.offset);
        const [{ total }] = await db.select({ total: count() }).from(auditLog).limit(100);
        return { rows, total, limit: input.limit, offset: input.offset };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
      }
    }),
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      try {
        const db = (await getDb())!;
        const [row] = await db.select().from(auditLog).where(eq(auditLog.id, input.id)).limit(100);
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Audit log entry not found" });
        return row;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
      }
    }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [{ total }] = await db.select({ total: count() }).from(auditLog).limit(100);
    return { totalEntries: total, lastChecked: new Date().toISOString() };
  }),
});
