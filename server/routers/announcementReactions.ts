// @ts-nocheck
/**
 * Announcement Reactions & Comments Router
 * Handles emoji reactions, inline comments, and reaction aggregation
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

// ─── Types ───────────────────────────────────────────────────────────────────
const EMOJI_TYPES = ["thumbsUp", "thumbsDown", "heart", "eyes", "celebrate"] as const;

interface StoredReaction {
  id: string;
  announcementId: string;
  userId: string;
  emoji: typeof EMOJI_TYPES[number];
  createdAt: string;
}

interface StoredComment {
  id: string;
  announcementId: string;
  userId: string;
  userName: string;
  text: string;
  parentId: string | null;
  createdAt: string;
}

// ─── In-Memory Store (production: DB-backed) ─────────────────────────────────
const reactions: StoredReaction[] = [
  { id: "r1", announcementId: "ann_001", userId: "u1", emoji: "thumbsUp", createdAt: new Date(Date.now() - 7200000).toISOString() },
  { id: "r2", announcementId: "ann_001", userId: "u2", emoji: "heart", createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: "r3", announcementId: "ann_001", userId: "u3", emoji: "celebrate", createdAt: new Date(Date.now() - 1800000).toISOString() },
  { id: "r4", announcementId: "ann_002", userId: "u1", emoji: "eyes", createdAt: new Date(Date.now() - 900000).toISOString() },
  { id: "r5", announcementId: "ann_003", userId: "u2", emoji: "thumbsUp", createdAt: new Date(Date.now() - 600000).toISOString() },
];

const comments: StoredComment[] = [
  { id: "c1", announcementId: "ann_001", userId: "u1", userName: "Agent Musa", text: "Thanks for the heads up!", parentId: null, createdAt: new Date(Date.now() - 5400000).toISOString() },
  { id: "c2", announcementId: "ann_001", userId: "u2", userName: "Admin Fatima", text: "Will this affect settlement times?", parentId: null, createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: "c3", announcementId: "ann_001", userId: "u3", userName: "Agent Chidi", text: "Good question @Fatima — I'd like to know too", parentId: "c2", createdAt: new Date(Date.now() - 2400000).toISOString() },
  { id: "c4", announcementId: "ann_002", userId: "u1", userName: "Agent Musa", text: "Looking forward to the new features!", parentId: null, createdAt: new Date(Date.now() - 1200000).toISOString() },
];

let nextReactionId = 6;
let nextCommentId = 5;

// ─── Router ──────────────────────────────────────────────────────────────────
export const announcementReactionsRouter = router({
  // Get all reactions and comments for an announcement
  getReactions: protectedProcedure
    .input(z.object({ announcementId: z.string() }))
    .query(({ input }) => {
      const annReactions = reactions.filter((r: any) => r.announcementId === input.announcementId);
      const annComments = comments.filter((c: any) => c.announcementId === input.announcementId);

      // Aggregate reaction counts
      const counts: Record<string, { count: number; users: string[] }> = {};
      for (const emoji of EMOJI_TYPES) {
        const matching = annReactions.filter((r: any) => r.emoji === emoji);
        counts[emoji] = { count: matching.length, users: matching.map((r: any) => r.userId) };
      }

      return {
        reactions: counts,
        comments: annComments.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
        totalReactions: annReactions.length,
        totalComments: annComments.length,
      };
    }),

  // Toggle a reaction (add or remove)
  react: protectedProcedure
    .input(z.object({
      announcementId: z.string(),
      userId: z.string(),
      emoji: z.enum(EMOJI_TYPES),
    }))
    .mutation(({ input }) => {
      const existing = reactions.findIndex(
        (r) => r.announcementId === input.announcementId && r.userId === input.userId && r.emoji === input.emoji
      );

      if (existing >= 0) {
        // Remove reaction (toggle off)
        reactions.splice(existing, 1);
        return { action: "removed" as const, emoji: input.emoji };
      }

      // Add reaction
      const newReaction: StoredReaction = {
        id: `r${nextReactionId++}`,
        announcementId: input.announcementId,
        userId: input.userId,
        emoji: input.emoji,
        createdAt: new Date().toISOString(),
      };
      reactions.push(newReaction);
      return { action: "added" as const, emoji: input.emoji };
    }),

  // Add a comment to an announcement
  addComment: protectedProcedure
    .input(z.object({
      announcementId: z.string(),
      userId: z.string(),
      userName: z.string(),
      text: z.string().min(1).max(500),
      parentId: z.string().nullable().optional(),
    }))
    .mutation(({ input }) => {
      const newComment: StoredComment = {
        id: `c${nextCommentId++}`,
        announcementId: input.announcementId,
        userId: input.userId,
        userName: input.userName,
        text: input.text,
        parentId: input.parentId ?? null,
        createdAt: new Date().toISOString(),
      };
      comments.push(newComment);
      return newComment;
    }),

  // Delete a comment (author or admin only)
  deleteComment: protectedProcedure
    .input(z.object({ commentId: z.string(), userId: z.string() }))
    .mutation(({ input }) => {
      const idx = comments.findIndex((c) => c.id === input.commentId && c.userId === input.userId);
      if (idx < 0) throw new Error("Comment not found or not authorized");
      comments.splice(idx, 1);
      return { deleted: true };
    }),

  // Get reaction summary across all announcements (for admin stats)
  stats: protectedProcedure.query(() => {
    const totalReactions = reactions.length;
    const totalComments = comments.length;
    const emojiBreakdown: Record<string, number> = {};
    for (const emoji of EMOJI_TYPES) {
      emojiBreakdown[emoji] = reactions.filter((r: any) => r.emoji === emoji).length;
    }
    const topCommented = Array.from(
      comments.reduce((acc: any, c: any) => {
        acc.set(c.announcementId, (acc.get(c.announcementId) || 0) + 1);
        return acc;
      }, new Map<string, number>())
    )
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ announcementId: id, commentCount: count }));

    return { totalReactions, totalComments, emojiBreakdown, topCommented };
  }),
});
