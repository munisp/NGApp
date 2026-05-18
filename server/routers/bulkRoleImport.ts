import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { users, auditLog } from "../../drizzle/schema";

export const bulkRoleImportRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), role: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [];
    if (input?.role) conditions.push(eq(users.role, input.role as any));
    const rows = await db.select({ id: users.id, email: users.email, role: users.role, createdAt: users.createdAt }).from(users).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(users.createdAt)).limit(input?.limit ?? 50);
    return { users: rows, total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(users);
    return { totalUsers: Number(total.value) };
  }),
});
