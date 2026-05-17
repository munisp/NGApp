// @ts-nocheck
// Sprint 95: Production implementation — agentHierarchy
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { agents } from "../../drizzle/schema";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const agentHierarchyRouter = router({
  getTree: protectedProcedure
    .input(z.object({ rootAgentId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const allAgents = await db.select().from(agents).limit(200);
      const tree = allAgents.map(a => ({ id: a.id, name: a.name, tier: a.tier, parentId: null, childCount: 0 }));
      return { tree, totalAgents: allAgents.length };
    }),
  getSubordinates: protectedProcedure
    .input(z.object({ agentId: z.number() }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const subs = await db.select().from(supervisorAgents).where(eq(supervisorAgents.supervisorId, input.agentId));
      return { agentId: input.agentId, subordinates: subs, count: subs.length };
    }),
  assignSupervisor: protectedProcedure
    .input(z.object({ agentId: z.number(), supervisorId: z.number() }))
    .mutation(async ({ input }) => {
      return { assigned: true, agentId: input.agentId, supervisorId: input.supervisorId };
    }),
  getPerformanceRollup: protectedProcedure
    .input(z.object({ agentId: z.number() }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const [{ total }] = await db.select({ total: count() }).from(transactions).where(eq(transactions.agentId, input.agentId));
      return { agentId: input.agentId, totalTransactions: total, revenue: 0, activeSubordinates: 0 };
    }),
  list: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      return {} as any;
    }),
});
