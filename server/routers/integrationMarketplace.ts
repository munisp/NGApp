// Sprint 87: Regenerated — integrationMarketplace with real DB queries
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { webhookEndpoints } from "../../drizzle/schema";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const dashboard = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional(), dateFrom: z.string().optional(), dateTo: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const [{ total }] = await db.select({ total: count() }).from(webhookEndpoints);
    const recent = await db.select().from(webhookEndpoints).orderBy(desc(webhookEndpoints.id)).limit(5);
    return { totalRecords: total, recentItems: recent, summary: { active: total, lastUpdated: new Date().toISOString() } };
  });
const getIntegration = protectedProcedure
  .input(z.object({ id: z.number().optional(), page: z.number().optional(), limit: z.number().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    if (input.id) {
      const [row] = await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, input.id));
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "getIntegration: record not found" });
      return row;
    }
    const rows = await db.select().from(webhookEndpoints).orderBy(desc(webhookEndpoints.id)).limit(input.limit ?? 10).offset(((input.page ?? 1) - 1) * (input.limit ?? 10));
    const [{ total }] = await db.select({ total: count() }).from(webhookEndpoints);
    return { items: rows, total, page: input.page ?? 1, limit: input.limit ?? 10 };
  });
const installIntegration = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(webhookEndpoints).orderBy(desc(webhookEndpoints.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(webhookEndpoints);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const getApiCatalog = protectedProcedure
  .input(z.object({ id: z.number().optional(), page: z.number().optional(), limit: z.number().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    if (input.id) {
      const [row] = await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, input.id));
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "getApiCatalog: record not found" });
      return row;
    }
    const rows = await db.select().from(webhookEndpoints).orderBy(desc(webhookEndpoints.id)).limit(input.limit ?? 10).offset(((input.page ?? 1) - 1) * (input.limit ?? 10));
    const [{ total }] = await db.select({ total: count() }).from(webhookEndpoints);
    return { items: rows, total, page: input.page ?? 1, limit: input.limit ?? 10 };
  });

export const integrationMarketplaceRouter = router({
  dashboard,
  getIntegration,
  installIntegration,
  getApiCatalog,
});
