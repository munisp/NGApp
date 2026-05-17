/**
 * Advanced Notification Engine Router
 * Multi-channel: email, SMS, push, in-app, WhatsApp
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

const notifState = {
  channels: [
    { id: "email", name: "Email", provider: "SendGrid", enabled: true, sentToday: 1245, deliveryRate: 99.2, avgLatencyMs: 850 },
    { id: "sms", name: "SMS", provider: "Twilio", enabled: true, sentToday: 3456, deliveryRate: 98.5, avgLatencyMs: 1200 },
    { id: "push", name: "Push Notification", provider: "Firebase FCM", enabled: true, sentToday: 8900, deliveryRate: 97.8, avgLatencyMs: 200 },
    { id: "inapp", name: "In-App", provider: "Internal", enabled: true, sentToday: 15600, deliveryRate: 100, avgLatencyMs: 15 },
    { id: "whatsapp", name: "WhatsApp", provider: "Meta Business API", enabled: true, sentToday: 2100, deliveryRate: 96.5, avgLatencyMs: 1500 },
  ],
  templates: [
    { id: "tpl-1", name: "Transaction Alert", channels: ["sms", "push", "inapp"], variables: ["amount", "agent_name", "transaction_id"], active: true },
    { id: "tpl-2", name: "Fraud Warning", channels: ["email", "sms", "push", "inapp"], variables: ["risk_score", "transaction_id", "details"], active: true },
    { id: "tpl-3", name: "Commission Earned", channels: ["push", "inapp"], variables: ["amount", "period", "agent_name"], active: true },
    { id: "tpl-4", name: "KYC Reminder", channels: ["email", "sms", "whatsapp"], variables: ["agent_name", "deadline", "documents_needed"], active: true },
    { id: "tpl-5", name: "System Maintenance", channels: ["email", "inapp"], variables: ["start_time", "end_time", "affected_services"], active: true },
    { id: "tpl-6", name: "Compliance Alert", channels: ["email", "sms", "push"], variables: ["regulation", "action_required", "deadline"], active: true },
  ],
  history: [] as Array<{ id: string; templateId: string; channel: string; recipient: string; status: string; sentAt: number; deliveredAt: number }>,
  preferences: [] as Array<{ userId: string; email: boolean; sms: boolean; push: boolean; inapp: boolean; whatsapp: boolean; quietHoursStart: number; quietHoursEnd: number }>,
};

for (let i = 0; i < 100; i++) {
  notifState.history.push({
    id: `notif-${i}`, templateId: notifState.templates[i % notifState.templates.length].id,
    channel: notifState.channels[i % notifState.channels.length].id,
    recipient: `user-${i % 20}@54link.com`, status: i === 15 ? "failed" : i === 30 ? "bounced" : "delivered",
    sentAt: Date.now() - i * 60000, deliveredAt: Date.now() - i * 60000 + 2000,
  });
}

export const advancedNotificationsRouter = router({
  dashboard: protectedProcedure.query(() => ({
    channels: notifState.channels,
    totalSentToday: notifState.channels.reduce((s: any, c: any) => s + c.sentToday, 0),
    overallDeliveryRate: +(notifState.channels.reduce((s: any, c: any) => s + c.deliveryRate, 0) / notifState.channels.length).toFixed(1),
    templateCount: notifState.templates.length,
  })),

  listTemplates: protectedProcedure.query(() => ({
    templates: notifState.templates,
    total: notifState.templates.length,
  })),

  sendNotification: protectedProcedure
    .input(z.object({ templateId: z.string(), channel: z.string(), recipient: z.string(), variables: z.record(z.string(), z.string()) }))
    .mutation(({ input }) => {
      const entry = { id: `notif-${Date.now()}`, templateId: input.templateId, channel: input.channel, recipient: input.recipient, status: "sent", sentAt: Date.now(), deliveredAt: 0 };
      notifState.history.unshift(entry);
      return { success: true, notificationId: entry.id };
    }),

  listHistory: protectedProcedure
    .input(z.object({ channel: z.string().optional(), limit: z.number().default(20) }))
    .query(({ input }) => {
      let hist = [...notifState.history];
      if (input.channel) hist = hist.filter(h => h.channel === input.channel);
      return { history: hist.slice(0, input.limit), total: hist.length };
    }),

  getPreferences: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(({ input }) => {
      const pref = notifState.preferences.find(p => p.userId === input.userId);
      return pref || { userId: input.userId, email: true, sms: true, push: true, inapp: true, whatsapp: false, quietHoursStart: 22, quietHoursEnd: 7 };
    }),

  updatePreferences: protectedProcedure
    .input(z.object({ userId: z.string(), email: z.boolean().optional(), sms: z.boolean().optional(), push: z.boolean().optional(), inapp: z.boolean().optional(), whatsapp: z.boolean().optional() }))
    .mutation(({ input }) => {
      const idx = notifState.preferences.findIndex(p => p.userId === input.userId);
      if (idx >= 0) Object.assign(notifState.preferences[idx], input);
      else notifState.preferences.push({ userId: input.userId, email: input.email ?? true, sms: input.sms ?? true, push: input.push ?? true, inapp: input.inapp ?? true, whatsapp: input.whatsapp ?? false, quietHoursStart: 22, quietHoursEnd: 7 });
      return { success: true } as any;
    }),
});
