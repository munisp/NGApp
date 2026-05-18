import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { systemConfig, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const apiVersioningRouter = router({
  getCurrentVersion: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { version: "3.6.0", apiVersion: "v3", deprecated: false };
    const rows = await db.select().from(systemConfig).where(eq(systemConfig.key, "api_version")).limit(1);
    if (rows.length > 0 && rows[0].value) return JSON.parse(String(rows[0].value));
    return { version: "3.6.0", apiVersion: "v3", deprecated: false, supportedVersions: ["v3", "v2"], sunsetVersions: ["v1"] };
  }),
  listVersions: protectedProcedure.query(async () => {
    return { versions: [
      { version: "v3", status: "current", releaseDate: "2026-04-01", endpoints: 424 },
      { version: "v2", status: "supported", releaseDate: "2025-10-01", endpoints: 280, sunsetDate: "2027-04-01" },
      { version: "v1", status: "deprecated", releaseDate: "2025-01-01", endpoints: 120, sunsetDate: "2026-07-01" },
    ] };
  }),
  setVersion: protectedProcedure.input(z.object({ version: z.string(), apiVersion: z.string() })).mutation(async ({ input }) => {
    try {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.insert(systemConfig).values({ key: "api_version", value: JSON.stringify(input) }).onConflictDoUpdate({ target: systemConfig.key, set: { value: JSON.stringify(input), updatedAt: new Date() } });
      await db.insert(auditLog).values({ action: "api_version_updated", resource: "api_versioning", resourceId: input.apiVersion, status: "success", metadata: input });
      return { success: true };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
});
