import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { qrCodes, auditLog } from "../../drizzle/schema";

export const dynamicQrPaymentRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [];
    if (input?.status) conditions.push(eq(qrCodes.status, input.status as any));
    const rows = await db.select().from(qrCodes).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(qrCodes.createdAt)).limit(input?.limit ?? 50);
    return { qrCodes: rows, total: rows.length };
  }),
  generate: protectedProcedure.input(z.object({ agentId: z.number(), amount: z.number().positive(), description: z.string().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const code = `QR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [qr] = await db.insert(qrCodes).values({ code, agentId: input.agentId, type: "payment", status: "active", amount: String(input.amount), description: input.description ?? "Dynamic QR Payment" } as any).returning();
    await db.insert(auditLog).values({ action: "qr_code_generated", resource: "qr_codes", resourceId: String(qr.id), status: "success", metadata: { agentId: input.agentId, amount: input.amount } });
    return { id: qr.id, agentId: input.agentId, amount: input.amount, status: "active" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(qrCodes);
    const [active] = await db.select({ value: count() }).from(qrCodes).where(eq(qrCodes.status, "active" as any));
    return { totalCodes: Number(total.value), activeCodes: Number(active.value) };
  }),
});
