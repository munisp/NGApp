// Sprint 87: Widget computation, real-time aggregation, caching
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { analyticsDashboards } from "../../drizzle/schema";
import { eq, desc, and, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const WIDGET_TYPES = ["kpi_card", "line_chart", "bar_chart", "pie_chart", "table", "heatmap", "gauge"];
const MAX_WIDGETS_PER_DASHBOARD = 12;

export const analyticsDashboardsRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().default(20), offset: z.number().default(0) })).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(analyticsDashboards).orderBy(desc(analyticsDashboards.id)).limit(input.limit).offset(input.offset);
    const [{ total }] = await db.select({ total: count() }).from(analyticsDashboards);
    return { items: rows, total };
  }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [row] = await db.select().from(analyticsDashboards).where(eq(analyticsDashboards.id, input.id));
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Dashboard not found" });
    return row;
  }),
  create: protectedProcedure.input(z.object({ name: z.string().min(3), description: z.string().optional(), isPublic: z.boolean().default(false) })).mutation(async ({ input, ctx }) => {
    const db = (await getDb())!;
    const [existing] = await db.select().from(analyticsDashboards).where(eq(analyticsDashboards.name as any, input.name));
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "Dashboard with this name already exists" });
    const [row] = await db.insert(analyticsDashboards).values({ ...input, createdBy: ctx.user?.id } as any).returning();
    return row;
  }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.delete(analyticsDashboards).where(eq(analyticsDashboards.id, input.id));
    return { success: true };
  }),
  getWidgetTypes: protectedProcedure.query(() => ({ types: WIDGET_TYPES, maxPerDashboard: MAX_WIDGETS_PER_DASHBOARD })),
});
