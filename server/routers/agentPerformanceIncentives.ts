import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
const incentives = [
  { id: "INC-001", agentId: "AGT-001", agentName: "Adebayo Ogundimu", tier: "Platinum", points: 12500, monthlyTarget: 500, monthlyActual: 620, achievement: 124, rewards: [{ type: "cash_bonus", amount: 150000, status: "paid" }, { type: "device_upgrade", value: "PAX A920 Pro", status: "delivered" }], rank: 1 },
  { id: "INC-002", agentId: "AGT-003", agentName: "Ibrahim Musa", tier: "Gold", points: 9800, monthlyTarget: 400, monthlyActual: 450, achievement: 112.5, rewards: [{ type: "cash_bonus", amount: 100000, status: "paid" }], rank: 2 },
  { id: "INC-003", agentId: "AGT-002", agentName: "Chioma Eze", tier: "Gold", points: 8500, monthlyTarget: 400, monthlyActual: 380, achievement: 95, rewards: [{ type: "float_boost", amount: 500000, status: "credited" }], rank: 3 },
  { id: "INC-004", agentId: "AGT-004", agentName: "Fatima Bello", tier: "Silver", points: 5200, monthlyTarget: 300, monthlyActual: 280, achievement: 93.3, rewards: [], rank: 4 },
  { id: "INC-005", agentId: "AGT-005", agentName: "Ngozi Obi", tier: "Bronze", points: 2100, monthlyTarget: 200, monthlyActual: 150, achievement: 75, rewards: [], rank: 5 },
];
export const agentPerformanceIncentivesRouter = router({
  getStats: protectedProcedure.query(() => ({ totalAgents: incentives.length, platinumAgents: incentives.filter(i => i.tier === "Platinum").length, goldAgents: incentives.filter(i => i.tier === "Gold").length, silverAgents: incentives.filter(i => i.tier === "Silver").length, totalPointsIssued: incentives.reduce((s: any, i: any) => s + i.points, 0), totalRewardsValue: 750000, avgAchievement: incentives.reduce((s: any, i: any) => s + i.achievement, 0) / incentives.length, topPerformer: "Adebayo Ogundimu" })),
  listIncentives: protectedProcedure.query(() => ({ incentives, total: incentives.length })),
  getIncentive: protectedProcedure.input(z.object({ agentId: z.string() })).query(({ input }) => incentives.find(i => i.agentId === input.agentId) || null),
  awardPoints: protectedProcedure.input(z.object({ agentId: z.string(), points: z.number(), reason: z.string() })).mutation(({ input }) => ({ awardId: "AWD-" + Date.now(), ...input, newTotal: (incentives.find(i => i.agentId === input.agentId)?.points || 0) + input.points })),
  redeemReward: protectedProcedure.input(z.object({ agentId: z.string(), rewardType: z.string(), pointsCost: z.number() })).mutation(({ input }) => ({ redemptionId: "RDM-" + Date.now(), ...input, status: "processing" })),
});
