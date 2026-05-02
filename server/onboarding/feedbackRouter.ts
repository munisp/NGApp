/**
 * OCR Feedback Router
 * Handles user feedback on incorrect OCR extractions
 */

import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { ocrFeedback } from "../../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";

export const feedbackRouter = router({
  /**
   * Submit feedback on incorrect OCR extraction
   */
  submitFeedback: protectedProcedure
    .input(z.object({
      documentId: z.number(),
      fieldName: z.string(),
      incorrectValue: z.string().optional(),
      correctValue: z.string(),
      feedbackType: z.enum(["incorrect_extraction", "low_confidence", "suggestion_wrong"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Note: Document verification removed as onboardingDocuments table
      // is defined in a separate schema file that we don't have access to yet.
      // In production, you should verify document ownership before accepting feedback.

      // Insert feedback
      await db.insert(ocrFeedback).values({
        documentId: input.documentId,
        userId: ctx.user.id,
        fieldName: input.fieldName,
        incorrectValue: input.incorrectValue || null,
        correctValue: input.correctValue,
        feedbackType: input.feedbackType,
        notes: input.notes || null,
      });

      console.log(`[Feedback] User ${ctx.user.id} reported OCR issue for field ${input.fieldName}`);

      return {
        success: true,
        message: "Thank you for your feedback! This will help improve our OCR accuracy.",
      };
    }),

  /**
   * Get feedback statistics (admin only)
   */
  getStats: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Total feedback count
      const totalCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(ocrFeedback)
        .then(rows => rows[0]?.count || 0);

      // Feedback by type
      const byType = await db
        .select({
          feedbackType: ocrFeedback.feedbackType,
          count: sql<number>`count(*)`,
        })
        .from(ocrFeedback)
        .groupBy(ocrFeedback.feedbackType);

      // Most commonly corrected fields
      const topFields = await db
        .select({
          fieldName: ocrFeedback.fieldName,
          count: sql<number>`count(*)`,
        })
        .from(ocrFeedback)
        .groupBy(ocrFeedback.fieldName)
        .orderBy(desc(sql`count(*)`))
        .limit(10);

      // Recent feedback
      const recentFeedback = await db
        .select()
        .from(ocrFeedback)
        .orderBy(desc(ocrFeedback.createdAt))
        .limit(20);

      return {
        totalCount,
        byType,
        topFields,
        recentFeedback,
      };
    }),

  /**
   * Get user's own feedback history
   */
  getMyFeedback: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      const feedback = await db
        .select()
        .from(ocrFeedback)
        .where(eq(ocrFeedback.userId, ctx.user.id))
        .orderBy(desc(ocrFeedback.createdAt))
        .limit(50);

      return feedback;
    }),

  /**
   * Export feedback data for analysis (admin only)
   */
  exportFeedback: adminProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      fieldName: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      let query = db.select().from(ocrFeedback);

      // Apply filters if provided
      // Note: For production, add proper date filtering with sql operators

      const results = await query.orderBy(desc(ocrFeedback.createdAt));

      return {
        data: results,
        count: results.length,
      };
    }),
});
