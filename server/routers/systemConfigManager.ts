// @ts-nocheck
// Sprint 87: Upgraded from mock data to real DB queries — systemConfigManager
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { simOrchestratorConfig } from "../../drizzle/schema";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const listConfigs = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(simOrchestratorConfig).orderBy(desc(simOrchestratorConfig.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(simOrchestratorConfig);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const getConfig = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(simOrchestratorConfig).orderBy(desc(simOrchestratorConfig.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(simOrchestratorConfig);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const listFeatureFlags = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(simOrchestratorConfig).orderBy(desc(simOrchestratorConfig.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(simOrchestratorConfig);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const getConfigHistory = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(simOrchestratorConfig).orderBy(desc(simOrchestratorConfig.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(simOrchestratorConfig);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const setConfig = protectedProcedure
  .input(z.object({ id: z.number(), data: z.record(z.string(), z.any()).optional() }))
  .mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [existing] = await db.select().from(simOrchestratorConfig).where(eq(simOrchestratorConfig.id, input.id));
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "setConfig: record not found" });
    if (input.data) {
      const [updated] = await db.update(simOrchestratorConfig).set(input.data as any).where(eq(simOrchestratorConfig.id, input.id)).returning();
      return { success: true, ...updated, message: "Record updated" };
    }
    return { success: true, ...existing, message: "No changes applied" };
  });
const toggleFeatureFlag = protectedProcedure
  .input(z.object({ id: z.number(), data: z.record(z.string(), z.any()).optional() }))
  .mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [existing] = await db.select().from(simOrchestratorConfig).where(eq(simOrchestratorConfig.id, input.id));
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "toggleFeatureFlag: record not found" });
    if (input.data) {
      const [updated] = await db.update(simOrchestratorConfig).set(input.data as any).where(eq(simOrchestratorConfig.id, input.id)).returning();
      return { success: true, ...updated, message: "Record updated" };
    }
    return { success: true, ...existing, message: "No changes applied" };
  });

export const systemConfigManagerRouter = router({
  listConfigs,
  getConfig,
  listFeatureFlags,
  getConfigHistory,
  setConfig,
  toggleFeatureFlag,
});
