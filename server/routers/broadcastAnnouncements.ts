import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { db } from "../db";

const ANNOUNCEMENT_TYPES = ["info", "warning", "critical", "maintenance", "feature"] as const;
const TARGET_AUDIENCES = ["all", "agents", "admins", "merchants"] as const;
const CHANNELS = ["banner", "inbox", "push"] as const;

const seedData = [
  { id: "ann_001", title: "System Maintenance", type: "maintenance" as const, target: "all" as const, pinned: true, channels: ["banner", "inbox"] },
  { id: "ann_002", title: "New Feature", type: "feature" as const, target: "agents" as const, pinned: false, channels: ["inbox", "push"] },
  { id: "ann_003", title: "Security Update", type: "critical" as const, target: "admins" as const, pinned: true, channels: ["banner", "inbox", "push"] },
  { id: "ann_004", title: "Rate Change", type: "warning" as const, target: "merchants" as const, pinned: false, channels: ["inbox"] },
  { id: "ann_005", title: "Welcome Message", type: "info" as const, target: "all" as const, pinned: false, channels: ["banner"] },
];

export const broadcastAnnouncementsRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().optional(), offset: z.number().optional() }).optional()).query(async ({ input }) => {
    return { items: seedData, total: seedData.length };
  }),
  create: protectedProcedure.input(z.object({
    title: z.string(), body: z.string().optional(), type: z.enum(ANNOUNCEMENT_TYPES),
    target: z.enum(TARGET_AUDIENCES), channels: z.array(z.enum(CHANNELS)).optional(),
  })).mutation(async ({ input }) => {
    return { id: `ann_${Date.now()}`, ...input, pinned: false, createdAt: new Date().toISOString() };
  }),
  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    return { success: true };
  }),
  togglePin: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    return { success: true };
  }),
  dismiss: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    return { success: true };
  }),
  stats: protectedProcedure.query(async () => {
    return { total: seedData.length, pinned: seedData.filter(a => a.pinned).length, byType: { info: 1, warning: 1, critical: 1, maintenance: 1, feature: 1 } };
  }),
});
