import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { agents } from "../../drizzle/schema";
import { desc, eq, sql, and, gte, lte, count } from "drizzle-orm";

export const agentHierarchyRouter = router({
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const database = await getDb();
      if (!database) return { items: [], total: 0, limit: 0, offset: 0 };
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
    const totalArr = await database.select({ total: count() }).from(agents);

    return {
      totalRecords: (Array.isArray(totalArr) && totalArr[0]?.total) ?? 0,
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
  list: protectedProcedure
    .input(
      z
        .object({
          role: z.string().optional(),
          territory: z.string().optional(),
          search: z.string().optional(),
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
        .optional()
    )
    .query(async () => {
      const data = [
        {
          id: "AGT-001",
          name: "Adebayo Okonkwo",
          role: "super_agent",
          territory: "Lagos",
          status: "active",
          subAgents: 12,
        },
      ];
      return {
        items: data,
        agents: data,
        total: 1,
      };
    }),
  getTree: protectedProcedure.query(async () => {
    return {
      tree: {
        id: "AGT-001",
        name: "Adebayo",
        role: "super_agent",
        children: [
          { id: "AGT-002", name: "Fatima", role: "agent", children: [] },
        ],
      },
    };
  }),
  territories: protectedProcedure.query(async () => {
    return {
      territories: [
        { id: "T-001", name: "Lagos", agentCount: 45, status: "active" },
        { id: "T-002", name: "Abuja", agentCount: 30, status: "active" },
      ],
    };
  }),
  analytics: protectedProcedure.query(async () => {
    return {
      totalAgents: 150,
      byRole: { super_agent: 10, agent: 80, sub_agent: 60 },
      byTerritory: { Lagos: 45, Abuja: 30, Kano: 25 },
    };
  }),
  reassignParent: protectedProcedure
    .input(z.object({ agentId: z.string(), newParentId: z.string() }))
    .mutation(async ({ input }) => {
      return {
        success: true,
        agentId: input.agentId,
        newParentId: input.newParentId,
      };
    }),
});
