import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

const WIDGET_CATALOG = [
  { type: "kpi", label: "KPI Card", description: "Single metric display" },
  { type: "chart", label: "Chart", description: "Line, bar, or pie chart" },
  { type: "table", label: "Data Table", description: "Tabular data display" },
  { type: "map", label: "Map", description: "Geographic visualization" },
  { type: "gauge", label: "Gauge", description: "Progress/threshold meter" },
];

export const reportTemplateDesignerRouter = router({
  widgetCatalog: protectedProcedure.query(async () => {
    return WIDGET_CATALOG;
  }),
  list: protectedProcedure.query(async () => {
    return { items: [], total: 0 };
  }),
  create: protectedProcedure
    .input(z.object({ name: z.string(), widgets: z.array(z.any()) }))
    .mutation(async ({ input }) => {
      return { id: `tmpl_${Date.now()}`, name: input.name };
    }),
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        widgets: z.array(z.any()).optional(),
      })
    )
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
