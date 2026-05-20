import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

const EMOJI_TYPES = [
  "thumbsUp",
  "heart",
  "celebrate",
  "thumbsDown",
  "eyes",
] as const;

export const announcementReactionsRouter = router({
  getReactions: protectedProcedure
    .input(z.object({ announcementId: z.string() }))
    .query(async ({ input }) => {
      return {
        announcementId: input.announcementId,
        reactions: { thumbsUp: 5, heart: 3, celebrate: 2 },
        comments: [],
      };
    }),
  react: protectedProcedure
    .input(z.object({ announcementId: z.string(), emoji: z.enum(EMOJI_TYPES) }))
    .mutation(async ({ input }) => {
      return { success: true };
    }),
  addComment: protectedProcedure
    .input(z.object({ announcementId: z.string(), text: z.string() }))
    .mutation(async ({ input }) => {
      return {
        id: `cmt_${Date.now()}`,
        text: input.text,
        createdAt: new Date().toISOString(),
      };
    }),
  list: protectedProcedure
    .input(
      z
        .object({ limit: z.number().optional(), offset: z.number().optional() })
        .optional()
    )
    .query(async () => {
      return { items: [], total: 0 };
    }),
});
