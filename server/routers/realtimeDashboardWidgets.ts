import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum } from "drizzle-orm";
import { agents, transactions, disputes, merchants, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const realtimeDashboardWidgetsRouter = router({
  getAgentWidget: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(agents).limit(100);
    const [active] = await db.select({ value: count() }).from(agents).where(eq(agents.isActive, true)).limit(100);
    return { type: "agents", total: Number(total.value), active: Number(active.value), lastUpdated: new Date().toISOString() };
  }),
  getTransactionWidget: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(transactions).limit(100);
    const [volume] = await db.select({ value: sum(transactions.amount) }).from(transactions).limit(100);
    const [today] = await db.select({ value: count() }).from(transactions).where(sql`${transactions.createdAt} >= CURRENT_DATE`).limit(100);
    return { type: "transactions", total: Number(total.value), volume: Number(volume.value ?? 0), today: Number(today.value), lastUpdated: new Date().toISOString() };
  }),
  getDisputeWidget: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [open] = await db.select({ value: count() }).from(disputes).where(eq(disputes.status, "open")).limit(100);
    const [resolved] = await db.select({ value: count() }).from(disputes).where(eq(disputes.status, "resolved")).limit(100);
    return { type: "disputes", open: Number(open.value), resolved: Number(resolved.value), lastUpdated: new Date().toISOString() };
  }),
  getMerchantWidget: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(merchants).limit(100);
    const [active] = await db.select({ value: count() }).from(merchants).where(eq(merchants.status, "active")).limit(100);
    return { type: "merchants", total: Number(total.value), active: Number(active.value), lastUpdated: new Date().toISOString() };
  }),
  getStats: protectedProcedure.query(async () => {
    return { widgets: ["agents", "transactions", "disputes", "merchants"], lastUpdated: new Date().toISOString() };
  }),
});
