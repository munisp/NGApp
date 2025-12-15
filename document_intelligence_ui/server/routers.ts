import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { orchestrationRouter } from "./orchestration_router";
import { exportRouter } from "./routers/export";
import { scheduledExportsRouter } from "./routers/scheduledExports";
import { customTemplatesRouter } from "./routers/customTemplates";
import { validationRouter } from './routers/validation';
import { healthRouter } from './routers/health';
import { batchTemplateApplicationRouter } from "./routers/batchTemplateApplication";
import { identityVerificationRouter } from "./routers/identityVerification";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  health: healthRouter,
  orchestration: orchestrationRouter,
  export: exportRouter,
  scheduledExports: scheduledExportsRouter,
  customTemplates: customTemplatesRouter,
  validation: validationRouter,
  batchTemplateApplication: batchTemplateApplicationRouter,
  identityVerification: identityVerificationRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  documents: router({
    /**
     * Upload a document and initiate OCR processing
     */
    upload: protectedProcedure
      .input(
        z.object({
          filename: z.string(),
          category: z.enum([
            "citizenship_identity",
            "immigration_status",
            "income_employment",
            "tribal_aian",
            "employer_health_coverage",
            "household_relationship",
            "other_supporting",
          ]),
          fileData: z.string(), // base64 encoded file
          mimeType: z.string(),
          templateId: z.string().optional(), // Optional template ID for auto-applied OCR settings
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { storagePut } = await import("./storage");
        const {
          createDocument,
          updateDocumentStatus,
          createOcrResult,
        } = await import("./db");

        // Decode base64 and upload to S3
        const fileBuffer = Buffer.from(input.fileData, "base64");
        const fileSize = fileBuffer.length;
        const randomSuffix = Math.random().toString(36).substring(7);
        const fileKey = `${ctx.user.id}/documents/${input.filename}-${randomSuffix}`;

        const { url: fileUrl } = await storagePut(
          fileKey,
          fileBuffer,
          input.mimeType
        );

        // Create document record
        const document = await createDocument({
          userId: ctx.user.id,
          category: input.category,
          filename: input.filename,
          fileUrl,
          fileKey,
          mimeType: input.mimeType,
          fileSize,
          status: "pending",
        });

        // Process OCR asynchronously (don't await)
        processOcr(document.id, ctx.user.id, fileUrl, input.category, undefined, input.templateId).catch((error) => {
          console.error("OCR processing failed:", error);
          updateDocumentStatus(document.id, "failed").catch(console.error);
        });

        return document;
      }),

    /**
     * List all documents for the current user
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getDocumentsByUserId } = await import("./db");
      return getDocumentsByUserId(ctx.user.id);
    }),

    /**
     * Get a single document with its OCR result
     */
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const { getDocumentById, getOcrResultByDocumentId } = await import(
          "./db"
        );

        const document = await getDocumentById(input.id);
        if (!document) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Document not found",
          });
        }

        // Verify ownership
        if (document.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have access to this document",
          });
        }

        const ocrResult = await getOcrResultByDocumentId(document.id);

        return {
          ...document,
          ocrResult: ocrResult
            ? {
                ...ocrResult,
                extractedData: ocrResult.extractedData
                  ? JSON.parse(ocrResult.extractedData)
                  : null,
                metadata: ocrResult.metadata
                  ? JSON.parse(ocrResult.metadata)
                  : null,
              }
            : null,
        };
      }),

    /**
     * Compare multiple documents (2-3) from the same category
     */
    compare: protectedProcedure
      .input(
        z.object({
          documentIds: z.array(z.number()).min(2).max(3),
        })
      )
      .query(async ({ ctx, input }) => {
        const { getDocumentById, getOcrResultByDocumentId } = await import("./db");

        // Fetch all documents with their OCR results
        const documentsWithOcr = await Promise.all(
          input.documentIds.map(async (id) => {
            const document = await getDocumentById(id);
            if (!document) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: `Document ${id} not found`,
              });
            }

            // Check ownership
            if (document.userId !== ctx.user.id) {
              throw new TRPCError({
                code: "FORBIDDEN",
                message: `You don't have access to document ${id}`,
              });
            }

            const ocrResult = await getOcrResultByDocumentId(id);

            return {
              ...document,
              ocrResult: ocrResult
                ? {
                    ...ocrResult,
                    extractedData: ocrResult.extractedData
                      ? JSON.parse(ocrResult.extractedData)
                      : null,
                    metadata: ocrResult.metadata
                      ? JSON.parse(ocrResult.metadata)
                      : null,
                  }
                : null,
            };
          })
        );

        // Validate all documents are from the same category
        const categories = new Set(documentsWithOcr.map((d) => d.category));
        if (categories.size > 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "All documents must be from the same category for comparison",
          });
        }

        // Calculate field differences
        const fieldComparison = compareExtractedFields(documentsWithOcr);

        return {
          documents: documentsWithOcr,
          category: documentsWithOcr[0].category,
          fieldComparison,
        };
      }),
  }),

  batches: router({
    /**
     * Create a new batch and upload multiple documents
     */
    uploadBatch: protectedProcedure
      .input(
        z.object({
          name: z.string().optional(),
          files: z.array(
            z.object({
              filename: z.string(),
              category: z.enum([
                "citizenship_identity",
                "immigration_status",
                "income_employment",
                "tribal_aian",
                "employer_health_coverage",
                "household_relationship",
                "other_supporting",
              ]),
              fileData: z.string(), // base64 encoded file
              mimeType: z.string(),
            })
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { storagePut } = await import("./storage");
        const {
          createBatch,
          createDocument,
          updateBatchProgress,
        } = await import("./db");

        // Create batch record
        const batch = await createBatch({
          userId: ctx.user.id,
          name: input.name || `Batch ${new Date().toISOString()}`,
          totalFiles: input.files.length,
          completedFiles: 0,
          failedFiles: 0,
          status: "pending",
        });

        // Process files in parallel with concurrency limit
        const CONCURRENCY_LIMIT = 5;
        const results: Array<{ success: boolean; documentId?: number; error?: string }> = [];

        for (let i = 0; i < input.files.length; i += CONCURRENCY_LIMIT) {
          const chunk = input.files.slice(i, i + CONCURRENCY_LIMIT);
          const chunkResults = await Promise.allSettled(
            chunk.map(async (file) => {
              try {
                // Upload to S3
                const fileBuffer = Buffer.from(file.fileData, "base64");
                const fileSize = fileBuffer.length;
                const randomSuffix = Math.random().toString(36).substring(7);
                const fileKey = `${ctx.user.id}/batches/${batch.id}/${file.filename}-${randomSuffix}`;

                const { url: fileUrl } = await storagePut(
                  fileKey,
                  fileBuffer,
                  file.mimeType
                );

                // Create document record
                const document = await createDocument({
                  userId: ctx.user.id,
                  batchId: batch.id,
                  category: file.category,
                  filename: file.filename,
                  fileUrl,
                  fileKey,
                  mimeType: file.mimeType,
                  fileSize,
                  status: "pending",
                });

                // Start OCR processing asynchronously
                processOcr(document.id, ctx.user.id, fileUrl, file.category, batch.id).catch(
                  console.error
                );

                return { success: true, documentId: document.id };
              } catch (error) {
                console.error("File upload failed:", error);
                return {
                  success: false,
                  error: error instanceof Error ? error.message : "Unknown error",
                };
              }
            })
          );

          // Collect results
          chunkResults.forEach((result) => {
            if (result.status === "fulfilled") {
              results.push(result.value);
            } else {
              results.push({ success: false, error: result.reason });
            }
          });
        }

        // Update batch status
        const failedCount = results.filter((r) => !r.success).length;
        await updateBatchProgress(batch.id, {
          status: failedCount === input.files.length ? "failed" : "processing",
          failedFiles: failedCount,
        });

        return {
          batch,
          results,
        };
      }),

    /**
     * List all batches for the current user
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getBatchesByUserId } = await import("./db");
      return getBatchesByUserId(ctx.user.id);
    }),

    /**
     * Get a single batch with its documents
     */
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const { getBatchById, getDocumentsByBatchId, getBatchStatistics } =
          await import("./db");

        const batch = await getBatchById(input.id);
        if (!batch) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Batch not found",
          });
        }

        // Verify ownership
        if (batch.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have access to this batch",
          });
        }

        const documents = await getDocumentsByBatchId(batch.id);
        const statistics = await getBatchStatistics(batch.id);

        return {
          ...batch,
          documents,
          statistics,
        };
      }),

    /**
     * Cancel a batch
     */
    cancel: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getBatchById, updateBatchProgress } = await import("./db");

        const batch = await getBatchById(input.id);
        if (!batch) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Batch not found",
          });
        }

        // Verify ownership
        if (batch.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have access to this batch",
          });
        }

        await updateBatchProgress(input.id, { status: "cancelled" });

        return { success: true };
      }),

    /**
     * Retry failed documents in a batch
     */
    retryFailed: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getBatchById, getDocumentsByBatchId } = await import("./db");

        const batch = await getBatchById(input.id);
        if (!batch) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Batch not found",
          });
        }

        // Verify ownership
        if (batch.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have access to this batch",
          });
        }

        const documents = await getDocumentsByBatchId(batch.id);
        const failedDocs = documents.filter((d) => d.status === "failed");

        // Retry OCR processing for failed documents
        const retryPromises = failedDocs.map((doc) =>
          processOcr(doc.id, ctx.user.id, doc.fileUrl, doc.category, batch.id).catch(
            console.error
          )
        );

        await Promise.allSettled(retryPromises);

        return { success: true, retriedCount: failedDocs.length };
      }),

    /**
     * Delete a batch and all its documents
     */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getBatchById, getDocumentsByBatchId } = await import("./db");

        const batch = await getBatchById(input.id);
        if (!batch) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Batch not found",
          });
        }

        // Verify ownership
        if (batch.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have access to this batch",
          });
        }

        const db = await (await import("./db")).getDb();
        if (!db) throw new Error("Database not available");

        const { batches, documents, ocrResults } = await import(
          "../drizzle/schema"
        );
        const { eq } = await import("drizzle-orm");

        // Get all documents in the batch
        const batchDocs = await getDocumentsByBatchId(batch.id);

        // Delete OCR results for all documents
        for (const doc of batchDocs) {
          await db.delete(ocrResults).where(eq(ocrResults.documentId, doc.id));
        }

        // Delete all documents in the batch
        await db.delete(documents).where(eq(documents.batchId, batch.id));

        // Delete the batch
        await db.delete(batches).where(eq(batches.id, batch.id));

        return { success: true };
      }),
  }),

  // Lakehouse data access
  lakehouse: router({
    listTables: protectedProcedure.query(async () => {
      const { ENV } = await import("./_core/env");
      const response = await fetch(`${ENV.pythonApiUrl}/api/lakehouse/tables`);
      if (!response.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch tables from lakehouse",
        });
      }
      return response.json();
    }),

    getTableSchema: protectedProcedure
      .input(z.object({ tableName: z.string() }))
      .query(async ({ input }) => {
        const { ENV } = await import("./_core/env");
        const response = await fetch(
          `${ENV.pythonApiUrl}/api/lakehouse/tables/${input.tableName}/schema`
        );
        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch table schema",
          });
        }
        return response.json();
      }),

    queryTable: protectedProcedure
      .input(
        z.object({
          tableName: z.string(),
          filters: z.record(z.string(), z.any()).optional(),
          columns: z.array(z.string()).optional(),
          limit: z.number().default(100),
          offset: z.number().default(0),
          orderBy: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { ENV } = await import("./_core/env");
        const { tableName, ...queryParams } = input;
        const response = await fetch(
          `${ENV.pythonApiUrl}/api/lakehouse/tables/${tableName}/query`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(queryParams),
          }
        );
        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to query table",
          });
        }
        return response.json();
      }),

    getTableStats: protectedProcedure
      .input(z.object({ tableName: z.string() }))
      .query(async ({ input }) => {
        const { ENV } = await import("./_core/env");
        const response = await fetch(
          `${ENV.pythonApiUrl}/api/lakehouse/tables/${input.tableName}/stats`
        );
        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch table stats",
          });
        }
        return response.json();
      }),
  }),

  // Analytics dashboard
  analytics: router({
    getProcessingTrends: protectedProcedure
      .input(
        z.object({
          period: z.enum(["7d", "30d", "90d"]).default("30d"),
          granularity: z.enum(["hour", "day", "week"]).default("day"),
        })
      )
      .query(async ({ input }) => {
        const { ENV } = await import("./_core/env");
        const response = await fetch(
          `${ENV.pythonApiUrl}/api/analytics/processing-trends?period=${input.period}&granularity=${input.granularity}`
        );
        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch processing trends",
          });
        }
        return response.json();
      }),

    getCategoryStats: protectedProcedure.query(async () => {
      const { ENV } = await import("./_core/env");
      const response = await fetch(
        `${ENV.pythonApiUrl}/api/analytics/categories`
      );
      if (!response.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch category stats",
        });
      }
      return response.json();
    }),

    getErrorPatterns: protectedProcedure
      .input(z.object({ period: z.enum(["7d", "30d", "90d"]).default("7d") }))
      .query(async ({ input }) => {
        const { ENV } = await import("./_core/env");
        const response = await fetch(
          `${ENV.pythonApiUrl}/api/analytics/errors?period=${input.period}`
        );
        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch error patterns",
          });
        }
        return response.json();
      }),
  }),

  // Notifications
  notifications: router({    getNotifications: protectedProcedure
      .input(
        z.object({
          unreadOnly: z.boolean().optional(),
          category: z.string().optional(),
          limit: z.number().optional().default(50),
          offset: z.number().optional().default(0),
        })
      )
      .query(async ({ ctx, input }) => {
        const { getUserNotifications } = await import("./db");
        return getUserNotifications(ctx.user.id, input);
      }),

    getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
      const { getUnreadNotificationCount } = await import("./db");
      return { count: await getUnreadNotificationCount(ctx.user.id) };
    }),

    markAsRead: protectedProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ input }) => {
        const { markNotificationAsRead } = await import("./db");
        const success = await markNotificationAsRead(input.notificationId);
        if (!success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to mark notification as read",
          });
        }
        return { success };
      }),

    markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
      const { markAllNotificationsAsRead } = await import("./db");
      const success = await markAllNotificationsAsRead(ctx.user.id);
      if (!success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to mark all notifications as read",
        });
      }
      return { success };
    }),

    deleteNotification: protectedProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { deleteNotification } = await import("./db");
        const success = await deleteNotification(input.notificationId, ctx.user.id);
        if (!success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete notification",
          });
        }
        return { success };
      }),

    createSystemNotification: protectedProcedure
      .input(
        z.object({
          type: z.enum(["info", "success", "warning", "error", "critical"]),
          category: z.enum([
            "system",
            "ocr_processing",
            "batch_processing",
            "lakehouse",
            "ingestion",
            "security",
            "admin",
          ]),
          title: z.string(),
          message: z.string(),
          priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
          actionUrl: z.string().optional(),
          metadata: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Only admins can create system notifications
        if (ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only admins can create system notifications",
          });
        }

        const { createNotification } = await import("./db");
        const notification = await createNotification({
          userId: null, // System-wide notification
          type: input.type,
          category: input.category,
          title: input.title,
          message: input.message,
          priority: input.priority || "medium",
          actionUrl: input.actionUrl,
          metadata: input.metadata,
        });

        if (!notification) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create notification",
          });
        }

        // Emit WebSocket notification to all users
        const { getWebSocketServer } = await import("./_core/websocket");
        const wsServer = getWebSocketServer();
        if (wsServer) {
          wsServer.io.emit("system:notification", {
            notification,
            timestamp: new Date().toISOString(),
          });
        }

        return { notification };
      }),
  }),

  // Ingestion framework
  ingestion: router({
    listConnectors: protectedProcedure.query(async () => {
      const { ENV } = await import("./_core/env");
      const response = await fetch(
        `${ENV.pythonApiUrl}/api/ingestion/connectors`
      );
      if (!response.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch connectors",
        });
        }
      return response.json();
    }),

    listJobs: protectedProcedure.query(async () => {
      const { ENV } = await import("./_core/env");
      const response = await fetch(`${ENV.pythonApiUrl}/api/ingestion/jobs`);
      if (!response.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch ingestion jobs",
        });
      }
      return response.json();
    }),

    createJob: protectedProcedure
      .input(
        z.object({
          name: z.string(),
          connectorType: z.string(),
          config: z.record(z.string(), z.any()),
          schedule: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { ENV } = await import("./_core/env");
        const response = await fetch(
          `${ENV.pythonApiUrl}/api/ingestion/jobs`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          }
        );
        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create ingestion job",
          });
        }
        return response.json();
      }),

    getJobLogs: protectedProcedure
      .input(z.object({ jobId: z.string() }))
      .query(async ({ input }) => {
        const { ENV } = await import("./_core/env");
        const response = await fetch(
          `${ENV.pythonApiUrl}/api/ingestion/jobs/${input.jobId}/logs`
        );
        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch job logs",
          });
        }
        return response.json();
      }),
  }),
});

