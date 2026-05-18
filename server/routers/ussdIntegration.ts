import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { ussdSessions, transactions, auditLog } from "../../drizzle/schema";

export const ussdIntegrationRouter = router({
  handleInput: protectedProcedure.input(z.object({ sessionId: z.number(), input: z.string() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [session] = await db.select().from(ussdSessions).where(eq(ussdSessions.id, input.sessionId)).limit(1);
    if (!session) throw new Error("Session not found");
    const menu = input.input === "1" ? "CON Cash In\n1. Enter Amount" : input.input === "2" ? "CON Cash Out\n1. Enter Amount" : "END Thank you for using 54Link";
    await db.insert(auditLog).values({ action: "ussd_input", resource: "ussd_sessions", resourceId: String(input.sessionId), status: "success", metadata: { input: input.input } });
    return { sessionId: input.sessionId, response: menu, continued: menu.startsWith("CON") };
  }),
  getMenuConfig: protectedProcedure.query(async () => {
    return { menus: [{ code: "1", label: "Cash In" }, { code: "2", label: "Cash Out" }, { code: "3", label: "Balance" }, { code: "4", label: "Transfer" }, { code: "5", label: "Bills" }] };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(ussdSessions);
    return { totalSessions: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
