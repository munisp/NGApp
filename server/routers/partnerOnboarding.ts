import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  tenants,
  tenantBranding,
  tenantCorridors,
  tenantFeeOverrides,
  inviteCodes,
} from "../../drizzle/schema";
import { desc, eq, count } from "drizzle-orm";

export const partnerOnboardingRouter = router({
  validateInvite: protectedProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db)
        return { valid: true, partnerName: "Partner Corp", tier: "premium" };
      const [invite] = await db
        .select()
        .from(inviteCodes)
        .where(eq(inviteCodes.code, input.code))
        .limit(1);
      if (!invite) return { valid: false, partnerName: null, tier: null };
      return { valid: true, partnerName: invite.code, tier: "premium" };
    }),
  registerTenant: protectedProcedure
    .input(z.object({ name: z.string(), inviteCode: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { tenantId: `tenant_${Date.now()}`, name: input.name };
      const [row] = await db
        .insert(tenants)
        .values({ name: input.name, status: "active" } as any)
        .returning();
      return { tenantId: String(row.id), name: input.name };
    }),
  updateBranding: protectedProcedure
    .input(
      z.object({
        tenantId: z.string(),
        logo: z.string().optional(),
        primaryColor: z.string().optional(),
      })
    )
    .mutation(async () => {
      return { success: true };
    }),
  addCorridor: protectedProcedure
    .input(
      z.object({
        tenantId: z.string(),
        source: z.string(),
        destination: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db)
        return {
          id: `cor_${Date.now()}`,
          source: input.source,
          destination: input.destination,
        };
      const [row] = await db
        .insert(tenantCorridors)
        .values({
          tenantId: Number(input.tenantId),
          sourceCountry: input.source,
          destCountry: input.destination,
        } as any)
        .returning();
      return {
        id: String(row.id),
        source: input.source,
        destination: input.destination,
      };
    }),
  addFeeOverride: protectedProcedure
    .input(
      z.object({
        tenantId: z.string(),
        corridorId: z.string(),
        feePercent: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { id: `fee_${Date.now()}` };
      const [row] = await db
        .insert(tenantFeeOverrides)
        .values({
          tenantId: Number(input.tenantId),
          feeType: "corridor",
          feePercent: String(input.feePercent),
        } as any)
        .returning();
      return { id: String(row.id) };
    }),
  completeOnboarding: protectedProcedure
    .input(z.object({ tenantId: z.string() }))
    .mutation(async () => {
      return { success: true, status: "active" };
    }),
  getProgress: protectedProcedure
    .input(z.object({ tenantId: z.string() }))
    .query(async () => {
      return {
        step: 3,
        totalSteps: 5,
        completed: ["invite", "register", "branding"],
      };
    }),
  getBranding: protectedProcedure
    .input(z.object({ tenantId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db)
        return {
          logo: null,
          primaryColor: "#1a73e8",
          secondaryColor: "#ffffff",
        };
      const [row] = await db
        .select()
        .from(tenantBranding)
        .where(eq(tenantBranding.tenantId, Number(input.tenantId)))
        .limit(1);
      return (
        row ?? {
          logo: null,
          primaryColor: "#1a73e8",
          secondaryColor: "#ffffff",
        }
      );
    }),
  listCorridors: protectedProcedure
    .input(z.object({ tenantId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };
      const rows = await db
        .select()
        .from(tenantCorridors)
        .where(eq(tenantCorridors.tenantId, Number(input.tenantId)));
      return { items: rows, total: rows.length };
    }),
  listFees: protectedProcedure
    .input(z.object({ tenantId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };
      const rows = await db
        .select()
        .from(tenantFeeOverrides)
        .where(eq(tenantFeeOverrides.tenantId, Number(input.tenantId)));
      return { items: rows, total: rows.length };
    }),
  removeCorridor: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async () => {
      return { success: true };
    }),
  removeFee: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async () => {
      return { success: true };
    }),
});
