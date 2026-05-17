import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { systemConfig, auditLog } from "../../drizzle/schema";

export const userNotifPreferencesRouter = router({
  getPreferences: protectedProcedure.input(z.object({ userId: z.string() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { preferences: { email: true, sms: true, push: true, inApp: true, channels: {} } };
    const rows = await db.select().from(systemConfig).where(eq(systemConfig.key, "notif_pref_" + input.userId)).limit(1);
    if (rows.length > 0 && rows[0].value) return { preferences: JSON.parse(String(rows[0].value)) };
    return { preferences: { email: true, sms: true, push: true, inApp: true, channels: {} } };
  }),
  updatePreferences: protectedProcedure.input(z.object({ userId: z.string(), email: z.boolean().optional(), sms: z.boolean().optional(), push: z.boolean().optional(), inApp: z.boolean().optional(), quietHoursStart: z.string().optional(), quietHoursEnd: z.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const { userId, ...prefs } = input;
    await db.insert(systemConfig).values({ key: "notif_pref_" + userId, value: JSON.stringify(prefs) }).onConflictDoUpdate({ target: systemConfig.key, set: { value: JSON.stringify(prefs), updatedAt: new Date() } });
    return { success: true };
  }),
  muteChannel: protectedProcedure.input(z.object({ userId: z.string(), channel: z.string(), muted: z.boolean(), duration: z.number().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(auditLog).values({ action: input.muted ? "channel_muted" : "channel_unmuted", resource: "notification_preferences", resourceId: input.userId, status: "success", metadata: { channel: input.channel, duration: input.duration } });
    return { success: true };
  }),
});