/**
 * Compare extracted fields from multiple documents
 * Returns field-by-field comparison with difference indicators
 */
function compareExtractedFields(documents: any[]) {
  if (documents.length < 2) {
    return { fields: {}, hasDifferences: false };
  }

  // Collect all unique field names from all documents
  const allFieldNames = new Set<string>();
  documents.forEach((doc) => {
    if (doc.ocrResult?.extractedData) {
      Object.keys(doc.ocrResult.extractedData).forEach((field) =>
        allFieldNames.add(field)
      );
    }
  });

  // Compare each field across documents
  const fieldComparison: Record<string, any> = {};
  let hasDifferences = false;

  allFieldNames.forEach((fieldName) => {
    const values = documents.map((doc) => ({
      documentId: doc.id,
      value: doc.ocrResult?.extractedData?.[fieldName] ?? null,
      confidence: doc.ocrResult?.confidence ?? 0,
    }));

    // Check if all values are the same
    const uniqueValues = new Set(values.map((v) => JSON.stringify(v.value)));
    const isDifferent = uniqueValues.size > 1;

    if (isDifferent) {
      hasDifferences = true;
    }

    fieldComparison[fieldName] = {
      values,
      isDifferent,
      allPresent: values.every((v) => v.value !== null),
    };
  });

  return {
    fields: fieldComparison,
    hasDifferences,
    totalFields: allFieldNames.size,
    differingFields: Object.values(fieldComparison).filter(
      (f: any) => f.isDifferent
    ).length,
  };
}

