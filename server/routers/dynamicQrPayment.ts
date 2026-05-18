import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { qrCodes, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const dynamicQrPaymentRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const conditions = [];
      if (input?.status) conditions.push(eq(qrCodes.status, input.status as any));
      const rows = await db.select().from(qrCodes).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(qrCodes.createdAt)).limit(input?.limit ?? 50);
      return { qrCodes: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  generate: protectedProcedure.input(z.object({ agentId: z.number(), amount: z.number().positive(), description: z.string().optional() })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const code = `QR-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
      const [qr] = await db.insert(qrCodes).values({ code, agentId: input.agentId, type: "payment", status: "active", amount: String(input.amount), currency: "NGN", description: input.description ?? "Dynamic QR Payment" } as any).returning();
      await db.insert(auditLog).values({ action: "qr_code_generated", resource: "qr_codes", resourceId: String(qr.id), status: "success", metadata: { agentId: input.agentId, amount: input.amount } });
      return { id: qr.id, agentId: input.agentId, amount: input.amount, status: "active" };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(qrCodes).limit(100);
    const [active] = await db.select({ value: count() }).from(qrCodes).where(eq(qrCodes.status, "active" as any)).limit(100);
    return { totalCodes: Number(total.value), activeCodes: Number(active.value) };
  }),
});
