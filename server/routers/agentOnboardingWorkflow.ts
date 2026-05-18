import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { desc, eq, count } from "drizzle-orm";
import { agentOnboardingProgress, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const agentOnboardingWorkflowRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), step: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const conditions = [];
      if (input?.step) conditions.push(eq(agentOnboardingProgress.currentStep, input.step));
      const rows = await db.select().from(agentOnboardingProgress).where(conditions.length ? conditions[0] : undefined).orderBy(desc(agentOnboardingProgress.createdAt)).limit(input?.limit ?? 50);
      const [total] = await db.select({ value: count() }).from(agentOnboardingProgress).limit(100);
      return { workflows: rows, total: Number(total.value) };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  advance: protectedProcedure.input(z.object({ agentId: z.number(), step: z.string() })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const stepMap: Record<string, any> = { kyc: { kycComplete: true }, float: { floatFunded: true }, terminal: { terminalAssigned: true }, training: { trainingComplete: true } };
      const updates = stepMap[input.step] ?? {};
      const [updated] = await db.update(agentOnboardingProgress).set({ ...updates, currentStep: input.step, updatedAt: new Date() }).where(eq(agentOnboardingProgress.agentId, input.agentId)).returning();
      await db.insert(auditLog).values({ action: "onboarding_step_advanced", resource: "agent_onboarding_progress", resourceId: String(input.agentId), status: "success", metadata: { step: input.step } });
      return { success: true, agentId: input.agentId, currentStep: input.step, updated };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
});
