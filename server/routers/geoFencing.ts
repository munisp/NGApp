import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

export const geoFencingRouter = router({
  list: protectedProcedure.query(async () => {
    return { items: [], total: 0 };
  }),
  create: protectedProcedure.input(z.object({ name: z.string(), lat: z.number(), lng: z.number(), radius: z.number() })).mutation(async ({ input }) => {
    return { id: `geo_${Date.now()}`, ...input };
  }),
  check: protectedProcedure.input(z.object({ lat: z.number(), lng: z.number() })).query(async ({ input }) => {
    return { inZone: true, zoneName: "Lagos Central" };
  }),
  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async () => ({ success: true })),
});
