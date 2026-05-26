import { z } from "zod";
import { eq } from "drizzle-orm";
import { protectedProcedure, router } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../../db";
import { apiKeyWebhooks } from "../../../drizzle/schema";
import * as permissionService from "../../onboarding/permissionService";
import * as monitoringService from "../../onboarding/monitoringService";
import * as webhookService from "../../onboarding/webhookService";
import * as templateEngine from "../../onboarding/templateEngine";
import * as eventHistoryService from "../../onboarding/eventHistoryService";
import * as retryService from "../../onboarding/retryService";

const PermissionSchema = z.object({
  resource: z.string(),
  canRead: z.boolean(),
  canWrite: z.boolean(),
  canDelete: z.boolean(),
});

export const apiKeyEnhancementsRouter = router({
  // ===== Permissions =====
  permissions: router({
    /**
     * Set permissions for an API key
     */
    set: protectedProcedure
      .input(
        z.object({
          credentialId: z.number(),
          permissions: z.array(PermissionSchema),
        })
      )
      .mutation(async ({ input }) => {
        try {
          await permissionService.setKeyPermissions({
            credentialId: input.credentialId,
            permissions: input.permissions,
          });
          return { success: true };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to set permissions",
          });
        }
      }),

    /**
     * Get permissions for an API key
     */
    get: protectedProcedure
      .input(
        z.object({
          credentialId: z.number(),
        })
      )
      .query(async ({ input }) => {
        try {
          return await permissionService.getKeyPermissions(input.credentialId);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to get permissions",
          });
        }
      }),

    /**
     * Check if key has specific permission
     */
    check: protectedProcedure
      .input(
        z.object({
          credentialId: z.number(),
          resource: z.string(),
          action: z.enum(["read", "write", "delete"]),
        })
      )
      .query(async ({ input }) => {
        try {
          const hasPermission = await permissionService.checkPermission({
            credentialId: input.credentialId,
            resource: input.resource,
            action: input.action,
          });
          return { hasPermission };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to check permission",
          });
        }
      }),

    /**
     * List permission templates
     */
    listTemplates: protectedProcedure.query(async () => {
      try {
        return await permissionService.listPermissionTemplates();
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to list templates",
        });
      }
    }),

    /**
     * Get specific permission template
     */
    getTemplate: protectedProcedure
      .input(
        z.object({
          name: z.string(),
        })
      )
      .query(async ({ input }) => {
        try {
          const template = await permissionService.getPermissionTemplate(input.name);
          if (!template) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Template not found",
            });
          }
          return template;
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to get template",
          });
        }
      }),
  }),

  // ===== Monitoring =====
  monitoring: router({
    /**
     * Get usage statistics
     */
    getStats: protectedProcedure
      .input(
        z.object({
          credentialId: z.number(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
        })
      )
      .query(async ({ input }) => {
        try {
          return await monitoringService.getUsageStats({
            credentialId: input.credentialId,
            startDate: input.startDate,
            endDate: input.endDate,
          });
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to get usage stats",
          });
        }
      }),

    /**
     * Get recent activity
     */
    getActivity: protectedProcedure
      .input(
        z.object({
          credentialId: z.number(),
          limit: z.number().optional(),
        })
      )
      .query(async ({ input }) => {
        try {
          return await monitoringService.getRecentActivity({
            credentialId: input.credentialId,
            limit: input.limit,
          });
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to get activity",
          });
        }
      }),

    /**
     * Get usage trends
     */
    getTrends: protectedProcedure
      .input(
        z.object({
          credentialId: z.number(),
          days: z.number().default(30),
        })
      )
      .query(async ({ input }) => {
        try {
          return await monitoringService.getUsageTrends({
            credentialId: input.credentialId,
            days: input.days,
          });
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to get trends",
          });
        }
      }),

    /**
     * Get error rate
     */
    getErrorRate: protectedProcedure
      .input(
        z.object({
          credentialId: z.number(),
          days: z.number().default(7),
        })
      )
      .query(async ({ input }) => {
        try {
          return await monitoringService.getErrorRate({
            credentialId: input.credentialId,
            days: input.days,
          });
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to get error rate",
          });
        }
      }),

    /**
     * Get real-time statistics
     */
    getRealTime: protectedProcedure
      .input(
        z.object({
          credentialId: z.number(),
        })
      )
      .query(async ({ input }) => {
        try {
          return await monitoringService.getRealTimeStats(input.credentialId);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to get real-time stats",
          });
        }
      }),
  }),

  // ===== Webhooks =====
  webhooks: router({
    /**
     * Register a webhook
     */
    register: protectedProcedure
      .input(
        z.object({
          credentialId: z.number(),
          webhookUrl: z.string().url(),
          events: z.array(z.string()),
          finalFailureNotificationUrl: z.string().url().optional(),
          consecutiveFailureThreshold: z.number().min(1).max(100).optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          return await webhookService.registerWebhook({
            credentialId: input.credentialId,
            webhookUrl: input.webhookUrl,
            events: input.events,
            finalFailureNotificationUrl: input.finalFailureNotificationUrl,
            consecutiveFailureThreshold: input.consecutiveFailureThreshold,
          });
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to register webhook",
          });
        }
      }),

    /**
     * Update webhook
     */
    update: protectedProcedure
      .input(
        z.object({
          webhookId: z.number(),
          webhookUrl: z.string().url().optional(),
          events: z.array(z.string()).optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          await webhookService.updateWebhook({
            webhookId: input.webhookId,
            webhookUrl: input.webhookUrl,
            events: input.events,
            isActive: input.isActive,
          });
          return { success: true };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to update webhook",
          });
        }
      }),

    /**
     * Delete webhook
     */
    delete: protectedProcedure
      .input(
        z.object({
          webhookId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          await webhookService.deleteWebhook(input.webhookId);
          return { success: true };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to delete webhook",
          });
        }
      }),

    /**
     * List webhooks for a credential
     */
    list: protectedProcedure
      .input(
        z.object({
          credentialId: z.number(),
        })
      )
      .query(async ({ input }) => {
        try {
          return await webhookService.listWebhooks(input.credentialId);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to list webhooks",
          });
        }
      }),

    /**
     * Test webhook (send test notification)
     */
    test: protectedProcedure
      .input(
        z.object({
          webhookId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const result = await webhookService.sendWebhook({
            webhookId: input.webhookId,
            event: "test",
            payload: {
              message: "This is a test webhook notification",
              timestamp: new Date().toISOString(),
            },
          });
          return result;
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to test webhook",
          });
        }
      }),

    /**
     * Get webhook delivery logs
     */
    getLogs: protectedProcedure
      .input(
        z.object({
          webhookId: z.number().optional(),
          credentialId: z.number().optional(),
          limit: z.number().optional(),
        })
      )
      .query(async ({ input }) => {
        try {
          return await webhookService.getWebhookLogs({
            webhookId: input.webhookId,
            credentialId: input.credentialId,
            limit: input.limit,
          });
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to get webhook logs",
          });
        }
      }),
  }),

  // ===== Payload Templates =====
  payloadTemplates: router({
    /**
     * Set custom payload template for webhook
     */
    set: protectedProcedure
      .input(
        z.object({
          webhookId: z.number(),
          template: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          // Validate template
          const validation = templateEngine.validateTemplate(input.template);
          if (!validation.valid) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Invalid template: ${validation.errors.join(", ")}`,
            });
          }

          await webhookService.updateWebhook({
            webhookId: input.webhookId,
            payloadTemplate: input.template,
          });
          return { success: true };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to set template",
          });
        }
      }),

    /**
     * Get available variables for event type
     */
    getVariables: protectedProcedure
      .input(
        z.object({
          eventType: z.string(),
        })
      )
      .query(async ({ input }) => {
        return templateEngine.getAvailableVariables(input.eventType);
      }),

    /**
     * Get default template for event type
     */
    getDefault: protectedProcedure
      .input(
        z.object({
          eventType: z.string(),
        })
      )
      .query(async ({ input }) => {
        return templateEngine.getDefaultTemplate(input.eventType);
      }),

    /**
     * Preview rendered payload
     */
    preview: protectedProcedure
      .input(
        z.object({
          template: z.string(),
          eventType: z.string(),
        })
      )
      .query(async ({ input }) => {
        try {
          // Sample data for preview
          const sampleData: templateEngine.TemplateVariables = {
            event: input.eventType,
            timestamp: new Date().toISOString(),
            credentialId: 12345,
            environment: "sandbox",
            keyPreview: "sk_sandbox_***abc123",
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            reason: "Security policy update",
            oldKeyPreview: "sk_sandbox_***xyz789",
            usageCount: 10000,
            errorRate: 2.5,
          };

          const rendered = templateEngine.renderPayload(
            input.eventType,
            sampleData,
            input.template
          );

          return {
            success: true,
            payload: rendered,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to render template",
          };
        }
      }),

    /**
     * Validate template
     */
    validate: protectedProcedure
      .input(
        z.object({
          template: z.string(),
        })
      )
      .query(async ({ input }) => {
        return templateEngine.validateTemplate(input.template);
      }),

    /**
     * Reset to default template
     */
    resetToDefault: protectedProcedure
      .input(
        z.object({
          webhookId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          await webhookService.updateWebhook({
            webhookId: input.webhookId,
            payloadTemplate: null,
          });
          return { success: true };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to reset template",
          });
        }
      }),
  }),

  // ===== Event History =====
  eventHistory: router({
    /**
     * Get paginated event history with filters
     */
    list: protectedProcedure
      .input(
        z.object({
          webhookId: z.number().optional(),
          credentialId: z.number().optional(),
          status: z.enum(["pending", "delivered", "failed"]).optional(),
          eventType: z.string().optional(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
      )
      .query(async ({ input }) => {
        try {
          return await eventHistoryService.getEventHistory(input);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to get event history",
          });
        }
      }),

    /**
     * Get detailed information for specific event
     */
    getDetails: protectedProcedure
      .input(
        z.object({
          eventId: z.number(),
        })
      )
      .query(async ({ input }) => {
        try {
          const details = await eventHistoryService.getEventDetails(input.eventId);
          if (!details) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Event not found",
            });
          }
          return details;
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to get event details",
          });
        }
      }),

    /**
     * Get delivery statistics
     */
    getStats: protectedProcedure
      .input(
        z.object({
          webhookId: z.number().optional(),
          credentialId: z.number().optional(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
        })
      )
      .query(async ({ input }) => {
        try {
          return await eventHistoryService.getDeliveryStats(input);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to get delivery stats",
          });
        }
      }),

    /**
     * Retry failed delivery
     */
    retry: protectedProcedure
      .input(
        z.object({
          eventId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          await eventHistoryService.retryFailedDelivery(input.eventId);
          return { success: true };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to retry delivery",
          });
        }
      }),

    /**
     * Export event history
     */
    export: protectedProcedure
      .input(
        z.object({
          webhookId: z.number().optional(),
          status: z.enum(["pending", "delivered", "failed"]).optional(),
          eventType: z.string().optional(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
        })
      )
      .query(async ({ input }) => {
        try {
          return await eventHistoryService.exportEventHistory(input);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to export event history",
          });
        }
      }),
  }),

  // ===== Retry Configuration =====
  retry: router({
    /**
     * Update retry configuration for webhook
     */
    updateConfig: protectedProcedure
      .input(
        z.object({
          webhookId: z.number(),
          maxRetries: z.number().min(0).max(10),
          retryBackoffMs: z.number().min(10000).max(3600000), // 10s to 1hr
          retriesEnabled: z.boolean(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");

          await db
            .update(apiKeyWebhooks)
            .set({
              maxRetries: input.maxRetries,
              retryBackoffMs: input.retryBackoffMs,
              retriesEnabled: input.retriesEnabled,
            })
            .where(eq(apiKeyWebhooks.id, input.webhookId));

          return { success: true };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to update retry config",
          });
        }
      }),

    /**
     * Get retry configuration for webhook
     */
    getConfig: protectedProcedure
      .input(
        z.object({
          webhookId: z.number(),
        })
      )
      .query(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");

          const webhooks = await db
            .select({
              maxRetries: apiKeyWebhooks.maxRetries,
              retryBackoffMs: apiKeyWebhooks.retryBackoffMs,
              retriesEnabled: apiKeyWebhooks.retriesEnabled,
            })
            .from(apiKeyWebhooks)
            .where(eq(apiKeyWebhooks.id, input.webhookId))
            .limit(1);

          if (webhooks.length === 0) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Webhook not found",
            });
          }

          return webhooks[0];
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to get retry config",
          });
        }
      }),

    /**
     * Manually trigger retry for a failed delivery
     */
    triggerRetry: protectedProcedure
      .input(
        z.object({
          deliveryLogId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          await retryService.scheduleRetry(input.deliveryLogId);
          return { success: true };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to trigger retry",
          });
        }
      }),

    /**
     * Pause automatic retries for a webhook
     */
    pause: protectedProcedure
      .input(
        z.object({
          webhookId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");

          await db
            .update(apiKeyWebhooks)
            .set({ retriesEnabled: false })
            .where(eq(apiKeyWebhooks.id, input.webhookId));

          return { success: true };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to pause retries",
          });
        }
      }),

    /**
     * Resume automatic retries for a webhook
     */
    resume: protectedProcedure
      .input(
        z.object({
          webhookId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");

          await db
            .update(apiKeyWebhooks)
            .set({ retriesEnabled: true })
            .where(eq(apiKeyWebhooks.id, input.webhookId));

          return { success: true };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to resume retries",
          });
        }
      }),
  }),
  
  /**
   * Retry attempt logs
   */
  retryAttempts: router({
    /**
     * Get all retry attempts for a delivery
     */
    getAttempts: protectedProcedure
      .input(
        z.object({
          deliveryLogId: z.number(),
        })
      )
      .query(async ({ input }) => {
        try {
          const { getRetryAttempts } = await import("../../onboarding/retryAttemptService");
          return await getRetryAttempts(input.deliveryLogId);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to get retry attempts",
          });
        }
      }),

    /**
     * Get retry statistics for a delivery
     */
    getStats: protectedProcedure
      .input(
        z.object({
          deliveryLogId: z.number(),
        })
      )
      .query(async ({ input }) => {
        try {
          const { getRetryStats } = await import("../../onboarding/retryAttemptService");
          return await getRetryStats(input.deliveryLogId);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to get retry stats",
          });
        }
      }),
  }),
});
