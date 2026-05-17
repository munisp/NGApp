import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { tenants, auditLog } from "../../drizzle/schema";

export const whiteLabelOnboardingRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalApplications: 0, pending: 0, approved: 0, rejected: 0, avgOnboardingDays: 0 };
    const [total] = await db.select({ value: count() }).from(tenants);
    const [active] = await db.select({ value: count() }).from(tenants).where(eq(tenants.status, "active"));
    const [trial] = await db.select({ value: count() }).from(tenants).where(eq(tenants.status, "trial"));
    return { totalApplications: Number(total.value), pending: Number(trial.value), approved: Number(active.value), rejected: 0, avgOnboardingDays: 3 };
  }),
  listApplications: protectedProcedure.input(z.object({ status: z.string().optional(), limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { applications: [], total: 0 };
    const rows = await db.select().from(tenants).orderBy(desc(tenants.createdAt)).limit(input?.limit ?? 20);
    return { applications: rows, total: rows.length };
  }),
  submitApplication: protectedProcedure.input(z.object({ companyName: z.string(), slug: z.string(), contactEmail: z.string(), contactPhone: z.string().optional(), country: z.string().default("NGA"), currency: z.string().default("NGN") })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const [tenant] = await db.insert(tenants).values({ name: input.companyName, slug: input.slug, contactEmail: input.contactEmail, contactPhone: input.contactPhone, country: input.country, currency: input.currency, status: "trial" }).returning();
    await db.insert(auditLog).values({ action: "whitelabel_application_submitted", resource: "tenants", resourceId: String(tenant.id), status: "success", metadata: { companyName: input.companyName, slug: input.slug } });
    return { success: true, tenant };
  }),
  getApplication: protectedProcedure.input(z.object({ tenantId: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(tenants).where(eq(tenants.id, input.tenantId)).limit(1);
    return rows.length > 0 ? rows[0] : null;
  }),
  approveApplication: protectedProcedure.input(z.object({ tenantId: z.number(), notes: z.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const [updated] = await db.update(tenants).set({ status: "active", updatedAt: new Date() }).where(eq(tenants.id, input.tenantId)).returning();
    await db.insert(auditLog).values({ action: "whitelabel_approved", resource: "tenants", resourceId: String(input.tenantId), status: "success", metadata: { notes: input.notes } });
    return { success: true, tenant: updated };
  }),
});
