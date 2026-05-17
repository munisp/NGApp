import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { kycDocuments, auditLog } from "../../drizzle/schema";

export const agentKycDocVaultRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalDocuments: 0, verified: 0, pending: 0, rejected: 0 };
    const [total] = await db.select({ value: count() }).from(kycDocuments);
    return { totalDocuments: Number(total.value), verified: 0, pending: Number(total.value), rejected: 0 };
  }),
  listDocuments: protectedProcedure.input(z.object({ agentId: z.number().optional(), limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { documents: [], total: 0 };
    const conditions: any[] = [];
    if (input?.agentId) conditions.push(eq(kycDocuments.agentId, input.agentId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db.select().from(kycDocuments).where(where).orderBy(desc(kycDocuments.createdAt)).limit(input?.limit ?? 20);
    return { documents: rows, total: rows.length };
  }),
  uploadDocument: protectedProcedure.input(z.object({ agentId: z.number(), docType: z.string(), docUrl: z.string(), docNumber: z.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const [doc] = await db.insert(kycDocuments).values({ agentId: input.agentId, docType: input.docType, docUrl: input.docUrl, docNumber: input.docNumber ?? "", status: "pending" }).returning();
    await db.insert(auditLog).values({ action: "kyc_doc_uploaded", resource: "kyc_documents", resourceId: String(doc.id), status: "success", metadata: { agentId: input.agentId, docType: input.docType } });
    return { success: true, document: doc };
  }),
  verifyDocument: protectedProcedure.input(z.object({ documentId: z.number(), verified: z.boolean(), notes: z.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const [updated] = await db.update(kycDocuments).set({ status: input.verified ? "verified" : "rejected", verifiedAt: input.verified ? new Date() : undefined }).where(eq(kycDocuments.id, input.documentId)).returning();
    await db.insert(auditLog).values({ action: input.verified ? "kyc_doc_verified" : "kyc_doc_rejected", resource: "kyc_documents", resourceId: String(input.documentId), status: "success" });
    return { success: true, document: updated };
  }),
});
