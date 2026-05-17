/**
 * Dashboard Layout — Persist drag-and-drop layout preferences per user
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

// ─── Types ───────────────────────────────────────────────────────────────────
interface LayoutItem {
  i: string; // widget ID
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  static?: boolean;
}

interface UserLayout {
  userId: string;
  layoutName: string;
  layouts: { lg: LayoutItem[]; md: LayoutItem[]; sm: LayoutItem[] };
  updatedAt: number;
}

// ─── Preset Templates ────────────────────────────────────────────────────────
const WIDGET_CATALOG = [
  { id: "kpi-overview", name: "KPI Overview", category: "overview", defaultW: 12, defaultH: 3, minW: 6, minH: 2 },
  { id: "tx-volume-trend", name: "Transaction Volume Trend", category: "transactions", defaultW: 8, defaultH: 4, minW: 4, minH: 3 },
  { id: "tx-type-pie", name: "Transaction Type Distribution", category: "transactions", defaultW: 4, defaultH: 4, minW: 3, minH: 3 },
  { id: "agent-leaderboard", name: "Top Agents Leaderboard", category: "agents", defaultW: 6, defaultH: 5, minW: 4, minH: 3 },
  { id: "agent-tier-bar", name: "Agent Tier Distribution", category: "agents", defaultW: 6, defaultH: 5, minW: 4, minH: 3 },
  { id: "fraud-stacked", name: "Fraud Detection Trends", category: "risk", defaultW: 8, defaultH: 4, minW: 4, minH: 3 },
  { id: "fraud-severity-pie", name: "Fraud Severity Breakdown", category: "risk", defaultW: 4, defaultH: 4, minW: 3, minH: 3 },
  { id: "settlement-bar", name: "Settlement Reconciliation", category: "finance", defaultW: 6, defaultH: 4, minW: 4, minH: 3 },
  { id: "revenue-trend", name: "Revenue Trend", category: "finance", defaultW: 6, defaultH: 4, minW: 4, minH: 3 },
  { id: "kyc-approval-line", name: "KYC Approval Rate", category: "compliance", defaultW: 6, defaultH: 4, minW: 4, minH: 3 },
  { id: "active-users", name: "Active Users Counter", category: "overview", defaultW: 3, defaultH: 2, minW: 2, minH: 2 },
  { id: "geo-distribution", name: "Geographic Distribution", category: "overview", defaultW: 6, defaultH: 4, minW: 4, minH: 3 },
];

const PRESETS: Record<string, { name: string; description: string; widgets: string[] }> = {
  executive: {
    name: "Executive Overview",
    description: "High-level KPIs, revenue trends, and agent performance",
    widgets: ["kpi-overview", "revenue-trend", "tx-volume-trend", "agent-leaderboard", "active-users"],
  },
  operations: {
    name: "Operations Dashboard",
    description: "Transaction monitoring, settlement, and fraud detection",
    widgets: ["kpi-overview", "tx-volume-trend", "tx-type-pie", "fraud-stacked", "settlement-bar", "active-users"],
  },
  compliance: {
    name: "Compliance & Risk",
    description: "Fraud alerts, KYC status, and compliance metrics",
    widgets: ["kpi-overview", "fraud-stacked", "fraud-severity-pie", "kyc-approval-line", "geo-distribution"],
  },
  full: {
    name: "Full Dashboard",
    description: "All available widgets in default layout",
    widgets: WIDGET_CATALOG.map((w: any) => w.id),
  },
};

function generateLayout(widgetIds: string[]): { lg: LayoutItem[]; md: LayoutItem[]; sm: LayoutItem[] } {
  let yPos = 0;
  const lg: LayoutItem[] = [];
  const md: LayoutItem[] = [];
  const sm: LayoutItem[] = [];

  let xPos = 0;
  for (const wid of widgetIds) {
    const widget = WIDGET_CATALOG.find((w: any) => w.id === wid);
    if (!widget) continue;

    if (xPos + widget.defaultW > 12) { xPos = 0; yPos += 4; }

    lg.push({ i: wid, x: xPos, y: yPos, w: widget.defaultW, h: widget.defaultH, minW: widget.minW, minH: widget.minH });
    md.push({ i: wid, x: 0, y: md.length * 4, w: Math.min(widget.defaultW, 10), h: widget.defaultH, minW: widget.minW, minH: widget.minH });
    sm.push({ i: wid, x: 0, y: sm.length * 4, w: 6, h: widget.defaultH, minW: 3, minH: widget.minH });

    xPos += widget.defaultW;
  }
  return { lg, md, sm };
}

// ─── In-memory store ─────────────────────────────────────────────────────────
const userLayouts: Map<string, UserLayout> = new Map();

// ─── Router ──────────────────────────────────────────────────────────────────
export const dashboardLayoutRouter = router({
  getLayout: protectedProcedure
    .input(z.object({ userId: z.string().optional() }))
    .query(({ input }) => {
      const userId = input.userId ?? "default";
      const saved = userLayouts.get(userId);
      if (saved) return { layout: saved, isCustom: true };
      // Return default full layout
      return {
        layout: {
          userId,
          layoutName: "Default",
          layouts: generateLayout(PRESETS.full.widgets),
          updatedAt: Date.now(),
        },
        isCustom: false,
      };
    }),

  saveLayout: protectedProcedure
    .input(
      z.object({
        userId: z.string().optional(),
        layoutName: z.string().optional(),
        layouts: z.object({
          lg: z.array(z.object({ i: z.string(), x: z.number(), y: z.number(), w: z.number(), h: z.number(), minW: z.number().optional(), minH: z.number().optional(), static: z.boolean().optional() })),
          md: z.array(z.object({ i: z.string(), x: z.number(), y: z.number(), w: z.number(), h: z.number(), minW: z.number().optional(), minH: z.number().optional(), static: z.boolean().optional() })),
          sm: z.array(z.object({ i: z.string(), x: z.number(), y: z.number(), w: z.number(), h: z.number(), minW: z.number().optional(), minH: z.number().optional(), static: z.boolean().optional() })),
        }),
      })
    )
    .mutation(({ input }) => {
      const userId = input.userId ?? "default";
      const layout: UserLayout = {
        userId,
        layoutName: input.layoutName ?? "Custom",
        layouts: input.layouts,
        updatedAt: Date.now(),
      };
      userLayouts.set(userId, layout);
      return { success: true, layout };
    }),

  resetLayout: protectedProcedure
    .input(z.object({ userId: z.string().optional() }))
    .mutation(({ input }) => {
      const userId = input.userId ?? "default";
      userLayouts.delete(userId);
      return { success: true } as any;
    }),

  applyPreset: protectedProcedure
    .input(z.object({ userId: z.string().optional(), presetId: z.string() }))
    .mutation(({ input }) => {
      const userId = input.userId ?? "default";
      const preset = PRESETS[input.presetId];
      if (!preset) throw new Error("Preset not found");
      const layout: UserLayout = {
        userId,
        layoutName: preset.name,
        layouts: generateLayout(preset.widgets),
        updatedAt: Date.now(),
      };
      userLayouts.set(userId, layout);
      return { success: true, layout };
    }),

  widgetCatalog: protectedProcedure.query(() => WIDGET_CATALOG),

  presets: protectedProcedure.query(() =>
    Object.entries(PRESETS).map(([id, p]) => ({ id, ...p }))
  ),
});
