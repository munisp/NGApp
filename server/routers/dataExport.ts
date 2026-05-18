import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { transactions, agents, merchants, disputes, auditLog } from "../../drizzle/schema";
import { gte, lte, and, desc } from "drizzle-orm";

export const dataExportRouter = router({
  exportTransactions: protectedProcedure
    .input(z.object({
      format: z.enum(["csv", "json"]).default("csv"),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().max(10000).default(1000),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { data: "", count: 0 };
      
      const conditions = [];
      if (input.startDate) conditions.push(gte(transactions.createdAt, new Date(input.startDate)));
      if (input.endDate) conditions.push(lte(transactions.createdAt, new Date(input.endDate)));
      
      const rows = await db.select().from(transactions)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(transactions.createdAt))
        .limit(input.limit);
      
      if (input.format === "json") {
        return { data: JSON.stringify(rows, null, 2), count: rows.length, format: "json" };
      }
      
      // CSV format
      if (rows.length === 0) return { data: "", count: 0, format: "csv" };
      const headers = Object.keys(rows[0]).join(",");
      const csvRows = rows.map(r => Object.values(r).map(v => 
        typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : String(v ?? "")
      ).join(","));
      return { data: [headers, ...csvRows].join("\n"), count: rows.length, format: "csv" };
    }),
    
  exportAgents: protectedProcedure
    .input(z.object({ format: z.enum(["csv", "json"]).default("csv"), limit: z.number().max(5000).default(500) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { data: "", count: 0 };
      const rows = await db.select().from(agents).limit(input.limit);
      if (input.format === "json") return { data: JSON.stringify(rows, null, 2), count: rows.length, format: "json" };
      if (rows.length === 0) return { data: "", count: 0, format: "csv" };
      const headers = Object.keys(rows[0]).join(",");
      const csvRows = rows.map(r => Object.values(r).map(v => typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : String(v ?? "")).join(","));
      return { data: [headers, ...csvRows].join("\n"), count: rows.length, format: "csv" };
    }),
    
  exportAuditLog: protectedProcedure
    .input(z.object({ format: z.enum(["csv", "json"]).default("json"), limit: z.number().max(10000).default(1000) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { data: "", count: 0 };
      const rows = await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(input.limit);
      return { data: JSON.stringify(rows, null, 2), count: rows.length, format: "json" };
    }),
  availableTables: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      return {};
    }),
  createJob: protectedProcedure
    .input(z.object({}))
    .mutation(async ({ ctx, input }) => {
      return { success: true };
    }),
  listJobs: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      return {};
    }),
});
