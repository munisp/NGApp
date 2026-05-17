/**
 * WhatsApp Notification Channel — Template management, send, delivery status
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

interface WhatsAppTemplate {
  id: string; name: string; category: "transaction" | "marketing" | "alert" | "otp";
  language: string; body: string; variables: string[]; status: "approved" | "pending" | "rejected";
  usageCount: number; createdAt: number;
}

interface WhatsAppMessage {
  id: string; templateId: string; recipientPhone: string; recipientName: string;
  variables: Record<string, string>; status: "sent" | "delivered" | "read" | "failed";
  sentAt: number; deliveredAt: number | null; readAt: number | null; errorMessage: string | null;
}

const templates: WhatsAppTemplate[] = [
  { id: "WAT-001", name: "transaction_receipt", category: "transaction", language: "en", body: "Hi {{1}}, your {{2}} of NGN {{3}} was successful. Ref: {{4}}", variables: ["name", "type", "amount", "reference"], status: "approved", usageCount: 1250, createdAt: Date.now() - 60 * 86400000 },
  { id: "WAT-002", name: "low_float_alert", category: "alert", language: "en", body: "Alert: Your float balance is NGN {{1}}. Top up to continue serving customers.", variables: ["balance"], status: "approved", usageCount: 340, createdAt: Date.now() - 50 * 86400000 },
  { id: "WAT-003", name: "commission_payout", category: "transaction", language: "en", body: "Hi {{1}}, your commission of NGN {{2}} for {{3}} has been credited.", variables: ["name", "amount", "period"], status: "approved", usageCount: 890, createdAt: Date.now() - 40 * 86400000 },
  { id: "WAT-004", name: "kyc_reminder", category: "alert", language: "en", body: "Reminder: Your KYC documents expire on {{1}}. Please update at your nearest branch.", variables: ["expiry_date"], status: "approved", usageCount: 120, createdAt: Date.now() - 30 * 86400000 },
  { id: "WAT-005", name: "otp_verification", category: "otp", language: "en", body: "Your 54Link verification code is {{1}}. Valid for 5 minutes.", variables: ["otp_code"], status: "approved", usageCount: 5600, createdAt: Date.now() - 90 * 86400000 },
  { id: "WAT-006", name: "promo_campaign", category: "marketing", language: "en", body: "Hi {{1}}! Earn 2x commission this weekend on all cash-in transactions. T&C apply.", variables: ["name"], status: "pending", usageCount: 0, createdAt: Date.now() - 5 * 86400000 },
];

const messages: WhatsAppMessage[] = [];
for (let i = 1; i <= 50; i++) {
  const tpl = templates[i % templates.length];
  messages.push({
    id: `WAM-${String(i).padStart(5, "0")}`,
    templateId: tpl.id,
    recipientPhone: `+234${String(8010000000 + i * 1111).slice(0, 10)}`,
    recipientName: `Customer ${i}`,
    variables: tpl.variables.reduce((a, v, idx) => { a[v] = `value_${idx}`; return a; }, {} as Record<string, string>),
    status: i % 10 === 0 ? "failed" : i % 3 === 0 ? "read" : i % 2 === 0 ? "delivered" : "sent",
    sentAt: Date.now() - i * 3600000,
    deliveredAt: i % 10 !== 0 ? Date.now() - i * 3600000 + 5000 : null,
    readAt: i % 3 === 0 ? Date.now() - i * 3600000 + 60000 : null,
    errorMessage: i % 10 === 0 ? "Phone number not registered on WhatsApp" : null,
  });
}

export const whatsappChannelRouter = router({
  templates: protectedProcedure
    .input(z.object({ category: z.string().optional(), status: z.string().optional() }).optional())
    .query(({ input }) => {
      let filtered = [...templates];
      if (input?.category) filtered = filtered.filter(t => t.category === input.category);
      if (input?.status) filtered = filtered.filter(t => t.status === input.status);
      return { templates: filtered, total: filtered.length };
    }),

  createTemplate: protectedProcedure
    .input(z.object({ name: z.string(), category: z.enum(["transaction", "marketing", "alert", "otp"]), language: z.string().default("en"), body: z.string(), variables: z.array(z.string()) }))
    .mutation(({ input }) => {
      const tpl: WhatsAppTemplate = { id: `WAT-${String(templates.length + 1).padStart(3, "0")}`, ...input, status: "pending", usageCount: 0, createdAt: Date.now() };
      templates.push(tpl);
      return { success: true, template: tpl };
    }),

  send: protectedProcedure
    .input(z.object({ templateId: z.string(), recipientPhone: z.string(), recipientName: z.string(), variables: z.record(z.string(), z.string()) }))
    .mutation(({ input }) => {
      const tpl = templates.find(t => t.id === input.templateId);
      if (!tpl || tpl.status !== "approved") return { success: false, error: "Template not approved" };
      const msg: WhatsAppMessage = {
        id: `WAM-${String(messages.length + 1).padStart(5, "0")}`,
        templateId: input.templateId, recipientPhone: input.recipientPhone,
        recipientName: input.recipientName, variables: input.variables,
        status: "sent", sentAt: Date.now(), deliveredAt: null, readAt: null, errorMessage: null,
      };
      messages.push(msg);
      tpl.usageCount++;
      return { success: true, message: msg };
    }),

  messages: protectedProcedure
    .input(z.object({ templateId: z.string().optional(), status: z.string().optional(), limit: z.number().default(30) }).optional())
    .query(({ input }) => {
      let filtered = [...messages].sort((a: any, b: any) => b.sentAt - a.sentAt);
      if (input?.templateId) filtered = filtered.filter(m => m.templateId === input.templateId);
      if (input?.status) filtered = filtered.filter(m => m.status === input.status);
      return { messages: filtered.slice(0, input?.limit ?? 30), total: filtered.length };
    }),

  analytics: protectedProcedure.query(() => ({
    totalSent: messages.length,
    delivered: messages.filter(m => m.status === "delivered" || m.status === "read").length,
    read: messages.filter(m => m.status === "read").length,
    failed: messages.filter(m => m.status === "failed").length,
    deliveryRate: messages.length > 0 ? Math.round(messages.filter(m => m.status !== "failed").length / messages.length * 100) : 0,
    readRate: messages.length > 0 ? Math.round(messages.filter(m => m.status === "read").length / messages.length * 100) : 0,
    templateCount: templates.length,
    approvedTemplates: templates.filter(t => t.status === "approved").length,
  })),
});
