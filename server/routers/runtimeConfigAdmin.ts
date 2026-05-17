// @ts-nocheck
/**
 * Runtime Configuration Admin Router
 * P1-3: Admin tRPC procedures for reading/updating runtime parameters
 *
 * Allows admins to tune batch sizes, concurrency, circuit breaker thresholds,
 * and other performance parameters at runtime without server restart.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getConfig, getConfigNumber, setConfig, getAllConfig,
  resetConfig, seedDefaults, invalidateCache,
} from "../lib/runtimeConfig";
import logger from "../_core/logger";

export const runtimeConfigAdminRouter = router({
  /** Get all configuration parameters with defaults and current values */
  getAll: protectedProcedure.query(async () => {
    return getAllConfig();
  }),

  /** Get a single configuration value */
  get: protectedProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      const value = await getConfig(input.key);
      return { key: input.key, value };
    }),

  /** Get a numeric configuration value */
  getNumber: protectedProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      const value = await getConfigNumber(input.key);
      return { key: input.key, value };
    }),

  /** Update a configuration parameter */
  update: protectedProcedure
    .input(z.object({
      key: z.string().min(1).max(128),
      value: z.string().min(1).max(4096),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id ? String(ctx.user.id) : "admin";
      await setConfig(input.key, input.value, userId);
      logger.info(`[RuntimeConfig] Admin ${userId} updated ${input.key} = ${input.value}`);
      return { key: input.key, value: input.value, updatedBy: userId };
    }),

  /** Batch update multiple configuration parameters */
  batchUpdate: protectedProcedure
    .input(z.object({
      updates: z.array(z.object({
        key: z.string().min(1).max(128),
        value: z.string().min(1).max(4096),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id ? String(ctx.user.id) : "admin";
      const results: Array<{ key: string; value: string; success: boolean }> = [];

      for (const { key, value } of input.updates) {
        try {
          await setConfig(key, value, userId);
          results.push({ key, value, success: true });
        } catch (error) {
          logger.error(`[RuntimeConfig] Failed to update ${key}:`, error);
          results.push({ key, value, success: false });
        }
      }

      logger.info(`[RuntimeConfig] Admin ${userId} batch updated ${results.filter(r => r.success).length}/${results.length} params`);
      return { results, updatedBy: userId };
    }),

  /** Reset a configuration parameter to its default value */
  reset: protectedProcedure
    .input(z.object({ key: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id ? String(ctx.user.id) : "admin";
      await resetConfig(input.key, userId);
      return { key: input.key, reset: true };
    }),

  /** Seed all default configuration values (idempotent) */
  seedDefaults: protectedProcedure.mutation(async () => {
    const seeded = await seedDefaults();
    return { seeded };
  }),

  /** Invalidate the in-memory configuration cache */
  invalidateCache: protectedProcedure
    .input(z.object({ key: z.string().optional() }).optional())
    .mutation(async ({ input }) => {
      invalidateCache(input?.key);
      return { invalidated: input?.key ?? "all" };
    }),
});
