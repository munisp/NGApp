import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq } from "drizzle-orm";
import { systemConfig } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const dashboardLayoutRouter = router({
  getLayout: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return { layout: null };
        const rows = await db
          .select()
          .from(systemConfig)
          .where(eq(systemConfig.key, "dashboard_layout_" + input.userId))
          .limit(1);
        if (rows.length > 0 && rows[0].value)
          return { layout: JSON.parse(String(rows[0].value)) };
        return {
          layout: {
            widgets: ["transactions", "agents", "revenue", "alerts"],
            columns: 3,
            theme: "default",
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Internal server error",
        });
      }
    }),

  getPresets: protectedProcedure.query(async () => {
    return [
      { id: "default", name: "Default", widgets: ["transactions", "agents", "revenue"] },
      { id: "finance", name: "Finance Focus", widgets: ["revenue", "settlement", "reconciliation"] },
      { id: "ops", name: "Operations", widgets: ["agents", "pos", "network"] },
    ];
  }),

  saveLayout: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        layout: z.object({
          widgets: z.array(z.string()),
          columns: z.number().min(1).max(4).default(3),
          theme: z.string().default("default"),
        }),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const key = "dashboard_layout_" + input.userId;
      const existing = await db.select().from(systemConfig).where(eq(systemConfig.key, key)).limit(1);
      if (existing.length > 0) {
        await db.update(systemConfig).set({ value: JSON.stringify(input.layout) }).where(eq(systemConfig.key, key));
      } else {
        await db.insert(systemConfig).values({ key, value: JSON.stringify(input.layout), description: "Dashboard layout" });
      }
      return { success: true };
    }),

  resetLayout: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.delete(systemConfig).where(eq(systemConfig.key, "dashboard_layout_" + input.userId));
      return { success: true };
    }),
});
