import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const cardBinLookupRouter = router({
  lookup: protectedProcedure.input(z.object({ bin: z.string().min(6).max(8) })).query(async ({ input }) => {
    try {
      const db = await getDb();
      if (!db) return { found: false };
      const rows = await db.select().from(systemConfig).where(eq(systemConfig.key, "card_bin_" + input.bin)).limit(1);
      if (rows.length > 0 && rows[0].value) return { found: true, ...JSON.parse(String(rows[0].value)) };
      await db.insert(auditLog).values({ action: "bin_lookup", resource: "card_bins", resourceId: input.bin, status: "success", metadata: {} });
      return { found: false, bin: input.bin };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  addBin: protectedProcedure.input(z.object({ bin: z.string().min(6).max(8), bank: z.string(), scheme: z.enum(["visa", "mastercard", "verve", "amex"]), type: z.enum(["debit", "credit", "prepaid"]), country: z.string().default("NG") })).mutation(async ({ input }) => {
    try {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.insert(systemConfig).values({ key: "card_bin_" + input.bin, value: JSON.stringify(input) }).onConflictDoUpdate({ target: systemConfig.key, set: { value: JSON.stringify(input), updatedAt: new Date() } });
      return { success: true };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  listBins: protectedProcedure.input(z.object({ scheme: z.string().optional(), limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    try {
      const db = await getDb();
      if (!db) return { bins: [], total: 0 };
      const rows = await db.select().from(systemConfig).where(sql`${systemConfig.key} LIKE 'card_bin_%'`).limit(input?.limit ?? 50);
      let bins = rows.map(r => ({ bin: r.key.replace("card_bin_", ""), ...JSON.parse(String(r.value ?? "{}")) }));
      if (input?.scheme) bins = bins.filter((b: any) => b.scheme === input.scheme);
      return { bins, total: bins.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
});
