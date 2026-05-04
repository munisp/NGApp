import { protectedProcedure, router } from '../_core/trpc';
import { z } from 'zod';
import { getDb } from '../db';
import { users, auditLogEntries } from '../../drizzle/schema';
import { eq, ilike, desc, sql, count } from 'drizzle-orm';

export const crmRouter = router({
  customers: router({
    list: protectedProcedure
      .input(z.object({
        limit: z.number().int().positive().max(100).default(50),
        offset: z.number().int().min(0).default(0),
        search: z.string().optional(),
        status: z.enum(['active', 'inactive', 'suspended']).optional(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        let query = db.select().from(users).limit(input.limit).offset(input.offset).orderBy(desc(users.createdAt));
        if (input.search) {
          query = query.where(ilike(users.name, `%${input.search}%`)) as typeof query;
        }
        return query;
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const result = await db.select().from(users).where(eq(users.id, input.id)).limit(1);
        return result[0] ?? null;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        fullName: z.string().optional(),
        phone: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { updated: false };
        const updates: Record<string, unknown> = {};
        if (input.fullName) updates.name = input.fullName;
        if (Object.keys(updates).length === 0) return { updated: false };
        await db.update(users).set(updates).where(eq(users.id, input.id));
        return { updated: true };
      }),

    activity: protectedProcedure
      .input(z.object({
        customerId: z.number(),
        limit: z.number().int().positive().max(100).default(20),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select()
          .from(auditLogEntries)
          .where(eq(auditLogEntries.userId, input.customerId))
          .orderBy(desc(auditLogEntries.createdAt))
          .limit(input.limit);
      }),
  }),

  leads: router({
    list: protectedProcedure
      .input(z.object({
        limit: z.number().int().positive().max(100).default(50),
        offset: z.number().int().min(0).default(0),
        status: z.enum(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']).optional(),
      }))
      .query(async () => {
        return { leads: [], total: 0 };
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        email: z.string().email(),
        phone: z.string().optional(),
        company: z.string().optional(),
        source: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return { id: Date.now(), ...input, status: 'new', assignedTo: ctx.user.id, createdAt: new Date() };
      }),
  }),

  inventory: router({
    products: protectedProcedure
      .input(z.object({
        limit: z.number().int().positive().max(100).default(50),
        offset: z.number().int().min(0).default(0),
        category: z.string().optional(),
        search: z.string().optional(),
      }))
      .query(async () => {
        return { products: [], total: 0 };
      }),

    stock: protectedProcedure
      .input(z.object({
        productId: z.string().optional(),
        warehouseId: z.string().optional(),
        belowMinimum: z.boolean().optional(),
      }))
      .query(async () => {
        return { stock: [], alerts: [] };
      }),

    movements: protectedProcedure
      .input(z.object({
        limit: z.number().int().positive().max(100).default(50),
        type: z.enum(['inbound', 'outbound', 'transfer', 'adjustment']).optional(),
      }))
      .query(async () => {
        return { movements: [], total: 0 };
      }),
  }),

  analytics: router({
    customerSegments: protectedProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) return [];
        const result = await db.select({
          segment: users.role,
          count: count(),
        }).from(users).groupBy(users.role);
        return result;
      }),

    revenueBySegment: protectedProcedure
      .input(z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }))
      .query(async () => {
        return { segments: [], totalRevenue: 0 };
      }),

    customerLifetimeValue: protectedProcedure
      .input(z.object({
        customerId: z.number().optional(),
      }))
      .query(async () => {
        return { averageLTV: 0, segments: [] };
      }),
  }),
});
