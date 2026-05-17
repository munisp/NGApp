/**
 * Report Template Designer Router
 * CRUD for custom report templates with widget selection and layout grid
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

// ─── Types ───────────────────────────────────────────────────────────────────
interface WidgetConfig {
  id: string;
  type: "chart" | "kpi" | "table" | "text";
  chartType?: "line" | "bar" | "area" | "pie" | "scatter" | "radar" | "funnel";
  title: string;
  dataSource: string;
  position: { x: number; y: number; w: number; h: number };
  config: Record<string, any>;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  ownerName: string;
  widgets: WidgetConfig[];
  columns: number;
  pageSize: "A4" | "letter" | "A3";
  orientation: "portrait" | "landscape";
  headerHtml: string;
  footerHtml: string;
  isDefault: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Available Widgets Catalog ───────────────────────────────────────────────
const WIDGET_CATALOG = [
  { type: "kpi", id: "kpi-total-volume", title: "Total Transaction Volume", dataSource: "analytics.overview", config: { metric: "totalVolume", format: "currency" } },
  { type: "kpi", id: "kpi-active-agents", title: "Active Agents", dataSource: "analytics.overview", config: { metric: "activeAgents", format: "number" } },
  { type: "kpi", id: "kpi-fraud-rate", title: "Fraud Rate", dataSource: "analytics.overview", config: { metric: "fraudRate", format: "percentage" } },
  { type: "kpi", id: "kpi-revenue", title: "Revenue", dataSource: "analytics.overview", config: { metric: "revenue", format: "currency" } },
  { type: "chart", id: "chart-tx-trend", title: "Transaction Trends", chartType: "area", dataSource: "analytics.transactionTrends", config: {} },
  { type: "chart", id: "chart-revenue-pie", title: "Revenue by Type", chartType: "pie", dataSource: "analytics.revenueBreakdown", config: {} },
  { type: "chart", id: "chart-agent-bar", title: "Top Agents", chartType: "bar", dataSource: "analytics.topAgents", config: {} },
  { type: "chart", id: "chart-fraud-area", title: "Fraud Trend", chartType: "area", dataSource: "analytics.fraudTrend", config: {} },
  { type: "chart", id: "chart-onboarding", title: "Onboarding Funnel", chartType: "funnel", dataSource: "analytics.onboardingFunnel", config: {} },
  { type: "chart", id: "chart-geo", title: "Geographic Distribution", chartType: "bar", dataSource: "analytics.geoDistribution", config: {} },
  { type: "chart", id: "chart-settlement", title: "Settlement Reconciliation", chartType: "line", dataSource: "analytics.settlement", config: {} },
  { type: "table", id: "table-recent-tx", title: "Recent Transactions", dataSource: "transactions.list", config: { limit: 20 } },
  { type: "table", id: "table-fraud-alerts", title: "Fraud Alerts", dataSource: "fraud.list", config: { limit: 10 } },
  { type: "table", id: "table-agents", title: "Agent Directory", dataSource: "agents.list", config: { limit: 20 } },
  { type: "text", id: "text-summary", title: "Executive Summary", dataSource: "none", config: { content: "Enter summary text..." } },
  { type: "text", id: "text-notes", title: "Notes & Comments", dataSource: "none", config: { content: "" } },
];

// ─── In-Memory Store ─────────────────────────────────────────────────────────
const templates: ReportTemplate[] = [
  {
    id: "rt_001", name: "Daily Operations Report", description: "Standard daily report with KPIs, transaction trends, and fraud summary",
    ownerId: "u1", ownerName: "Admin Fatima",
    widgets: [
      { id: "kpi-total-volume", type: "kpi", title: "Total Volume", dataSource: "analytics.overview", position: { x: 0, y: 0, w: 3, h: 1 }, config: { metric: "totalVolume" } },
      { id: "kpi-active-agents", type: "kpi", title: "Active Agents", dataSource: "analytics.overview", position: { x: 3, y: 0, w: 3, h: 1 }, config: { metric: "activeAgents" } },
      { id: "kpi-fraud-rate", type: "kpi", title: "Fraud Rate", dataSource: "analytics.overview", position: { x: 6, y: 0, w: 3, h: 1 }, config: { metric: "fraudRate" } },
      { id: "kpi-revenue", type: "kpi", title: "Revenue", dataSource: "analytics.overview", position: { x: 9, y: 0, w: 3, h: 1 }, config: { metric: "revenue" } },
      { id: "chart-tx-trend", type: "chart", chartType: "area", title: "Transaction Trends", dataSource: "analytics.transactionTrends", position: { x: 0, y: 1, w: 8, h: 3 }, config: {} },
      { id: "chart-fraud-area", type: "chart", chartType: "area", title: "Fraud Trend", dataSource: "analytics.fraudTrend", position: { x: 8, y: 1, w: 4, h: 3 }, config: {} },
    ],
    columns: 12, pageSize: "A4", orientation: "landscape",
    headerHtml: "<h1>54Link POS — Daily Operations Report</h1><p>Generated: {{date}}</p>",
    footerHtml: "<p>Confidential — 54Link Financial Services</p>",
    isDefault: true, usageCount: 45,
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "rt_002", name: "Weekly Agent Performance", description: "Agent leaderboard and onboarding funnel for weekly review",
    ownerId: "u2", ownerName: "Supervisor Chidi",
    widgets: [
      { id: "chart-agent-bar", type: "chart", chartType: "bar", title: "Top Agents", dataSource: "analytics.topAgents", position: { x: 0, y: 0, w: 6, h: 4 }, config: {} },
      { id: "chart-onboarding", type: "chart", chartType: "funnel", title: "Onboarding Funnel", dataSource: "analytics.onboardingFunnel", position: { x: 6, y: 0, w: 6, h: 4 }, config: {} },
      { id: "table-agents", type: "table", title: "Agent Directory", dataSource: "agents.list", position: { x: 0, y: 4, w: 12, h: 4 }, config: { limit: 20 } },
    ],
    columns: 12, pageSize: "A4", orientation: "portrait",
    headerHtml: "<h1>Weekly Agent Performance Report</h1>",
    footerHtml: "<p>54Link POS — Confidential</p>",
    isDefault: false, usageCount: 18,
    createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
];

let nextTemplateId = 3;

// ─── Router ──────────────────────────────────────────────────────────────────
export const reportTemplateDesignerRouter = router({
  // Get widget catalog
  widgetCatalog: protectedProcedure.query(() => WIDGET_CATALOG),

  // List all templates
  list: protectedProcedure
    .input(z.object({ search: z.string().optional(), limit: z.number().optional() }).optional())
    .query(({ input }) => {
      let filtered = [...templates];
      if (input?.search) {
        const q = input.search.toLowerCase();
        filtered = filtered.filter((t: any) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
      }
      filtered.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      return { templates: filtered.slice(0, input?.limit ?? 50), total: filtered.length };
    }),

  // Get a single template
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const t = templates.find((t: any) => t.id === input.id);
      if (!t) throw new Error("Template not found");
      return t;
    }),

  // Create a new template
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      ownerId: z.string(),
      ownerName: z.string(),
      widgets: z.array(z.any()),
      columns: z.number().min(1).max(24).optional(),
      pageSize: z.enum(["A4", "letter", "A3"]).optional(),
      orientation: z.enum(["portrait", "landscape"]).optional(),
      headerHtml: z.string().optional(),
      footerHtml: z.string().optional(),
    }))
    .mutation(({ input }) => {
      const newTemplate: ReportTemplate = {
        id: `rt_${String(nextTemplateId++).padStart(3, "0")}`,
        name: input.name,
        description: input.description ?? "",
        ownerId: input.ownerId,
        ownerName: input.ownerName,
        widgets: input.widgets,
        columns: input.columns ?? 12,
        pageSize: input.pageSize ?? "A4",
        orientation: input.orientation ?? "landscape",
        headerHtml: input.headerHtml ?? "",
        footerHtml: input.footerHtml ?? "",
        isDefault: false,
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      templates.push(newTemplate);
      return newTemplate;
    }),

  // Update a template
  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      widgets: z.array(z.any()).optional(),
      columns: z.number().optional(),
      pageSize: z.enum(["A4", "letter", "A3"]).optional(),
      orientation: z.enum(["portrait", "landscape"]).optional(),
      headerHtml: z.string().optional(),
      footerHtml: z.string().optional(),
    }))
    .mutation(({ input }) => {
      const t = templates.find((t: any) => t.id === input.id);
      if (!t) throw new Error("Template not found");
      if (input.name) t.name = input.name;
      if (input.description !== undefined) t.description = input.description;
      if (input.widgets) t.widgets = input.widgets;
      if (input.columns) t.columns = input.columns;
      if (input.pageSize) t.pageSize = input.pageSize;
      if (input.orientation) t.orientation = input.orientation;
      if (input.headerHtml !== undefined) t.headerHtml = input.headerHtml;
      if (input.footerHtml !== undefined) t.footerHtml = input.footerHtml;
      t.updatedAt = new Date().toISOString();
      return t;
    }),

  // Delete a template
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const idx = templates.findIndex((t) => t.id === input.id);
      if (idx < 0) throw new Error("Template not found");
      templates.splice(idx, 1);
      return { deleted: true };
    }),

  // Set as default
  setDefault: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      for (const t of templates) t.isDefault = false;
      const t = templates.find((t: any) => t.id === input.id);
      if (!t) throw new Error("Template not found");
      t.isDefault = true;
      return { success: true } as any;
    }),
});
