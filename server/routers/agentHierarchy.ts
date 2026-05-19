import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { agents } from "../../drizzle/schema";
import { desc, eq, sql, and, gte, lte, count } from "drizzle-orm";

export const agentHierarchyRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        search: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const database = await getDb();
      if (!database) return { data: [], total: 0, limit: 0, offset: 0 };
      const results = await database
        .select()
        .from(agents)
        .orderBy(desc(agents.id))
        .limit(input.limit)
        .offset(input.offset);

      const [totalResult] = await database
        .select({ total: count() })
        .from(agents);

      return {
        data: results,
        total: totalResult?.total ?? 0,
        limit: input.limit,
        offset: input.offset,
      };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const database = await getDb();
      if (!database) return { data: [], total: 0, limit: 0, offset: 0 };
      const [record] = await database
        .select()
        .from(agents)
        .where(eq(agents.id, input.id))
        .limit(1);

      if (!record) {
        throw new Error(`Record with id ${input.id} not found`);
      }
      return record;
    }),

  getSummary: protectedProcedure.query(async () => {
    const database = await getDb();
    if (!database) return { data: [], total: 0, limit: 0, offset: 0 };
    const [totalResult] = await database
      .select({ total: count() })
      .from(agents);

    return {
      totalRecords: totalResult?.total ?? 0,
      lastUpdated: new Date().toISOString(),
    };
  }),

  getRecent: protectedProcedure
    .input(
      z.object({
        days: z.number().min(1).max(90).default(7),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ input }) => {
      const database = await getDb();
      if (!database) return { data: [], total: 0, limit: 0, offset: 0 };
      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const results = await database
        .select()
        .from(agents)
        .orderBy(desc(agents.id))
        .limit(input.limit);

      return results;
    }),

  // ── Sprint 28 domain procedures ──
  list: publicProcedure.query(async () => {
    return { agents: [{ id: "AGT-001", name: "Adebayo Okonkwo", role: "super_agent", territory: "Lagos", status: "active", subAgents: 12 }], total: 1 };
  }),
  getTree: publicProcedure.query(async () => {
    return { tree: { id: "AGT-001", name: "Adebayo", role: "super_agent", children: [{ id: "AGT-002", name: "Fatima", role: "agent", children: [] }] } };
  }),
  territories: publicProcedure.query(async () => {
    return { territories: [{ id: "T-001", name: "Lagos", agentCount: 45, status: "active" }, { id: "T-002", name: "Abuja", agentCount: 30, status: "active" }] };
  }),
  analytics: publicProcedure.query(async () => {
    return { totalAgents: 150, byRole: { super_agent: 10, agent: 80, sub_agent: 60 }, byTerritory: { Lagos: 45, Abuja: 30, Kano: 25 } };
  }),

});
