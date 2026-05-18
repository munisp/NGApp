import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { desc, eq, count } from "drizzle-orm";
import { agentOnboardingProgress, auditLog } from "../../drizzle/schema";

export const agentOnboardingWorkflowRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), step: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [];
    if (input?.step) conditions.push(eq(agentOnboardingProgress.currentStep, input.step as any));
    const rows = await db.select().from(agentOnboardingProgress).where(conditions.length ? conditions[0] : undefined).orderBy(desc(agentOnboardingProgress.createdAt)).limit(input?.limit ?? 50);
    const [total] = await db.select({ value: count() }).from(agentOnboardingProgress);
    return { workflows: rows, total: Number(total.value) };
  }),
  advance: protectedProcedure.input(z.object({ agentId: z.number(), step: z.string() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const stepMap: Record<string, any> = { kyc: { kycComplete: true }, float: { floatFunded: true }, terminal: { terminalAssigned: true }, training: { trainingComplete: true } };
    const updates = stepMap[input.step] ?? {};
    const [updated] = await db.update(agentOnboardingProgress).set({ ...updates, currentStep: input.step as any, updatedAt: new Date() }).where(eq(agentOnboardingProgress.agentId, input.agentId)).returning();
    await db.insert(auditLog).values({ action: "onboarding_step_advanced", resource: "agent_onboarding_progress", resourceId: String(input.agentId), status: "success", metadata: { step: input.step } });
    return { success: true, agentId: input.agentId, currentStep: input.step, updated };
  }),
});
