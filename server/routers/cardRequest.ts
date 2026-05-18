import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { devices, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const cardRequestRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const conditions = [];
      if (input?.status) conditions.push(eq(devices.status, input.status));
      const rows = await db.select().from(devices).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(devices.createdAt)).limit(input?.limit ?? 50);
      return { requests: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  submit: protectedProcedure.input(z.object({ agentId: z.number(), cardType: z.string().default("debit") })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const ref = "CARD-" + crypto.randomUUID().slice(0, 12).toUpperCase();
      await db.insert(auditLog).values({ action: "card_requested", resource: "card_request", resourceId: ref, status: "success", metadata: { agentId: input.agentId, cardType: input.cardType } });
      return { ref, agentId: input.agentId, cardType: input.cardType, status: "pending" };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(devices).limit(100);
    return { totalDevices: Number(total.value) };
  }),
});
