import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { devices, auditLog } from "../../drizzle/schema";

export const cardRequestRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [];
    if (input?.status) conditions.push(eq(devices.status, input.status));
    const rows = await db.select().from(devices).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(devices.createdAt)).limit(input?.limit ?? 50);
    return { requests: rows, total: rows.length };
  }),
  submit: protectedProcedure.input(z.object({ agentId: z.number(), cardType: z.string().default("debit") })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const ref = "CARD-" + crypto.randomUUID().slice(0, 12).toUpperCase();
    await db.insert(auditLog).values({ action: "card_requested", resource: "card_request", resourceId: ref, status: "success", metadata: { agentId: input.agentId, cardType: input.cardType } });
    return { ref, agentId: input.agentId, cardType: input.cardType, status: "pending" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(devices);
    return { totalDevices: Number(total.value) };
  }),
});
