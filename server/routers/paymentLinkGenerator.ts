import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { shareableLinks, auditLog } from "../../drizzle/schema";

export const paymentLinkGeneratorRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [];
    if (input?.status) conditions.push(eq(shareableLinks.status, input.status as any));
    const rows = await db.select().from(shareableLinks).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(shareableLinks.createdAt)).limit(input?.limit ?? 50);
    return { links: rows, total: rows.length };
  }),
  create: protectedProcedure.input(z.object({ agentId: z.number(), amount: z.number().positive().optional(), description: z.string().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const slug = "PAY-" + crypto.randomUUID().slice(0, 12).toUpperCase();
    const [link] = await db.insert(shareableLinks).values({ slug, type: "payment" as any, status: "active" as any, agentId: input.agentId, amount: input.amount ? String(input.amount) : null, description: input.description, currency: "NGN" }).returning();
    await db.insert(auditLog).values({ action: "payment_link_created", resource: "shareable_links", resourceId: String(link.id), status: "success", metadata: { slug, agentId: input.agentId } });
    return { id: link.id, slug, url: `/pay/${slug}`, status: "active" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(shareableLinks);
    const [active] = await db.select({ value: count() }).from(shareableLinks).where(eq(shareableLinks.status, "active" as any));
    const [clicks] = await db.select({ value: sum(shareableLinks.clickCount) }).from(shareableLinks);
    return { totalLinks: Number(total.value), activeLinks: Number(active.value), totalClicks: Number(clicks.value ?? 0) };
  }),
});
