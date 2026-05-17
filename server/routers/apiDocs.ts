import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { auditLog } from "../../drizzle/schema";

export const apiDocsRouter = router({
  getSpec: publicProcedure.query(async () => {
    const db = await getDb();
    const dbHealthy = !!db;
    return {
      openapi: "3.0.3",
      info: { title: "54Link POS Shell API", version: "3.6.0", description: "Enterprise Agent Banking Platform API" },
      servers: [{ url: "/api/trpc", description: "tRPC API" }],
      dbHealthy,
      paths: {},
      components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } },
    };
  }),
  getEndpoints: publicProcedure.query(async () => {
    const db = await getDb();
    const [auditCount] = db ? await db.select({ value: count() }).from(auditLog) : [{ value: 0 }];
    return { totalEndpoints: 424, totalAuditEvents: Number(auditCount.value), categories: [
      { name: "Agent Management", endpoints: 45 }, { name: "Transaction Processing", endpoints: 38 },
      { name: "KYC & Compliance", endpoints: 32 }, { name: "Commission & Revenue", endpoints: 28 },
      { name: "Security & Audit", endpoints: 25 }, { name: "Notifications", endpoints: 20 },
      { name: "Reports & Analytics", endpoints: 35 }, { name: "System Administration", endpoints: 40 },
    ] };
  }),
});
