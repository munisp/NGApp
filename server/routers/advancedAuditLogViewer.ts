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
      const db = (await getDb())!;
      const rows = await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(input.limit).offset(input.offset);
      const [{ total }] = await db.select({ total: count() }).from(auditLog);
      return { rows, total, limit: input.limit, offset: input.offset };
    }),
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const [row] = await db.select().from(auditLog).where(eq(auditLog.id, input.id));
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Audit log entry not found" });
      return row;
    }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [{ total }] = await db.select({ total: count() }).from(auditLog);
    return { totalEntries: total, lastChecked: new Date().toISOString() };
  }),
});
