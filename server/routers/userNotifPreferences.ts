import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

const CATEGORIES = [
  { id: "txn_success", group: "Transactions", label: "Transaction Success" },
  { id: "txn_failed", group: "Transactions", label: "Transaction Failed" },
  { id: "txn_reversal", group: "Transactions", label: "Transaction Reversal" },
  { id: "txn_limit", group: "Transactions", label: "Limit Reached" },
  { id: "sec_fraud", group: "Security", label: "Fraud Alert" },
  { id: "sec_login", group: "Security", label: "Login Alert" },
  { id: "sec_password", group: "Security", label: "Password Change" },
  { id: "sec_device", group: "Security", label: "New Device" },
  { id: "fin_settlement", group: "Financial", label: "Settlement" },
  { id: "fin_commission", group: "Financial", label: "Commission" },
  { id: "fin_float", group: "Financial", label: "Float Alert" },
  { id: "fin_invoice", group: "Financial", label: "Invoice" },
  { id: "sys_maintenance", group: "System", label: "Maintenance" },
  { id: "sys_update", group: "System", label: "System Update" },
  { id: "sys_downtime", group: "System", label: "Downtime" },
  { id: "sys_announcement", group: "System", label: "Announcement" },
];

const channelSchema = z.object({
  email: z.boolean(),
  sms: z.boolean(),
  push: z.boolean(),
  inApp: z.boolean(),
});

export const userNotifPreferencesRouter = router({
  list: protectedProcedure.query(async () => {
    return { categories: CATEGORIES, preferences: CATEGORIES.map(c => ({ categoryId: c.id, channels: { email: true, sms: true, push: true, inApp: true } })) };
  }),
  update: protectedProcedure.input(z.object({ categoryId: z.string(), channels: channelSchema })).mutation(async ({ input }) => {
    return { success: true, categoryId: input.categoryId };
  }),
  bulkUpdate: protectedProcedure.input(z.object({ updates: z.array(z.object({ categoryId: z.string(), channels: channelSchema })) })).mutation(async ({ input }) => {
    return { success: true, updated: input.updates.length };
  }),
  resetToDefaults: protectedProcedure.mutation(async () => {
    return { success: true };
  }),
  enableAllForChannel: protectedProcedure.input(z.object({ channel: z.enum(["email", "sms", "push", "inApp"]) })).mutation(async ({ input }) => {
    return { success: true, channel: input.channel };
  }),
  updateQuietHours: protectedProcedure.input(z.object({ enabled: z.boolean(), start: z.string().optional(), end: z.string().optional() })).mutation(async ({ input }) => {
    return { success: true };
  }),
  updateDigestMode: protectedProcedure.input(z.object({ mode: z.enum(["instant", "hourly", "daily"]) })).mutation(async ({ input }) => {
    return { success: true, mode: input.mode };
  }),

  categories: protectedProcedure.query(async () => {
    return { items: [], total: 0 };
  }),
  getPreferences: protectedProcedure.query(async () => {
    return { items: [], total: 0 };
  }),
  updateCategory: protectedProcedure.input(z.object({})).mutation(async () => {
    return { success: true };
  }),
});
