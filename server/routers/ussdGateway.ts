import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { transactions, auditLog } from "../../drizzle/schema";

export const ussdGatewayRouter = router({
  initiateSession: protectedProcedure.input(z.object({ phoneNumber: z.string().regex(/^\+?[0-9]{10,15}$/), serviceCode: z.string().min(1).max(20) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const sessionId = "USSD-" + crypto.randomUUID();
    await db.insert(auditLog).values({ action: "ussd_session_started", resource: "ussd_sessions", resourceId: sessionId, status: "success", metadata: { phoneNumber: input.phoneNumber, serviceCode: input.serviceCode, sessionStatus: "active" } });
    return { sessionId, phoneNumber: input.phoneNumber, serviceCode: input.serviceCode, status: "active", menu: "CON Welcome to NGApp:\n1. Check Balance\n2. Send Money\n3. Buy Airtime\n4. Pay Bills", createdAt: new Date().toISOString() };
  }),
  continueSession: protectedProcedure.input(z.object({ sessionId: z.string().min(1), input: z.string().min(1).max(160) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.insert(auditLog).values({ action: "ussd_session_continued", resource: "ussd_sessions", resourceId: input.sessionId, status: "success", metadata: { userInput: input.input } });
    return { sessionId: input.sessionId, response: "CON Enter amount:", continueSession: true };
  }),
  endSession: protectedProcedure.input(z.object({ sessionId: z.string().min(1) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.insert(auditLog).values({ action: "ussd_session_ended", resource: "ussd_sessions", resourceId: input.sessionId, status: "success", metadata: {} });
    return { sessionId: input.sessionId, status: "ended" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [started] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.action, "ussd_session_started"));
    const [ended] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.action, "ussd_session_ended"));
    return { totalSessions: Number(started.value), activeSessions: Number(started.value) - Number(ended.value) };
  }),
});
