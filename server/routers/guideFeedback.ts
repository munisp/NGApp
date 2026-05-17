/**
 * guideFeedback — tRPC router for user feedback & ratings on User Guide sections
 * 
 * Features:
 * - Submit thumbs up/down rating + optional text feedback per section
 * - List all feedback (admin view)
 * - Get aggregate stats per section (avg rating, count)
 * - Delete feedback (admin)
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

// ─── In-Memory Store ────────────────────────────────────────────────────────
interface GuideFeedback {
  id: string;
  sectionId: string;
  subsectionId: string;
  rating: "up" | "down";
  comment: string;
  userId?: string;
  userName?: string;
  createdAt: string;
}

const feedbackStore: GuideFeedback[] = [];
let nextId = 1;

// Seed some demo feedback
const seedFeedback: Omit<GuideFeedback, "id">[] = [
  { sectionId: "getting-started", subsectionId: "overview", rating: "up", comment: "Very clear introduction!", createdAt: new Date(Date.now() - 86400000 * 3).toISOString() },
  { sectionId: "getting-started", subsectionId: "first-login", rating: "up", comment: "Step-by-step was helpful", createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
  { sectionId: "getting-started", subsectionId: "first-login", rating: "up", comment: "", createdAt: new Date(Date.now() - 86400000).toISOString() },
  { sectionId: "pos-terminal", subsectionId: "cash-in", rating: "up", comment: "Great walkthrough", createdAt: new Date(Date.now() - 86400000 * 4).toISOString() },
  { sectionId: "pos-terminal", subsectionId: "cash-out", rating: "down", comment: "Needs more detail on error handling", createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
  { sectionId: "fraud-detection", subsectionId: "ai-scoring", rating: "up", comment: "AI explanation was very helpful", createdAt: new Date(Date.now() - 86400000).toISOString() },
  { sectionId: "fraud-detection", subsectionId: "alert-management", rating: "up", comment: "", createdAt: new Date(Date.now() - 86400000 * 5).toISOString() },
  { sectionId: "fraud-detection", subsectionId: "alert-management", rating: "down", comment: "Could use screenshots", createdAt: new Date(Date.now() - 86400000 * 3).toISOString() },
  { sectionId: "kyc-verification", subsectionId: "document-upload", rating: "up", comment: "Clear instructions", createdAt: new Date(Date.now() - 86400000 * 6).toISOString() },
  { sectionId: "kyc-verification", subsectionId: "review-process", rating: "up", comment: "", createdAt: new Date(Date.now() - 86400000 * 4).toISOString() },
  { sectionId: "reports", subsectionId: "weekly-reports", rating: "up", comment: "Very useful", createdAt: new Date(Date.now() - 86400000 * 7).toISOString() },
  { sectionId: "reports", subsectionId: "weekly-reports", rating: "down", comment: "How do I customize report templates?", createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
  { sectionId: "settings", subsectionId: "notifications", rating: "up", comment: "", createdAt: new Date(Date.now() - 86400000 * 8).toISOString() },
  { sectionId: "troubleshooting", subsectionId: "error-codes", rating: "up", comment: "Saved me a lot of time", createdAt: new Date(Date.now() - 86400000).toISOString() },
  { sectionId: "troubleshooting", subsectionId: "error-codes", rating: "up", comment: "Comprehensive list", createdAt: new Date(Date.now() - 86400000 * 3).toISOString() },
  { sectionId: "faq", subsectionId: "general", rating: "up", comment: "", createdAt: new Date(Date.now() - 86400000 * 5).toISOString() },
];

// Initialize seed data
seedFeedback.forEach(f => {
  feedbackStore.push({ ...f, id: `gf-${nextId++}` });
});

// ─── Router ─────────────────────────────────────────────────────────────────
export const guideFeedbackRouter = router({
  /** Submit feedback for a guide section */
  submit: protectedProcedure
    .input(z.object({
      sectionId: z.string(),
      subsectionId: z.string(),
      rating: z.enum(["up", "down"]),
      comment: z.string().max(500).default(""),
      userName: z.string().optional(),
    }))
    .mutation(({ input }) => {
      const feedback: GuideFeedback = {
        id: `gf-${nextId++}`,
        sectionId: input.sectionId,
        subsectionId: input.subsectionId,
        rating: input.rating,
        comment: input.comment,
        userName: input.userName,
        createdAt: new Date().toISOString(),
      };
      feedbackStore.push(feedback);
      return { success: true, id: feedback.id };
    }),

  /** Get aggregate stats per section */
  stats: protectedProcedure.query(() => {
    const sectionStats: Record<string, { up: number; down: number; total: number; comments: number }> = {};

    feedbackStore.forEach(f => {
      if (!sectionStats[f.sectionId]) {
        sectionStats[f.sectionId] = { up: 0, down: 0, total: 0, comments: 0 };
      }
      sectionStats[f.sectionId].total++;
      if (f.rating === "up") sectionStats[f.sectionId].up++;
      else sectionStats[f.sectionId].down++;
      if (f.comment) sectionStats[f.sectionId].comments++;
    });

    return sectionStats;
  }),

  /** Get detailed stats per subsection */
  subsectionStats: protectedProcedure
    .input(z.object({ sectionId: z.string() }))
    .query(({ input }) => {
      const filtered = feedbackStore.filter(f => f.sectionId === input.sectionId);
      const subStats: Record<string, { up: number; down: number; total: number }> = {};

      filtered.forEach(f => {
        if (!subStats[f.subsectionId]) {
          subStats[f.subsectionId] = { up: 0, down: 0, total: 0 };
        }
        subStats[f.subsectionId].total++;
        if (f.rating === "up") subStats[f.subsectionId].up++;
        else subStats[f.subsectionId].down++;
      });

      return subStats;
    }),

  /** List all feedback (admin view) */
  list: protectedProcedure
    .input(z.object({
      sectionId: z.string().optional(),
      rating: z.enum(["up", "down"]).optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(({ input }) => {
      let filtered = [...feedbackStore];
      if (input.sectionId) filtered = filtered.filter(f => f.sectionId === input.sectionId);
      if (input.rating) filtered = filtered.filter(f => f.rating === input.rating);

      // Sort by newest first
      filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return {
        items: filtered.slice(input.offset, input.offset + input.limit),
        total: filtered.length,
      };
    }),

  /** Delete feedback (admin) */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const idx = feedbackStore.findIndex(f => f.id === input.id);
      if (idx === -1) return { success: false, error: "Not found" };
      feedbackStore.splice(idx, 1);
      return { success: true } as any;
    }),

  /** Get overall summary */
  summary: protectedProcedure.query(() => {
    const total = feedbackStore.length;
    const upCount = feedbackStore.filter(f => f.rating === "up").length;
    const downCount = feedbackStore.filter(f => f.rating === "down").length;
    const withComments = feedbackStore.filter(f => f.comment).length;
    const satisfactionRate = total > 0 ? Math.round((upCount / total) * 100) : 0;

    // Recent feedback (last 7 days)
    const weekAgo = Date.now() - 7 * 86400000;
    const recentCount = feedbackStore.filter(f => new Date(f.createdAt).getTime() > weekAgo).length;

    return {
      total,
      upCount,
      downCount,
      withComments,
      satisfactionRate,
      recentCount,
    };
  }),
});
