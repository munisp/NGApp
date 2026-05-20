import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { biReportDefinitions } from "../../drizzle/schema";
import { desc, eq, count } from "drizzle-orm";

export const reportTemplateDesignerRouter = router({
  widgetCatalog: protectedProcedure.query(async () => {
    return [
      { type: "kpi", label: "KPI Card", description: "Single metric display" },
      { type: "chart", label: "Chart", description: "Line, bar, or pie chart" },
      { type: "table", label: "Data Table", description: "Tabular data display" },
      { type: "map", label: "Map", description: "Geographic visualization" },
      { type: "gauge", label: "Gauge", description: "Progress/threshold meter" },
    ];
  }),
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { items: [], total: 0 };
    const rows = await db.select().from(biReportDefinitions).orderBy(desc(biReportDefinitions.id)).limit(50);
    const [{ total }] = await db.select({ total: count() }).from(biReportDefinitions);
    return { items: rows, total };
  }),
  create: protectedProcedure
    .input(z.object({ name: z.string(), widgets: z.array(z.any()) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { id: `tmpl_${Date.now()}`, name: input.name };
      const [row] = await db.insert(biReportDefinitions).values({ name: input.name, config: JSON.stringify(input.widgets) } as any).returning();
      return row;
    }),
  update: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().optional(), widgets: z.array(z.any()).optional() }))
    .mutation(async ({ input }) => {
      return { success: true };
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return { success: true };
    }),
  setDefault: protectedProcedure.input(z.object({})).mutation(async () => {
    return { success: true };
  }),
});
