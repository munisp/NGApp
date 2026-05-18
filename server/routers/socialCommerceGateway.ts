import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { transactions, merchants, auditLog } from "../../drizzle/schema";

export const socialCommerceGatewayRouter = router({
  listOrders: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), platform: z.enum(["whatsapp", "instagram", "facebook", "tiktok"]).optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(transactions).where(eq(transactions.channel, "App")).orderBy(desc(transactions.createdAt)).limit(input?.limit ?? 50);
    return { orders: rows, total: rows.length };
  }),
  createOrder: protectedProcedure.input(z.object({ merchantId: z.number(), platform: z.enum(["whatsapp", "instagram", "facebook", "tiktok"]), amount: z.number().positive().max(10_000_000), items: z.array(z.object({ name: z.string().min(1).max(128), qty: z.number().int().positive(), price: z.number().positive() })).min(1).max(50) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [merchant] = await db.select().from(merchants).where(eq(merchants.id, input.merchantId)).limit(1);
    if (!merchant) throw new Error("Merchant not found");
    const itemTotal = input.items.reduce((s, i) => s + i.qty * i.price, 0);
    if (Math.abs(itemTotal - input.amount) > 1) throw new Error("Amount mismatch with item total");
    const orderId = "SOC-" + crypto.randomUUID().slice(0, 12).toUpperCase();
    const [tx] = await db.insert(transactions).values({ agentId: 0, amount: String(input.amount), type: "Transfer", status: "pending", channel: "App", reference: orderId }).returning();
    await db.insert(auditLog).values({ action: "social_order_created", resource: "social_commerce", resourceId: orderId, status: "success", metadata: { merchantId: input.merchantId, platform: input.platform, amount: input.amount, itemCount: input.items.length, transactionId: tx.id } });
    return { orderId, transactionId: tx.id, platform: input.platform, amount: input.amount, status: "pending_payment" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [stats] = await db.select({ totalOrders: count(), totalVolume: sum(sql`CAST(amount AS numeric)`) }).from(transactions).where(eq(transactions.channel, "App"));
    return { totalOrders: Number(stats.totalOrders), totalVolume: Number(stats.totalVolume ?? 0) };
  }),
});
