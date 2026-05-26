import { TRPCError } from "@trpc/server";
/**
 * server/routers/cache.ts — tRPC router for Redis cache management
 *
 * Exposes cache statistics and manual invalidation for the Settings page
 * and the Infrastructure status panel.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getCacheStats, cacheDel } from "../cache";

export const cacheRouter = router({
  /**
   * Returns current Redis connection status and memory stats.
   * Used by the Infrastructure page health cards.
   */
  getStats: protectedProcedure.query(async () => {
    return getCacheStats();
  }),

  /**
   * Manually invalidate one or more cache keys.
   * Admin-only operation for cache debugging.
   */
  invalidate: protectedProcedure
    .input(
      z.object({
        keys: z.array(z.string()).min(1).max(50),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        if (ctx.user.role !== "admin") {
          throw new Error("Admin access required");
        }
        await cacheDel(...input.keys);
        return { invalidated: input.keys.length };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  /**
   * Invalidate all wells-related cache entries.
   */
  invalidateWells: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new Error("Admin access required");
    }
    await cacheDel("wells:list", "wells:active");
    return { status: "ok" };
  }),

  /**
   * Invalidate all alarms-related cache entries.
   */
  invalidateAlarms: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      if (ctx.user.role !== "admin") {
        throw new Error("Admin access required");
      }
      await cacheDel("alarms:list", "alarms:active", "alarms:critical");
      return { status: "ok" };
    } catch (err: unknown) {
      if (err instanceof TRPCError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
    }
  }),
});
