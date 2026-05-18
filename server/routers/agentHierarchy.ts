import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { agents, supervisorAgents } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const agentHierarchyRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select().from(supervisorAgents).orderBy(desc(supervisorAgents.assignedAt)).limit(input?.limit ?? 50);
      return { hierarchy: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalRelations] = await db.select({ value: count() }).from(supervisorAgents).limit(100);
    const [totalAgents] = await db.select({ value: count() }).from(agents).limit(100);
    return { totalRelations: Number(totalRelations.value), totalAgents: Number(totalAgents.value) };
  }),
});
