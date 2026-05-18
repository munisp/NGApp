import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { biometricAuditEvents, faceEnrollments, fido2Credentials } from "../../drizzle/schema";

export const biometricAuthGatewayRouter = router({
  listEvents: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(biometricAuditEvents).orderBy(desc(biometricAuditEvents.createdAt)).limit(input?.limit ?? 50);
    return { events: rows, total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalEvents] = await db.select({ value: count() }).from(biometricAuditEvents);
    const [totalEnrollments] = await db.select({ value: count() }).from(faceEnrollments);
    const [totalFido2] = await db.select({ value: count() }).from(fido2Credentials);
    return { totalEvents: Number(totalEvents.value), totalEnrollments: Number(totalEnrollments.value), totalFido2: Number(totalFido2.value) };
  }),
});
