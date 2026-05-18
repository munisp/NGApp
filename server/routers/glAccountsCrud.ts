// Sprint 87: Chart of accounts hierarchy, balance validation
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { gl_accounts } from "../../drizzle/schema";
import { eq, desc, and, count, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"];
const NORMAL_BALANCE: Record<string, string> = { asset: "debit", liability: "credit", equity: "credit", revenue: "credit", expense: "debit" };

export const gl_accountsRouter = router({
  list: protectedProcedure.input(z.object({ accountType: z.string().optional(), limit: z.number().default(50), offset: z.number().default(0) })).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = input.accountType ? [eq(gl_accounts.accountType as any, input.accountType)] : [];
    const rows = await db.select().from(gl_accounts).where(conditions.length ? and(...conditions) : undefined).orderBy(gl_accounts.accountCode as any).limit(input.limit).offset(input.offset);
    const [{ total }] = await db.select({ total: count() }).from(gl_accounts).where(conditions.length ? and(...conditions) : undefined);
    return { items: rows.map((r: any) => ({ ...r, normalBalance: NORMAL_BALANCE[r.accountType] || "debit" })), total };
  }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [row] = await db.select().from(gl_accounts).where(eq(gl_accounts.id, input.id));
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "GL account not found" });
    return { ...row, normalBalance: NORMAL_BALANCE[(row as any).accountType] || "debit" };
  }),
  create: protectedProcedure.input(z.object({ accountCode: z.string().min(4), accountName: z.string().min(3), accountType: z.enum(["asset", "liability", "equity", "revenue", "expense"]), parentId: z.number().optional(), description: z.string().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [existing] = await db.select().from(gl_accounts).where(eq(gl_accounts.accountCode as any, input.accountCode));
    if (existing) throw new TRPCError({ code: "CONFLICT", message: `Account code ${input.accountCode} already exists` });
    const [row] = await db.insert(gl_accounts).values(input as any).returning();
    return { ...row, normalBalance: NORMAL_BALANCE[input.accountType] };
  }),
  getTrialBalance: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const accounts = await db.select().from(gl_accounts);
    const totalDebits = accounts.filter((a: any) => ["asset", "expense"].includes(a.accountType)).reduce((s, a: any) => s + Number(a.balance || 0), 0);
    const totalCredits = accounts.filter((a: any) => ["liability", "equity", "revenue"].includes(a.accountType)).reduce((s, a: any) => s + Number(a.balance || 0), 0);
    return { totalDebits: totalDebits.toFixed(2), totalCredits: totalCredits.toFixed(2), isBalanced: Math.abs(totalDebits - totalCredits) < 0.01, difference: Math.abs(totalDebits - totalCredits).toFixed(2), accountCount: accounts.length };
  }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.delete(gl_accounts).where(eq(gl_accounts.id, input.id));
    return { success: true };
  }),
});
