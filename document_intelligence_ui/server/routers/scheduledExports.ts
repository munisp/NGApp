import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { scheduledExports, exportExecutions } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const scheduledExportsRouter = router({
  /**
   * List all scheduled exports for the current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const exports = await db
      .select()
      .from(scheduledExports)
      .where(eq(scheduledExports.userId, ctx.user.id))
      .orderBy(desc(scheduledExports.createdAt));

    return exports.map((exp) => ({
      ...exp,
      selectedFields: exp.selectedFields ? JSON.parse(exp.selectedFields) : null,
      emailRecipients: exp.emailRecipients ? JSON.parse(exp.emailRecipients) : null,
    }));
  }),

  /**
   * Get a single scheduled export by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db
        .select()
        .from(scheduledExports)
        .where(
          and(
            eq(scheduledExports.id, input.id),
            eq(scheduledExports.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (result.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scheduled export not found",
        });
      }

      const exp = result[0];
      return {
        ...exp,
        selectedFields: exp.selectedFields ? JSON.parse(exp.selectedFields) : null,
        emailRecipients: exp.emailRecipients ? JSON.parse(exp.emailRecipients) : null,
      };
    }),

  /**
   * Create a new scheduled export
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        exportFormat: z.enum(["csv", "json"]).default("csv"),
        category: z.string().optional(),
        status: z.enum(["pending", "processing", "completed", "failed"]).optional(),
        includeOcrResults: z.boolean().default(true),
        selectedFields: z.array(z.string()).optional(),
        scheduleType: z.enum(["once", "daily", "weekly", "monthly", "custom"]),
        cronExpression: z.string().optional(),
        nextRunAt: z.date().optional(),
        emailRecipients: z.array(z.string().email()).optional(),
        emailSubject: z.string().max(255).optional(),
        emailBody: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Calculate next run time based on schedule type
      let nextRunAt = input.nextRunAt;
      if (!nextRunAt) {
        const now = new Date();
        switch (input.scheduleType) {
          case "once":
            nextRunAt = new Date(now.getTime() + 60000); // 1 minute from now
            break;
          case "daily":
            nextRunAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
            break;
          case "weekly":
            nextRunAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
            break;
          case "monthly":
            nextRunAt = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
            break;
          case "custom":
            if (!input.cronExpression) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Cron expression required for custom schedule",
              });
            }
            // For custom, use provided nextRunAt or default to 1 hour
            nextRunAt = new Date(now.getTime() + 60 * 60 * 1000);
            break;
        }
      }

      const result = await db.insert(scheduledExports).values({
        userId: ctx.user.id,
        name: input.name,
        description: input.description || null,
        exportFormat: input.exportFormat,
        category: input.category || null,
        status: input.status || null,
        includeOcrResults: input.includeOcrResults ? 1 : 0,
        selectedFields: input.selectedFields ? JSON.stringify(input.selectedFields) : null,
        scheduleType: input.scheduleType,
        cronExpression: input.cronExpression || null,
        nextRunAt,
        emailRecipients: input.emailRecipients ? JSON.stringify(input.emailRecipients) : null,
        emailSubject: input.emailSubject || null,
        emailBody: input.emailBody || null,
        isActive: 1,
        runCount: 0,
      });

      // Get the inserted ID from the result
      const insertedId = Array.isArray(result) && result.length > 0 && typeof result[0] === 'object' && 'insertId' in result[0]
        ? Number(result[0].insertId)
        : 0;

      return {
        id: insertedId,
        message: "Scheduled export created successfully",
      };
    }),

  /**
   * Update a scheduled export
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        exportFormat: z.enum(["csv", "json"]).optional(),
        category: z.string().optional(),
        status: z.enum(["pending", "processing", "completed", "failed"]).optional(),
        includeOcrResults: z.boolean().optional(),
        selectedFields: z.array(z.string()).optional(),
        scheduleType: z.enum(["once", "daily", "weekly", "monthly", "custom"]).optional(),
        cronExpression: z.string().optional(),
        nextRunAt: z.date().optional(),
        emailRecipients: z.array(z.string().email()).optional(),
        emailSubject: z.string().max(255).optional(),
        emailBody: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const existing = await db
        .select()
        .from(scheduledExports)
        .where(
          and(
            eq(scheduledExports.id, input.id),
            eq(scheduledExports.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scheduled export not found",
        });
      }

      const updateData: any = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.exportFormat !== undefined) updateData.exportFormat = input.exportFormat;
      if (input.category !== undefined) updateData.category = input.category;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.includeOcrResults !== undefined) updateData.includeOcrResults = input.includeOcrResults ? 1 : 0;
      if (input.selectedFields !== undefined) updateData.selectedFields = JSON.stringify(input.selectedFields);
      if (input.scheduleType !== undefined) updateData.scheduleType = input.scheduleType;
      if (input.cronExpression !== undefined) updateData.cronExpression = input.cronExpression;
      if (input.nextRunAt !== undefined) updateData.nextRunAt = input.nextRunAt;
      if (input.emailRecipients !== undefined) updateData.emailRecipients = JSON.stringify(input.emailRecipients);
      if (input.emailSubject !== undefined) updateData.emailSubject = input.emailSubject;
      if (input.emailBody !== undefined) updateData.emailBody = input.emailBody;
      if (input.isActive !== undefined) updateData.isActive = input.isActive ? 1 : 0;

      await db
        .update(scheduledExports)
        .set(updateData)
        .where(eq(scheduledExports.id, input.id));

      return { success: true, message: "Scheduled export updated successfully" };
    }),

  /**
   * Delete a scheduled export
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const existing = await db
        .select()
        .from(scheduledExports)
        .where(
          and(
            eq(scheduledExports.id, input.id),
            eq(scheduledExports.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scheduled export not found",
        });
      }

      await db.delete(scheduledExports).where(eq(scheduledExports.id, input.id));

      return { success: true, message: "Scheduled export deleted successfully" };
    }),

  /**
   * Pause/Resume a scheduled export
   */
  toggleActive: protectedProcedure
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const existing = await db
        .select()
        .from(scheduledExports)
        .where(
          and(
            eq(scheduledExports.id, input.id),
            eq(scheduledExports.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scheduled export not found",
        });
      }

      await db
        .update(scheduledExports)
        .set({ isActive: input.isActive ? 1 : 0 })
        .where(eq(scheduledExports.id, input.id));

      return {
        success: true,
        message: input.isActive ? "Export schedule resumed" : "Export schedule paused",
      };
    }),

  /**
   * Get execution history for a scheduled export
   */
  getExecutionHistory: protectedProcedure
    .input(z.object({ scheduledExportId: z.number(), limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership of the scheduled export
      const exportRecord = await db
        .select()
        .from(scheduledExports)
        .where(
          and(
            eq(scheduledExports.id, input.scheduledExportId),
            eq(scheduledExports.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (exportRecord.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scheduled export not found",
        });
      }

      const executions = await db
        .select()
        .from(exportExecutions)
        .where(eq(exportExecutions.scheduledExportId, input.scheduledExportId))
        .orderBy(desc(exportExecutions.startedAt))
        .limit(input.limit);

      return executions;
    }),

  /**
   * Manually trigger a scheduled export (run now)
   */
  runNow: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const existing = await db
        .select()
        .from(scheduledExports)
        .where(
          and(
            eq(scheduledExports.id, input.id),
            eq(scheduledExports.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scheduled export not found",
        });
      }

      // Trigger the export job (will be implemented with Celery integration)
      // For now, just update nextRunAt to trigger on next scheduler run
      await db
        .update(scheduledExports)
        .set({ nextRunAt: new Date() })
        .where(eq(scheduledExports.id, input.id));

      return {
        success: true,
        message: "Export job queued for immediate execution",
      };
    }),
});