/**
 * Process OCR for a document by calling the ensemble OCR service
 */
async function processOcr(
  documentId: number,
  userId: number,
  fileUrl: string,
  category: string,
  batchId?: number,
  templateId?: string
): Promise<void> {
  const { updateDocumentStatus, createOcrResult, getBatchById, updateBatchProgress, getBatchStatistics } = await import("./db");
  const { getWebSocketServer } = await import("./_core/websocket");
  const FormData = (await import('form-data')).default;
  const wsServer = getWebSocketServer();

  try {
    await updateDocumentStatus(documentId, "processing");
    
    // Notify via WebSocket
    if (wsServer) {
      wsServer.notifyDocumentStatus(userId, documentId, "processing");
    }

    // Call the ensemble OCR service
    const ocrServiceUrl =
      process.env.OCR_SERVICE_URL || "http://localhost:8001";

    // Fetch the image from S3
    const imageResponse = await fetch(fileUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image from S3: ${imageResponse.status}`);
    }
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Create form data for file upload
    const formData = new FormData();
    formData.append('file', imageBuffer, {
      filename: 'document.jpg',
      contentType: 'image/jpeg',
    });

    // Apply template settings if provided
    let ocrStrategy = 'highest_confidence';
    let confidenceThreshold = 85;
    
    if (templateId) {
      const { DOCUMENT_TEMPLATES } = await import('../shared/documentTemplates');
      const template = DOCUMENT_TEMPLATES.find(t => t.id === templateId);
      if (template) {
        ocrStrategy = template.ocrSettings?.strategy || template.ocrStrategy;
        confidenceThreshold = template.ocrSettings?.confidenceThreshold || template.confidenceThreshold;
        console.log(`[OCR] Applying template "${template.name}" settings: strategy=${ocrStrategy}, threshold=${confidenceThreshold}`);
      }
    }

    // Build query params
    const queryParams = new URLSearchParams({
      strategy: ocrStrategy,
    });
    if (category) {
      queryParams.append('document_type', category);
    }

    // Call OCR service with file upload endpoint (with retry logic)
    const maxRetries = 3;
    let lastError: Error | null = null;
    let response: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[OCR] Attempt ${attempt}/${maxRetries} for document ${documentId}`);
        
        response = await fetch(`${ocrServiceUrl}/ocr/file?${queryParams}`, {
          method: "POST",
          body: formData as any,
          headers: formData.getHeaders(),
          signal: AbortSignal.timeout(30000), // 30s timeout
        });

        if (response.ok) {
          break; // Success, exit retry loop
        } else if (response.status >= 500 && attempt < maxRetries) {
          // Server error, retry
          const errorText = await response.text();
          lastError = new Error(`OCR service returned ${response.status}: ${errorText}`);
          console.log(`[OCR] Retry ${attempt}/${maxRetries} due to server error: ${response.status}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
          continue;
        } else {
          // Client error or final attempt, throw
          const errorText = await response.text();
          throw new Error(`OCR service returned ${response.status}: ${errorText}`);
        }
      } catch (error: any) {
        lastError = error;
        if (attempt < maxRetries && (error.name === 'TimeoutError' || error.code === 'ECONNREFUSED')) {
          console.log(`[OCR] Retry ${attempt}/${maxRetries} due to ${error.name || error.code}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        throw error;
      }
    }

    if (!response || !response.ok) {
      throw lastError || new Error('OCR service failed after retries');
    }

    const ocrData = await response.json();

    // Store OCR result
    await createOcrResult({
      documentId,
      extractedText: ocrData.text || "",
      confidence: Math.round((ocrData.confidence || 0) * 100), // Store as 0-100 integer
      selectedEngine: ocrData.metadata?.selected_engine || null,
      strategy: ocrData.metadata?.strategy || null,
      processingTimeMs: ocrData.processing_time_ms || null,
      extractedData: ocrData.metadata?.fields_extracted
        ? JSON.stringify(ocrData.metadata.fields_extracted)
        : null,
      metadata: JSON.stringify(ocrData.metadata || {}),
    });

    await updateDocumentStatus(documentId, "completed");
    
    // Notify via WebSocket
    if (wsServer) {
      wsServer.notifyDocumentStatus(userId, documentId, "completed", {
        confidence: Math.round((ocrData.confidence || 0) * 100),
        processingTimeMs: ocrData.processing_time_ms || null,
      });
    }
    
    // Update batch progress if part of a batch
    if (batchId) {
      const stats = await getBatchStatistics(batchId);
      const batch = await getBatchById(batchId);
      if (batch) {
        await updateBatchProgress(batchId, {
          completedFiles: stats.completed,
          failedFiles: stats.failed,
          status: stats.completed + stats.failed === batch.totalFiles ? "completed" : "processing",
        });
        
        // Notify batch progress via WebSocket
        if (wsServer) {
          wsServer.notifyBatchProgress(userId, batchId, {
            completedFiles: stats.completed,
            failedFiles: stats.failed,
            totalFiles: batch.totalFiles,
            status: stats.completed + stats.failed === batch.totalFiles ? "completed" : "processing",
          });
        }
      }
    }
  } catch (error) {
    console.error("OCR processing error:", error);
    await updateDocumentStatus(documentId, "failed");
    
    // Notify via WebSocket
    if (wsServer) {
      wsServer.notifyDocumentStatus(userId, documentId, "failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    
    // Update batch progress if part of a batch
    if (batchId) {
      const stats = await getBatchStatistics(batchId);
      const batch = await getBatchById(batchId);
      if (batch) {
        await updateBatchProgress(batchId, {
          completedFiles: stats.completed,
          failedFiles: stats.failed,
          status: stats.failed === batch.totalFiles ? "failed" : "processing",
        });
        
        // Notify batch progress via WebSocket
        if (wsServer) {
          wsServer.notifyBatchProgress(userId, batchId, {
            completedFiles: stats.completed,
            failedFiles: stats.failed,
            totalFiles: batch.totalFiles,
            status: stats.failed === batch.totalFiles ? "failed" : "processing",
          });
        }
      }
    }
    
    throw error;
  }
}

export type AppRouter = typeof appRouter;
