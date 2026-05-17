import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
const featureFlags = [
  { id: "FF-001", key: "white_label_onboarding", name: "White-Label Onboarding", description: "Enable partner self-service onboarding", enabled: true, rolloutPercentage: 100, targetPartners: ["all"], targetRegions: ["all"], createdAt: "2026-01-15T10:00:00Z", updatedAt: "2026-04-01T14:00:00Z", owner: "product@54link.com" },
  { id: "FF-002", key: "nl_query_engine", name: "Natural Language Query", description: "AI-powered financial data queries", enabled: true, rolloutPercentage: 50, targetPartners: ["WL-001", "WL-003"], targetRegions: ["Lagos", "Abuja"], createdAt: "2026-03-01T08:00:00Z", updatedAt: "2026-04-15T10:00:00Z", owner: "engineering@54link.com" },
  { id: "FF-003", key: "gamification_v2", name: "Agent Gamification v2", description: "Enhanced gamification with team challenges", enabled: false, rolloutPercentage: 0, targetPartners: [], targetRegions: [], createdAt: "2026-04-10T12:00:00Z", updatedAt: "2026-04-10T12:00:00Z", owner: "product@54link.com" },
  { id: "FF-004", key: "bulk_processing", name: "Bulk Transaction Processing", description: "Batch upload and processing", enabled: true, rolloutPercentage: 75, targetPartners: ["all"], targetRegions: ["Lagos", "Abuja", "Kano"], createdAt: "2026-02-20T09:00:00Z", updatedAt: "2026-04-18T16:00:00Z", owner: "engineering@54link.com" },
];
export const platformFeatureFlagsRouter = router({
  getStats: protectedProcedure.query(() => ({ totalFlags: featureFlags.length, enabledFlags: featureFlags.filter(f => f.enabled).length, avgRollout: "56%", recentChanges: 3 })),
  listFlags: protectedProcedure.input(z.object({ enabled: z.boolean().optional(), search: z.string().optional() }).optional()).query(({ input }) => { let flags = [...featureFlags]; if (input?.enabled !== undefined) flags = flags.filter(f => f.enabled === input.enabled); if (input?.search) flags = flags.filter(f => f.name.toLowerCase().includes(input.search!.toLowerCase())); return { flags, total: flags.length }; }),
  getFlag: protectedProcedure.input(z.object({ key: z.string() })).query(({ input }) => featureFlags.find(f => f.key === input.key) || null),
  toggleFlag: protectedProcedure.input(z.object({ flagId: z.string(), enabled: z.boolean() })).mutation(({ input }) => ({ success: true, flagId: input.flagId, enabled: input.enabled, updatedAt: new Date().toISOString() })),
  updateRollout: protectedProcedure.input(z.object({ flagId: z.string(), percentage: z.number().min(0).max(100) })).mutation(({ input }) => ({ success: true, flagId: input.flagId, rolloutPercentage: input.percentage })),
  checkFlag: protectedProcedure.input(z.object({ key: z.string(), partnerId: z.string().optional(), region: z.string().optional() })).query(({ input }) => { const flag = featureFlags.find(f => f.key === input.key); return { key: input.key, enabled: flag?.enabled || false, rolloutPercentage: flag?.rolloutPercentage || 0 }; }),
});
