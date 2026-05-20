import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

const PERMISSION_LEVELS = ["view-only", "can-edit", "can-fork"] as const;

export const sharedLayoutsRouter = router({
  gallery: protectedProcedure
    .input(
      z
        .object({ search: z.string().optional(), tag: z.string().optional() })
        .optional()
    )
    .query(async () => {
      return {
        items: [],
        total: 0,
        tags: ["finance", "operations", "analytics"],
      };
    }),
  share: protectedProcedure
    .input(
      z.object({ layoutId: z.string(), permission: z.enum(PERMISSION_LEVELS) })
    )
    .mutation(async ({ input }) => {
      return { success: true, shareUrl: `/shared/${input.layoutId}` };
    }),
  import: protectedProcedure
    .input(z.object({ shareId: z.string() }))
    .mutation(async ({ input }) => {
      return { success: true, layoutId: `layout_${Date.now()}` };
    }),
  fork: protectedProcedure
    .input(z.object({ layoutId: z.string(), name: z.string().optional() }))
    .mutation(async ({ input }) => {
      return { success: true, newLayoutId: `fork_${Date.now()}` };
    }),
  list: protectedProcedure.query(async () => {
    return { items: [], total: 0 };
  }),
});
