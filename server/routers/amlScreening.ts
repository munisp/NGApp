import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

export const amlScreeningRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      return { items: [], total: 0, limit: input.limit, offset: input.offset };
    }),
});
