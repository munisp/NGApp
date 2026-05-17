import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getAuditLog } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { getAgentFromCookie } from "../middleware/agentAuth";
import { getDb } from "../db";
import { auditLog } from "../../drizzle/schema";
import { inArray, desc } from "drizzle-orm";

export const auditLogRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }))
    .query(async ({ input, ctx }) => {
      const session = await getAgentFromCookie(ctx.req);
      if (!session) throw new TRPCError({ code: "UNAUTHORIZED", message: "Agent session required" });
      return getAuditLog(session.id, input.limit, input.offset);
    }),

  // Admin: all agents
  listAll: protectedProcedure
    .input(z.object({ limit: z.number().default(100), offset: z.number().default(0) }))
    .query(async ({ input }) => {
      return getAuditLog(undefined, input.limit, input.offset);
    }),

  // Filter by specific action types (Terminal Events, Compliance Reports, etc.)
  listByActions: protectedProcedure
    .input(z.object({
      actions: z.array(z.string()),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      if (!db) return [];
      return db
        .select()
        .from(auditLog)
        .where(inArray(auditLog.action, input.actions))
        .orderBy(desc(auditLog.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),
});
