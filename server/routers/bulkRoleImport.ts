import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { users, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const bulkRoleImportRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), role: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const conditions = [];
      if (input?.role) conditions.push(eq(users.role, input.role));
      const rows = await db.select({ id: users.id, email: users.email, role: users.role, createdAt: users.createdAt }).from(users).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(users.createdAt)).limit(input?.limit ?? 50);
      return { users: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(users).limit(100);
    return { totalUsers: Number(total.value) };
  }),
});
