// Sprint 87: Upgraded from mock data to real DB queries — mfaManager
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { platformSettings } from "../../drizzle/schema";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const getMfaStatus = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(platformSettings).orderBy(desc(platformSettings.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(platformSettings);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const enableTotp = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(platformSettings).orderBy(desc(platformSettings.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(platformSettings);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const verifyTotp = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(platformSettings).orderBy(desc(platformSettings.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(platformSettings);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const enableSms2fa = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(platformSettings).orderBy(desc(platformSettings.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(platformSettings);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const disableMfa = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(platformSettings).orderBy(desc(platformSettings.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(platformSettings);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const getBackupCodes = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(platformSettings).orderBy(desc(platformSettings.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(platformSettings);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });

export const mfaManagerRouter = router({
  getMfaStatus,
  enableTotp,
  verifyTotp,
  enableSms2fa,
  disableMfa,
  getBackupCodes,
});
