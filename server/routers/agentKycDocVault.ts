import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
const documents = [
  { id: "DOC-001", agentId: "AGT-001", type: "NIN", documentNumber: "12345678901", status: "verified", ocrConfidence: 98.5, uploadedAt: "2026-01-15", verifiedAt: "2026-01-15", expiresAt: "2031-01-15", verifiedBy: "AI-OCR" },
  { id: "DOC-002", agentId: "AGT-001", type: "BVN", documentNumber: "22345678901", status: "verified", ocrConfidence: 99.1, uploadedAt: "2026-01-15", verifiedAt: "2026-01-15", expiresAt: null, verifiedBy: "NIBSS" },
  { id: "DOC-003", agentId: "AGT-002", type: "Utility Bill", documentNumber: "UB-2026-001", status: "pending", ocrConfidence: 85.2, uploadedAt: "2026-04-20", verifiedAt: null, expiresAt: "2026-07-20", verifiedBy: null },
  { id: "DOC-004", agentId: "AGT-003", type: "CAC Certificate", documentNumber: "RC-123456", status: "verified", ocrConfidence: 97.8, uploadedAt: "2025-11-01", verifiedAt: "2025-11-02", expiresAt: "2027-11-01", verifiedBy: "Manual" },
  { id: "DOC-005", agentId: "AGT-005", type: "NIN", documentNumber: "98765432101", status: "rejected", ocrConfidence: 45.3, uploadedAt: "2026-04-18", verifiedAt: null, expiresAt: null, verifiedBy: null },
];
export const agentKycDocVaultRouter = router({
  getStats: protectedProcedure.query(() => ({ totalDocuments: documents.length, verified: documents.filter(d => d.status === "verified").length, pending: documents.filter(d => d.status === "pending").length, rejected: documents.filter(d => d.status === "rejected").length, avgOcrConfidence: 85.2, documentTypes: 4, expiringIn30Days: 1, complianceRate: 92.5 })),
  listDocuments: protectedProcedure.input(z.object({ agentId: z.string().optional(), status: z.string().optional() })).query(({ input }) => ({ documents: documents.filter(d => (!input.agentId || d.agentId === input.agentId) && (!input.status || d.status === input.status)), total: documents.length })),
  getDocument: protectedProcedure.input(z.object({ documentId: z.string() })).query(({ input }) => documents.find(d => d.id === input.documentId) || null),
  uploadDocument: protectedProcedure.input(z.object({ agentId: z.string(), type: z.string(), documentNumber: z.string() })).mutation(({ input }) => ({ documentId: "DOC-" + Date.now(), status: "processing_ocr", ...input, ocrJobId: "OCR-" + Date.now() })),
  verifyDocument: protectedProcedure.input(z.object({ documentId: z.string(), decision: z.enum(["approve", "reject"]), notes: z.string().optional() })).mutation(({ input }) => ({ documentId: input.documentId, status: input.decision === "approve" ? "verified" : "rejected", verifiedAt: new Date().toISOString() })),
});
