import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import { z } from "zod";
import axios from "axios";

const ORCHESTRATION_API = process.env.ORCHESTRATION_API_URL || "http://localhost:8003";

export const orchestrationRouter = router({
  // Get real-time orchestration statistics
  getStats: publicProcedure.query(async () => {
    try {
      const response = await axios.get(`${ORCHESTRATION_API}/api/stats`, { timeout: 5000 });
      return response.data;
    } catch (error) {
      // Return empty stats on error
      return {
        activeJobs: [],
        queueStats: [],
        workers: [],
      };
    }
  }),

  processDocument: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        documentUrl: z.string(),
        metadata: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await axios.post(
          `${ORCHESTRATION_API}/api/workflows/process_document`,
          {
            document_id: input.documentId,
            document_url: input.documentUrl,
            user_id: ctx.user.id.toString(),
            metadata: input.metadata,
          },
          { timeout: 10000 }
        );
        return response.data;
      } catch (error) {
        throw new Error((error as any).response?.data?.error || (error as any).message);
      }
    }),

  processBatch: protectedProcedure
    .input(
      z.object({
        batchId: z.string(),
        documents: z.array(
          z.object({
            document_id: z.string(),
            document_url: z.string(),
          })
        ),
        metadata: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await axios.post(
          `${ORCHESTRATION_API}/api/workflows/process_batch`,
          {
            batch_id: input.batchId,
            documents: input.documents,
            user_id: ctx.user.id.toString(),
            batch_metadata: input.metadata,
          },
          { timeout: 10000 }
        );
        return response.data;
      } catch (error) {
        throw new Error((error as any).response?.data?.error || (error as any).message);
      }
    }),

  getBatchStatus: protectedProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ input }) => {
      try {
        const response = await axios.get(
          `${ORCHESTRATION_API}/api/workflows/batch/${input.batchId}/status`,
          { timeout: 5000 }
        );
        return response.data;
      } catch (error) {
        throw new Error((error as any).response?.data?.error || (error as any).message);
      }
    }),

  assignForReview: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        reviewerId: z.string(),
        reason: z.string(),
        priority: z.enum(["high", "normal", "low"]).default("normal"),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const response = await axios.post(
          `${ORCHESTRATION_API}/api/workflows/review/assign`,
          {
            document_id: input.documentId,
            reviewer_id: input.reviewerId,
            reason: input.reason,
            priority: input.priority,
          },
          { timeout: 10000 }
        );
        return response.data;
      } catch (error) {
        throw new Error((error as any).response?.data?.error || (error as any).message);
      }
    }),

  submitReview: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        reviewerId: z.string(),
        corrections: z.record(z.string(), z.any()),
        approved: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const response = await axios.post(
          `${ORCHESTRATION_API}/api/workflows/review/submit`,
          {
            document_id: input.documentId,
            reviewer_id: input.reviewerId,
            corrections: input.corrections,
            approved: input.approved,
          },
          { timeout: 10000 }
        );
        return response.data;
      } catch (error) {
        throw new Error((error as any).response?.data?.error || (error as any).message);
      }
    }),

  shareDocument: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        sharedWith: z.array(z.string()),
        permissions: z.record(
          z.string(),
          z.object({
            read: z.boolean(),
            write: z.boolean(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await axios.post(
          `${ORCHESTRATION_API}/api/workflows/share`,
          {
            document_id: input.documentId,
            owner_id: ctx.user.id.toString(),
            shared_with: input.sharedWith,
            permissions: input.permissions,
          },
          { timeout: 10000 }
        );
        return response.data;
      } catch (error) {
        throw new Error((error as any).response?.data?.error || (error as any).message);
      }
    }),

  getAuditTrail: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        const response = await axios.get(
          `${ORCHESTRATION_API}/api/workflows/audit/${input.documentId}`,
          {
            params: { user_id: ctx.user.id.toString() },
            timeout: 5000,
          }
        );
        return response.data;
      } catch (error) {
        throw new Error((error as any).response?.data?.error || (error as any).message);
      }
    }),

  routeDocument: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        documentUrl: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await axios.post(
          `${ORCHESTRATION_API}/api/workflows/route`,
          {
            document_id: input.documentId,
            document_url: input.documentUrl,
            user_id: ctx.user.id.toString(),
          },
          { timeout: 10000 }
        );
        return response.data;
      } catch (error) {
        throw new Error((error as any).response?.data?.error || (error as any).message);
      }
    }),

  syncToMobile: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        deviceId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await axios.post(
          `${ORCHESTRATION_API}/api/workflows/sync/to_mobile`,
          {
            document_id: input.documentId,
            user_id: ctx.user.id.toString(),
            device_id: input.deviceId,
          },
          { timeout: 10000 }
        );
        return response.data;
      } catch (error) {
        throw new Error((error as any).response?.data?.error || (error as any).message);
      }
    }),

  syncFromMobile: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        deviceId: z.string(),
        changes: z.record(z.string(), z.any()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await axios.post(
          `${ORCHESTRATION_API}/api/workflows/sync/from_mobile`,
          {
            document_id: input.documentId,
            user_id: ctx.user.id.toString(),
            device_id: input.deviceId,
            changes: input.changes,
          },
          { timeout: 10000 }
        );
        return response.data;
      } catch (error) {
        throw new Error((error as any).response?.data?.error || (error as any).message);
      }
    }),
});
