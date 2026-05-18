import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { tenants, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const multiTenancyRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalTenants: 0, activeTenants: 0, isolationMode: "schema", dataResidency: "NG" };
    const [total] = await db.select({ value: count() }).from(tenants).limit(100);
    const [active] = await db.select({ value: count() }).from(tenants).where(eq(tenants.status, "active")).limit(100);
    return { totalTenants: Number(total.value), activeTenants: Number(active.value), isolationMode: "schema", dataResidency: "NG" };
  }),
  listTenants: protectedProcedure.input(z.object({ status: z.string().optional(), limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    try {
      const db = await getDb();
      if (!db) return { tenants: [], total: 0 };
      const conditions: any[] = [];
      if (input?.status) conditions.push(eq(tenants.status, input.status));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const rows = await db.select().from(tenants).where(where).orderBy(desc(tenants.createdAt)).limit(input?.limit ?? 20);
      return { tenants: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getTenantConfig: protectedProcedure.input(z.object({ tenantId: z.number() })).query(async ({ input }) => {
    try {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(tenants).where(eq(tenants.id, input.tenantId)).limit(1);
      if (rows.length === 0) return null;
      return { tenant: rows[0], isolation: "schema", features: { offlineMode: true, customBranding: true, apiAccess: true } };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
});
