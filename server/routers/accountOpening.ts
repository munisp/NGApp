import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { customers, auditLog } from "../../drizzle/schema";

export const accountOpeningRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalAccounts: 0, pending: 0, active: 0, suspended: 0 };
    const [total] = await db.select({ value: count() }).from(customers);
    const [pending] = await db.select({ value: count() }).from(customers).where(eq(customers.status, "pending_kyc"));
    const [active] = await db.select({ value: count() }).from(customers).where(eq(customers.status, "active"));
    return { totalAccounts: Number(total.value), pending: Number(pending.value), active: Number(active.value), suspended: 0 };
  }),
  listAccounts: protectedProcedure.input(z.object({ status: z.string().optional(), limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { accounts: [], total: 0 };
    const rows = await db.select().from(customers).orderBy(desc(customers.createdAt)).limit(input?.limit ?? 20);
    return { accounts: rows, total: rows.length };
  }),
  openAccount: protectedProcedure.input(z.object({ firstName: z.string(), lastName: z.string(), phone: z.string(), email: z.string().optional(), bvn: z.string().optional(), nin: z.string().optional(), address: z.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const [customer] = await db.insert(customers).values({ firstName: input.firstName, lastName: input.lastName, phone: input.phone, email: input.email, bvn: input.bvn, nin: input.nin, address: input.address, status: "pending_kyc" }).returning();
    await db.insert(auditLog).values({ action: "account_opened", resource: "customers", resourceId: String(customer.id), status: "success", metadata: { firstName: input.firstName, lastName: input.lastName } });
    return { success: true, customer };
  }),
  approveAccount: protectedProcedure.input(z.object({ customerId: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const [updated] = await db.update(customers).set({ status: "active" }).where(eq(customers.id, input.customerId)).returning();
    await db.insert(auditLog).values({ action: "account_approved", resource: "customers", resourceId: String(input.customerId), status: "success" });
    return { success: true, customer: updated };
  }),
});
