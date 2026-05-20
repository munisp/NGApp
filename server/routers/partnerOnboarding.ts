import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

export const partnerOnboardingRouter = router({
  validateInvite: protectedProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      return { valid: true, partnerName: "Partner Corp", tier: "premium" };
    }),
  registerTenant: protectedProcedure
    .input(z.object({ name: z.string(), inviteCode: z.string() }))
    .mutation(async ({ input }) => {
      return { tenantId: `tenant_${Date.now()}`, name: input.name };
    }),
  updateBranding: protectedProcedure
    .input(
      z.object({
        tenantId: z.string(),
        logo: z.string().optional(),
        primaryColor: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
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
      return {
        id: `cor_${Date.now()}`,
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
      return { id: `fee_${Date.now()}` };
    }),
  completeOnboarding: protectedProcedure
    .input(z.object({ tenantId: z.string() }))
    .mutation(async ({ input }) => {
      return { success: true, status: "active" };
    }),
  getProgress: protectedProcedure
    .input(z.object({ tenantId: z.string() }))
    .query(async ({ input }) => {
      return {
        step: 3,
        totalSteps: 5,
        completed: ["invite", "register", "branding"],
      };
    }),
  getBranding: protectedProcedure
    .input(z.object({ tenantId: z.string() }))
    .query(async ({ input }) => {
      return { logo: null, primaryColor: "#1a73e8", secondaryColor: "#ffffff" };
    }),
  listCorridors: protectedProcedure
    .input(z.object({ tenantId: z.string() }))
    .query(async ({ input }) => {
      return { items: [], total: 0 };
    }),
  listFees: protectedProcedure
    .input(z.object({ tenantId: z.string() }))
    .query(async ({ input }) => {
      return { items: [], total: 0 };
    }),
  removeCorridor: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return { success: true };
    }),
  removeFee: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return { success: true };
    }),
});
