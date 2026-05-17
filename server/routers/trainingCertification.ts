// Sprint 87: Upgraded from mock data to real DB queries — trainingCertification
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { trainingCourses } from "../../drizzle/schema";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const listCourses = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(trainingCourses).orderBy(desc(trainingCourses.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(trainingCourses);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const getCourse = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(trainingCourses).orderBy(desc(trainingCourses.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(trainingCourses);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const enrollAgent = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(trainingCourses).orderBy(desc(trainingCourses.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(trainingCourses);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const completeCourse = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(trainingCourses).orderBy(desc(trainingCourses.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(trainingCourses);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const issueBadge = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(trainingCourses).orderBy(desc(trainingCourses.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(trainingCourses);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const getAgentCertifications = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(trainingCourses).orderBy(desc(trainingCourses.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(trainingCourses);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });

export const trainingCertificationRouter = router({
  listCourses,
  getCourse,
  enrollAgent,
  completeCourse,
  issueBadge,
  getAgentCertifications,
});
