import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
const atRiskAgents = [
  { id: "AGT-045", name: "Bola Adewale", churnProbability: 0.87, riskFactors: ["Declining transaction volume", "No login in 14 days", "Commission disputes"], recommendedAction: "Personal outreach + bonus incentive", region: "Lagos", lastActive: "2026-04-07" },
  { id: "AGT-112", name: "Musa Abdullahi", churnProbability: 0.73, riskFactors: ["Float depletion", "Competitor POS detected nearby"], recommendedAction: "Float top-up + territory protection", region: "Kano", lastActive: "2026-04-12" },
  { id: "AGT-089", name: "Ngozi Obi", churnProbability: 0.65, riskFactors: ["Low commission earnings", "Support tickets unresolved"], recommendedAction: "Commission review + priority support", region: "Enugu", lastActive: "2026-04-15" },
  { id: "AGT-201", name: "Yusuf Ibrahim", churnProbability: 0.58, riskFactors: ["Hardware issues reported", "Seasonal volume drop"], recommendedAction: "Device replacement + seasonal float plan", region: "Abuja", lastActive: "2026-04-18" },
  { id: "AGT-156", name: "Amina Suleiman", churnProbability: 0.52, riskFactors: ["New competitor in area", "Reduced marketing support"], recommendedAction: "Co-marketing campaign + loyalty bonus", region: "Kaduna", lastActive: "2026-04-16" },
];
export const predictiveAgentChurnRouter = router({
  getStats: protectedProcedure.query(() => ({ totalAgents: 1250, atRiskCount: atRiskAgents.length, avgChurnRate: 4.2, predictedChurnNext30d: 18, retentionRate: 95.8, modelAccuracy: 91.3, interventionSuccessRate: 78.5, savedRevenueYTD: 45000000 })),
  listAtRisk: protectedProcedure.input(z.object({ minProbability: z.number().default(0.5) })).query(({ input }) => ({ agents: atRiskAgents.filter(a => a.churnProbability >= input.minProbability), total: atRiskAgents.length })),
  getAgentRisk: protectedProcedure.input(z.object({ agentId: z.string() })).query(({ input }) => atRiskAgents.find(a => a.id === input.agentId) || null),
  triggerIntervention: protectedProcedure.input(z.object({ agentId: z.string(), interventionType: z.string(), notes: z.string().optional() })).mutation(({ input }) => ({ interventionId: `INT-${Date.now()}`, status: "initiated", agentId: input.agentId, type: input.interventionType, estimatedImpact: "-15% churn probability" })),
  getModelMetrics: protectedProcedure.query(() => ({ precision: 0.89, recall: 0.92, f1Score: 0.905, auc: 0.94, trainingData: "18 months", features: 42, lastTrained: "2 hours ago", nextRetrain: "22 hours" })),
});
