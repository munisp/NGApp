import { z } from "zod";
import { protectedProcedure, router } from "../../_core/trpc";
import {
  generateApiKey,
  rotateApiKey,
  revokeApiKey,
  validateApiKey,
  listApiKeys,
  getApiKeyHistory,
} from "../../onboarding/apiKeyService";
import { TRPCError } from "@trpc/server";

export const apiKeysRouter = router({
  /**
   * Generate a new API key for an environment
   */
  generate: protectedProcedure
    .input(
      z.object({
        environmentId: z.number(),
        expiresInDays: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await generateApiKey({
          environmentId: input.environmentId,
          createdBy: ctx.user.id,
          expiresInDays: input.expiresInDays,
        });

        return {
          success: true,
          ...result,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to generate API key",
        });
      }
    }),

  /**
   * Rotate an existing API key
   */
  rotate: protectedProcedure
    .input(
      z.object({
        credentialId: z.number(),
        reason: z.string().optional(),
        expiresInDays: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await rotateApiKey({
          credentialId: input.credentialId,
          performedBy: ctx.user.id,
          reason: input.reason,
          expiresInDays: input.expiresInDays,
        });

        return {
          success: true,
          ...result,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to rotate API key",
        });
      }
    }),

  /**
   * Revoke an API key
   */
  revoke: protectedProcedure
    .input(
      z.object({
        credentialId: z.number(),
        reason: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        await revokeApiKey({
          credentialId: input.credentialId,
          performedBy: ctx.user.id,
          reason: input.reason,
        });

        return {
          success: true,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to revoke API key",
        });
      }
    }),

  /**
   * Validate an API key
   */
  validate: protectedProcedure
    .input(
      z.object({
        apiKey: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        return await validateApiKey(input.apiKey);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to validate API key",
        });
      }
    }),

  /**
   * List all API keys for an environment
   */
  list: protectedProcedure
    .input(
      z.object({
        environmentId: z.number(),
      })
    )
    .query(async ({ input }) => {
      try {
        return await listApiKeys(input.environmentId);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to list API keys",
        });
      }
    }),

  /**
   * Get API key history for audit
   */
  getHistory: protectedProcedure
    .input(
      z.object({
        credentialId: z.number(),
      })
    )
    .query(async ({ input }) => {
      try {
        return await getApiKeyHistory(input.credentialId);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to get API key history",
        });
      }
    }),
});
