import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { ussdSessions, auditLog } from "../../drizzle/schema";

export const ussdGatewayRouter = router({
  listSessions: protectedProcedure.input(z.object({ limit: z.number().default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = input?.status ? await db.select().from(ussdSessions).where(eq(ussdSessions.status, input.status)).orderBy(desc(ussdSessions.createdAt)).limit(input?.limit ?? 50) : await db.select().from(ussdSessions).orderBy(desc(ussdSessions.createdAt)).limit(input?.limit ?? 50);
    return { sessions: rows, total: rows.length };
  }),
  getSession: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [session] = await db.select().from(ussdSessions).where(eq(ussdSessions.id, input.id)).limit(1);
    return session ?? null;
  }),
  initiateSession: protectedProcedure.input(z.object({ phoneNumber: z.string(), serviceCode: z.string().default("*347#") })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [session] = await db.insert(ussdSessions).values({ phoneNumber: input.phoneNumber, serviceCode: input.serviceCode, status: "active" }).returning();
    await db.insert(auditLog).values({ action: "ussd_session_started", resource: "ussd_sessions", resourceId: String(session.id), status: "success", metadata: { phoneNumber: input.phoneNumber } });
    return session;
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(ussdSessions);
    const [active] = await db.select({ value: count() }).from(ussdSessions).where(eq(ussdSessions.status, "active"));
    return { totalSessions: Number(total.value), activeSessions: Number(active.value) };
  }),
});
