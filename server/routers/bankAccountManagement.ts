import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { agentBankAccounts } from "../../drizzle/schema";
import { eq, desc, and, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const listAccounts = protectedProcedure
  .input(z.object({ agentId: z.number().optional(), page: z.number().optional(), limit: z.number().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const conditions = input.agentId ? [eq(agentBankAccounts.agentId, input.agentId)] : [];
    const rows = await db.select().from(agentBankAccounts).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(agentBankAccounts.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(agentBankAccounts).where(conditions.length ? and(...conditions) : undefined);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });

const getAccount = protectedProcedure
  .input(z.object({ id: z.number() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const [row] = await db.select().from(agentBankAccounts).where(eq(agentBankAccounts.id, input.id));
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Bank account not found" });
    return row;
  });

const addAccount = protectedProcedure
  .input(z.object({ agentId: z.number(), bankName: z.string(), bankCode: z.string(), accountNumber: z.string(), accountName: z.string() }))
  .mutation(async ({ input }) => {
    const db = (await getDb())!;
    if (!/^[0-9]{10}$/.test(input.accountNumber)) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid NUBAN — must be 10 digits" });
    const [row] = await db.insert(agentBankAccounts).values(input as any).returning();
    return { ...row, message: "Bank account added" };
  });

const removeAccount = protectedProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.delete(agentBankAccounts).where(eq(agentBankAccounts.id, input.id));
    return { success: true };
  });

export const bankAccountManagementRouter = router({
  listAccounts,
  getAccount,
  addAccount,
  removeAccount,
  list: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      const db = (await getDb())!;
      const rows = await db.select().from(agentBankAccounts).orderBy(desc(agentBankAccounts.id)).limit(50);
      return { items: rows };
    }),
  create: protectedProcedure
    .input(z.object({ agentId: z.number(), bankName: z.string(), bankCode: z.string(), accountNumber: z.string(), accountName: z.string() }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      const [row] = await db.insert(agentBankAccounts).values(input as any).returning();
      return { ...row, success: true };
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      await db.delete(agentBankAccounts).where(eq(agentBankAccounts.id, input.id));
      return { success: true };
    }),
  verify: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      await db.update(agentBankAccounts).set({ verified: true } as any).where(eq(agentBankAccounts.id, input.id));
      return { success: true, message: "Account verified" };
    }),
});
