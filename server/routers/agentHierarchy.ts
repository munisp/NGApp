import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { agents, supervisorAgents } from "../../drizzle/schema";

export const agentHierarchyRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(supervisorAgents).orderBy(desc(supervisorAgents.assignedAt)).limit(input?.limit ?? 50);
    return { hierarchy: rows, total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalRelations] = await db.select({ value: count() }).from(supervisorAgents);
    const [totalAgents] = await db.select({ value: count() }).from(agents);
    return { totalRelations: Number(totalRelations.value), totalAgents: Number(totalAgents.value) };
  }),
});
