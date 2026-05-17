import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
const channels = [
  { id: "CH-001", name: "SMS", provider: "Twilio", status: "active", sentToday: 12500, deliveryRate: 98.5, avgLatency: "2.1s", costPerMessage: 4.50, monthlyBudget: 5000000, monthlySpent: 3200000 },
  { id: "CH-002", name: "Email", provider: "SendGrid", status: "active", sentToday: 8500, deliveryRate: 99.2, avgLatency: "1.5s", costPerMessage: 0.50, monthlyBudget: 500000, monthlySpent: 280000 },
  { id: "CH-003", name: "Push Notification", provider: "Firebase", status: "active", sentToday: 25000, deliveryRate: 95.8, avgLatency: "0.8s", costPerMessage: 0.10, monthlyBudget: 200000, monthlySpent: 150000 },
  { id: "CH-004", name: "WhatsApp", provider: "Meta Business", status: "active", sentToday: 6500, deliveryRate: 97.5, avgLatency: "3.2s", costPerMessage: 8.00, monthlyBudget: 8000000, monthlySpent: 5200000 },
  { id: "CH-005", name: "In-App", provider: "Internal", status: "active", sentToday: 45000, deliveryRate: 100, avgLatency: "0.1s", costPerMessage: 0, monthlyBudget: 0, monthlySpent: 0 },
];
export const multiChannelNotificationHubRouter = router({
  getStats: protectedProcedure.query(() => ({ totalChannels: channels.length, activeChannels: channels.filter(c => c.status === "active").length, totalSentToday: channels.reduce((s: any, c: any) => s + c.sentToday, 0), avgDeliveryRate: channels.reduce((s: any, c: any) => s + c.deliveryRate, 0) / channels.length, totalMonthlySpent: channels.reduce((s: any, c: any) => s + c.monthlySpent, 0), budgetUtilization: 64.5, failedDeliveries: 450, queuedMessages: 120 })),
  listChannels: protectedProcedure.query(() => ({ channels, total: channels.length })),
  getChannel: protectedProcedure.input(z.object({ channelId: z.string() })).query(({ input }) => channels.find(c => c.id === input.channelId) || null),
  sendNotification: protectedProcedure.input(z.object({ channels: z.array(z.string()), recipients: z.array(z.string()), title: z.string(), body: z.string() })).mutation(({ input }) => ({ notificationId: "NOTIF-" + Date.now(), status: "queued", channelCount: input.channels.length, recipientCount: input.recipients.length })),
  getDeliveryReport: protectedProcedure.input(z.object({ notificationId: z.string() })).query(({ input }) => ({ notificationId: input.notificationId, delivered: 95, failed: 3, pending: 2, channels: [{ name: "SMS", delivered: 45, failed: 2 }, { name: "Push", delivered: 50, failed: 1 }] })),
});
