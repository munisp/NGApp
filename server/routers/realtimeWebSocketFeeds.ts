import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const realtimeWebSocketFeedsRouter = router({
  listFeeds: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const feeds = ["transactions", "alerts", "notifications", "agent_status", "market_data"];
    const statuses = [];
    for (const feed of feeds) {
      const [latest] = await db.select().from(auditLog).where(eq(auditLog.resourceId, `ws_feed_${feed}`)).orderBy(desc(auditLog.createdAt)).limit(1);
      statuses.push({ name: feed, active: !!latest, lastMessage: latest?.createdAt ?? null });
    }
    return { feeds: statuses };
  }),
  getConfig: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, "websocket_config")).limit(1);
    return config ? JSON.parse(String(config.value)) : { maxConnections: 10000, heartbeatInterval: 30000, reconnectDelay: 5000 };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "websocket_feed"));
    return { totalMessages: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
