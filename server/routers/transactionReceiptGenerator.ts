import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
const templates = [
  { id: "TPL-1", name: "Standard POS Receipt", type: "thermal", format: "58mm", fields: ["merchant", "amount", "date", "reference", "status"], active: true, usageCount: 125000 },
  { id: "TPL-2", name: "Digital Email Receipt", type: "email", format: "html", fields: ["merchant", "amount", "date", "reference", "status", "items", "tax"], active: true, usageCount: 45000 },
  { id: "TPL-3", name: "SMS Receipt", type: "sms", format: "text", fields: ["amount", "reference", "status"], active: true, usageCount: 85000 },
  { id: "TPL-4", name: "WhatsApp Receipt", type: "whatsapp", format: "rich_text", fields: ["merchant", "amount", "date", "reference", "qr"], active: true, usageCount: 35000 },
  { id: "TPL-5", name: "PDF Invoice", type: "pdf", format: "a4", fields: ["merchant", "amount", "date", "reference", "items", "tax", "terms"], active: true, usageCount: 15000 },
];
export const transactionReceiptGeneratorRouter = router({
  getStats: protectedProcedure.query(async () => ({
    totalTemplates: 8, activeTemplates: 7, receiptsGenerated24h: 35000, totalReceipts: 5000000,
    deliveryRate: 99.2, avgGenerationTime: 150, popularTemplate: "Standard POS Receipt", failedDeliveries24h: 280,
  })),
  listTemplates: protectedProcedure.query(async () => ({ templates, total: templates.length })),
  generateReceipt: protectedProcedure.input(z.object({ transactionId: z.string(), templateId: z.string(), deliveryMethod: z.string() }))
    .mutation(async ({ input }) => ({ receiptId: `RCT-${Date.now()}`, transactionId: input.transactionId, template: input.templateId, delivery: input.deliveryMethod, status: "delivered", generatedAt: Date.now() })),
  createTemplate: protectedProcedure.input(z.object({ name: z.string(), type: z.string(), format: z.string(), fields: z.array(z.string()) }))
    .mutation(async ({ input }) => ({ id: `TPL-${Date.now()}`, ...input, active: true, createdAt: Date.now() })),
  previewTemplate: protectedProcedure.input(z.object({ templateId: z.string() }))
    .query(async ({ input }) => ({ templateId: input.templateId, preview: "<div>Receipt Preview</div>", sampleData: { merchant: "Sample Store", amount: 15000, date: new Date().toISOString(), reference: "TXN-SAMPLE" } })),
});
