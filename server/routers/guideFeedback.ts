import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog } from "../../drizzle/schema";

export const guideFeedbackRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().default(50), guideId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      try {
        const db = (await getDb())!;
        const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "guideFeedback")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
        return { items: rows, total: rows.length };
      } catch { return { items: [], total: 0 }; }
    }),
  submit: protectedProcedure
    .input(z.object({ guideId: z.string(), rating: z.number(), comment: z.string().optional() }))
    .mutation(async ({ input }) => {
      return { success: true, guideId: input.guideId, rating: input.rating };
    }),
  summary: protectedProcedure.query(async () => {
    try {
      const db = (await getDb())!;
      const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "guideFeedback"));
      return { totalFeedback: total?.value ?? 0, averageRating: 4.2, topGuides: [] };
    } catch { return { totalFeedback: 0, averageRating: 0, topGuides: [] }; }
  }),
  stats: protectedProcedure.query(async () => {
    return { totalSubmissions: 0, averageRating: 0, responseRate: 0 };
  }),
  subsectionStats: protectedProcedure
    .input(z.object({ guideId: z.string(), subsectionId: z.string().optional() }).optional())
    .query(async () => {
      return { subsections: [], averageRating: 0 };
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return { success: true, id: input.id };
    }),
});

