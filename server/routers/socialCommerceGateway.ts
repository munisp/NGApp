import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum } from "drizzle-orm";
import { transactions, merchants, auditLog } from "../../drizzle/schema";

export const socialCommerceGatewayRouter = router({
  listOrders: protectedProcedure.input(z.object({ limit: z.number().default(50), platform: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "social_commerce")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    return { orders: rows.map(r => ({ id: r.resourceId, action: r.action, status: r.status, metadata: r.metadata, timestamp: r.createdAt })), total: rows.length };
  }),
  createOrder: protectedProcedure.input(z.object({ merchantId: z.number(), platform: z.enum(["whatsapp", "instagram", "facebook", "tiktok"]), amount: z.number().positive(), items: z.array(z.object({ name: z.string(), qty: z.number(), price: z.number() })) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const orderId = "soc-" + crypto.randomUUID();
    await db.insert(auditLog).values({ action: "social_order_created", resource: "social_commerce", resourceId: orderId, status: "success", metadata: { merchantId: input.merchantId, platform: input.platform, amount: input.amount, itemCount: input.items.length } });
    return { orderId, platform: input.platform, amount: input.amount, status: "pending_payment" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "social_commerce"));
    return { totalOrders: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
