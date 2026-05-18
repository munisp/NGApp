import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { merchants, auditLog } from "../../drizzle/schema";

export const partnerOnboardingRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalPartners: 0, active: 0, pending: 0, onboarding: 0 };
    const [total] = await db.select({ value: count() }).from(merchants);
    return { totalPartners: Number(total.value), active: Number(total.value), pending: 0, onboarding: 0 };
  }),
  listPartners: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { partners: [], total: 0 };
    const rows = await db.select().from(merchants).orderBy(desc(merchants.createdAt)).limit(input?.limit ?? 20);
    return { partners: rows, total: rows.length };
  }),
  onboardPartner: protectedProcedure.input(z.object({ businessName: z.string(), ownerName: z.string(), phone: z.string(), email: z.string().optional(), category: z.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const code = "MER-" + crypto.randomUUID().toUpperCase();
    const [partner] = await db.insert(merchants).values({ merchantCode: code, businessName: input.businessName, ownerName: input.ownerName, phone: input.phone, email: input.email, status: "pending" }).returning();
    await db.insert(auditLog).values({ action: "partner_onboarded", resource: "merchants", resourceId: String(partner.id), status: "success", metadata: { businessName: input.businessName } });
    return { success: true, partner };
  }),
});
