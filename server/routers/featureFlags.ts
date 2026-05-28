/**
 * Feature Flags Router — DB-backed feature flag management.
 * Supports global on/off, per-tenant targeting, and percentage rollout.
 */
import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { featureFlags } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const featureFlagsRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    return db.select().from(featureFlags).orderBy(featureFlags.flagKey);
  }),

  get: protectedProcedure
    .input(z.object({ flagKey: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const rows = await db.select().from(featureFlags).where(eq(featureFlags.flagKey, input.flagKey)).limit(1);
      if (rows.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: `Flag ${input.flagKey} not found` });
      return rows[0];
    }),

  check: protectedProcedure
    .input(z.object({ flagKey: z.string().min(1), tenantId: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { enabled: false, reason: "db_unavailable" };
      const rows = await db.select().from(featureFlags).where(eq(featureFlags.flagKey, input.flagKey)).limit(1);
      if (rows.length === 0) return { enabled: false, reason: "flag_not_found" };
      const flag = rows[0];
      if (!flag.enabled) return { enabled: false, reason: "globally_disabled" };
      // Tenant check
      if (flag.tenantIds && input.tenantId) {
        const tenants = flag.tenantIds.split(",").map((t) => t.trim());
        if (!tenants.includes(input.tenantId)) return { enabled: false, reason: "tenant_not_targeted" };
      }
      // Percentage rollout
      if (flag.percentage !== null && flag.percentage < 100) {
        const hash = input.tenantId
          ? input.tenantId.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 100
          : Math.floor(Math.random() * 100);
        if (hash >= flag.percentage) return { enabled: false, reason: "percentage_excluded" };
      }
      return { enabled: true, reason: "active" };
    }),

  create: adminProcedure
    .input(z.object({
      flagKey: z.string().min(1).max(64),
      name: z.string().min(1).max(128),
      description: z.string().optional(),
      enabled: z.boolean().default(false),
      tenantIds: z.string().optional(),
      percentage: z.number().int().min(0).max(100).default(100),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [row] = await db.insert(featureFlags).values({
        ...input,
        createdBy: ctx.user?.email ?? "system",
      }).returning();
      return row;
    }),

  update: adminProcedure
    .input(z.object({
      flagKey: z.string().min(1),
      enabled: z.boolean().optional(),
      tenantIds: z.string().optional(),
      percentage: z.number().int().min(0).max(100).optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { flagKey, ...updateData } = input;
      const [row] = await db.update(featureFlags)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(featureFlags.flagKey, flagKey))
        .returning();
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: `Flag ${flagKey} not found` });
      return row;
    }),

  delete: adminProcedure
    .input(z.object({ flagKey: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.delete(featureFlags).where(eq(featureFlags.flagKey, input.flagKey));
      return { deleted: true };
    }),
});
