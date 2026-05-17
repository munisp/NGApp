import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  widgets: TemplateWidget[];
  layout: string;
  createdAt: string;
  usageCount: number;
  rating: number;
  isOfficial: boolean;
}

interface TemplateWidget {
  id: string;
  type: string;
  title: string;
  dataSource: string;
  config: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
}

const officialTemplates: ReportTemplate[] = [
  {
    id: "tpl-daily-settlement",
    name: "Daily Settlement Report",
    description: "End-of-day settlement summary with agent-level breakdown, commission totals, and float reconciliation",
    category: "Settlement",
    layout: "grid-2x3",
    createdAt: "2025-01-15T00:00:00Z",
    usageCount: 12450,
    rating: 4.8,
    isOfficial: true,
    widgets: [
      { id: "w1", type: "kpi_card", title: "Total Settlement Volume", dataSource: "settlements.daily_total", config: { format: "currency_ngn", comparison: "yesterday" }, position: { x: 0, y: 0, w: 6, h: 2 } },
      { id: "w2", type: "kpi_card", title: "Agents Settled", dataSource: "settlements.agent_count", config: { format: "number" }, position: { x: 6, y: 0, w: 6, h: 2 } },
      { id: "w3", type: "bar_chart", title: "Settlement by Agent Tier", dataSource: "settlements.by_tier", config: { colors: ["#22c55e", "#3b82f6", "#f59e0b"], stacked: false }, position: { x: 0, y: 2, w: 6, h: 4 } },
      { id: "w4", type: "table", title: "Top 20 Agents by Volume", dataSource: "settlements.top_agents", config: { columns: ["agentCode", "name", "volume", "commission", "status"], pageSize: 20 }, position: { x: 6, y: 2, w: 6, h: 4 } },
      { id: "w5", type: "line_chart", title: "Settlement Trend (30 Days)", dataSource: "settlements.trend_30d", config: { smooth: true }, position: { x: 0, y: 6, w: 12, h: 4 } },
    ],
  },
  {
    id: "tpl-fraud-analysis",
    name: "Monthly Fraud Analysis",
    description: "Comprehensive fraud metrics including detection rates, false positive analysis, model performance, and geographic distribution",
    category: "Fraud & Risk",
    layout: "grid-3x3",
    createdAt: "2025-02-01T00:00:00Z",
    usageCount: 8920,
    rating: 4.9,
    isOfficial: true,
    widgets: [
      { id: "w1", type: "kpi_card", title: "Fraud Detection Rate", dataSource: "fraud.detection_rate", config: { format: "percentage", threshold: { good: 95, warning: 85 } }, position: { x: 0, y: 0, w: 4, h: 2 } },
      { id: "w2", type: "kpi_card", title: "False Positive Rate", dataSource: "fraud.false_positive_rate", config: { format: "percentage", threshold: { good: 5, warning: 15 } }, position: { x: 4, y: 0, w: 4, h: 2 } },
      { id: "w3", type: "kpi_card", title: "Blocked Amount", dataSource: "fraud.blocked_amount", config: { format: "currency_ngn" }, position: { x: 8, y: 0, w: 4, h: 2 } },
      { id: "w4", type: "pie_chart", title: "Fraud by Type", dataSource: "fraud.by_type", config: { donut: true }, position: { x: 0, y: 2, w: 4, h: 4 } },
      { id: "w5", type: "heatmap", title: "Geographic Fraud Distribution", dataSource: "fraud.geo_distribution", config: { colorScale: "red" }, position: { x: 4, y: 2, w: 8, h: 4 } },
      { id: "w6", type: "line_chart", title: "Model Performance Over Time", dataSource: "fraud.model_performance", config: { metrics: ["precision", "recall", "f1"] }, position: { x: 0, y: 6, w: 12, h: 4 } },
    ],
  },
  {
    id: "tpl-agent-performance",
    name: "Agent Performance Scorecard",
    description: "Individual and network-level agent KPIs including transaction volume, success rates, customer satisfaction, and compliance scores",
    category: "Agent Management",
    layout: "grid-2x4",
    createdAt: "2025-01-20T00:00:00Z",
    usageCount: 15600,
    rating: 4.7,
    isOfficial: true,
    widgets: [
      { id: "w1", type: "kpi_card", title: "Active Agents", dataSource: "agents.active_count", config: { format: "number", comparison: "last_month" }, position: { x: 0, y: 0, w: 3, h: 2 } },
      { id: "w2", type: "kpi_card", title: "Avg Transaction/Agent", dataSource: "agents.avg_tx_per_agent", config: { format: "number" }, position: { x: 3, y: 0, w: 3, h: 2 } },
      { id: "w3", type: "kpi_card", title: "Network Uptime", dataSource: "agents.network_uptime", config: { format: "percentage" }, position: { x: 6, y: 0, w: 3, h: 2 } },
      { id: "w4", type: "kpi_card", title: "Avg Success Rate", dataSource: "agents.avg_success_rate", config: { format: "percentage" }, position: { x: 9, y: 0, w: 3, h: 2 } },
      { id: "w5", type: "bar_chart", title: "Top Performers", dataSource: "agents.top_performers", config: { horizontal: true, limit: 10 }, position: { x: 0, y: 2, w: 6, h: 4 } },
      { id: "w6", type: "scatter_chart", title: "Volume vs Success Rate", dataSource: "agents.volume_vs_success", config: { xAxis: "volume", yAxis: "successRate" }, position: { x: 6, y: 2, w: 6, h: 4 } },
      { id: "w7", type: "table", title: "Agent Compliance Status", dataSource: "agents.compliance_status", config: { columns: ["agentCode", "name", "kycStatus", "lastAudit", "score"], sortBy: "score" }, position: { x: 0, y: 6, w: 12, h: 4 } },
    ],
  },
  {
    id: "tpl-cbn-regulatory",
    name: "CBN Regulatory Compliance Report",
    description: "Central Bank of Nigeria regulatory submission template with transaction limits, AML checks, and suspicious activity reports",
    category: "Compliance",
    layout: "grid-2x3",
    createdAt: "2025-03-01T00:00:00Z",
    usageCount: 6780,
    rating: 4.6,
    isOfficial: true,
    widgets: [
      { id: "w1", type: "kpi_card", title: "AML Compliance Score", dataSource: "compliance.aml_score", config: { format: "percentage", threshold: { good: 95, warning: 80 } }, position: { x: 0, y: 0, w: 4, h: 2 } },
      { id: "w2", type: "kpi_card", title: "SARs Filed", dataSource: "compliance.sar_count", config: { format: "number" }, position: { x: 4, y: 0, w: 4, h: 2 } },
      { id: "w3", type: "kpi_card", title: "Limit Breaches", dataSource: "compliance.limit_breaches", config: { format: "number", alertIfAbove: 0 }, position: { x: 8, y: 0, w: 4, h: 2 } },
      { id: "w4", type: "table", title: "Transaction Limit Monitoring", dataSource: "compliance.limit_monitoring", config: { columns: ["category", "limit", "current", "utilization", "status"] }, position: { x: 0, y: 2, w: 12, h: 4 } },
      { id: "w5", type: "bar_chart", title: "Monthly SAR Submissions", dataSource: "compliance.sar_monthly", config: { colors: ["#ef4444"] }, position: { x: 0, y: 6, w: 6, h: 4 } },
      { id: "w6", type: "line_chart", title: "Compliance Score Trend", dataSource: "compliance.score_trend", config: { target: 95 }, position: { x: 6, y: 6, w: 6, h: 4 } },
    ],
  },
  {
    id: "tpl-revenue-pnl",
    name: "Revenue & P&L Statement",
    description: "Financial performance report with revenue breakdown, cost analysis, profit margins, and commission structures",
    category: "Financial",
    layout: "grid-2x3",
    createdAt: "2025-02-15T00:00:00Z",
    usageCount: 11200,
    rating: 4.8,
    isOfficial: true,
    widgets: [
      { id: "w1", type: "kpi_card", title: "Total Revenue", dataSource: "finance.total_revenue", config: { format: "currency_ngn", comparison: "last_month" }, position: { x: 0, y: 0, w: 3, h: 2 } },
      { id: "w2", type: "kpi_card", title: "Net Profit", dataSource: "finance.net_profit", config: { format: "currency_ngn" }, position: { x: 3, y: 0, w: 3, h: 2 } },
      { id: "w3", type: "kpi_card", title: "Profit Margin", dataSource: "finance.profit_margin", config: { format: "percentage" }, position: { x: 6, y: 0, w: 3, h: 2 } },
      { id: "w4", type: "kpi_card", title: "Commission Payout", dataSource: "finance.commission_total", config: { format: "currency_ngn" }, position: { x: 9, y: 0, w: 3, h: 2 } },
      { id: "w5", type: "stacked_bar", title: "Revenue by Channel", dataSource: "finance.revenue_by_channel", config: { channels: ["POS", "Mobile", "USSD", "Web"] }, position: { x: 0, y: 2, w: 6, h: 4 } },
      { id: "w6", type: "waterfall_chart", title: "P&L Waterfall", dataSource: "finance.pnl_waterfall", config: {}, position: { x: 6, y: 2, w: 6, h: 4 } },
      { id: "w7", type: "line_chart", title: "Monthly Revenue Trend", dataSource: "finance.monthly_trend", config: { metrics: ["revenue", "cost", "profit"] }, position: { x: 0, y: 6, w: 12, h: 4 } },
    ],
  },
];

export const reportBuilderTemplatesRouter = router({
  listTemplates: protectedProcedure
    .input(z.object({ category: z.string().optional(), search: z.string().optional() }).optional())
    .query(({ input }) => {
      let templates = [...officialTemplates];
      if (input?.category) templates = templates.filter((t: any) => t.category === input.category);
      if (input?.search) {
        const q = input.search.toLowerCase();
        templates = templates.filter((t: any) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
      }
    }),

  getTemplate: protectedProcedure
    .input(z.object({ templateId: z.string() }))
    .query(({ input }) => {
      const template = officialTemplates.find((t: any) => t.id === input.templateId);
      if (!template) throw new Error("Template not found");
      return template;
    }),

  cloneTemplate: protectedProcedure
    .input(z.object({ templateId: z.string(), newName: z.string().min(1) }))
    .mutation(({ input }) => {
      const source = officialTemplates.find((t: any) => t.id === input.templateId);
      if (!source) throw new Error("Template not found");
      return {
        ...source,
        id: `tpl-custom-${Date.now()}`,
        name: input.newName,
        isOfficial: false,
        usageCount: 0,
        createdAt: new Date().toISOString(),
      };
    }),

  getStats: protectedProcedure.query(() => ({ totalTemplates: 12, activeReports: 156, scheduledJobs: 34, avgGenerationTime: "2.3s" })),
  getWidgetTypes: protectedProcedure.query(() => ({
    types: [
      { id: "kpi_card", name: "KPI Card", icon: "hash", description: "Single metric with comparison" },
      { id: "bar_chart", name: "Bar Chart", icon: "bar-chart", description: "Vertical or horizontal bars" },
      { id: "line_chart", name: "Line Chart", icon: "trending-up", description: "Time series trend line" },
      { id: "pie_chart", name: "Pie Chart", icon: "pie-chart", description: "Proportional breakdown" },
      { id: "table", name: "Data Table", icon: "table", description: "Sortable data grid" },
      { id: "heatmap", name: "Heatmap", icon: "map", description: "Geographic heat distribution" },
      { id: "scatter_chart", name: "Scatter Plot", icon: "crosshair", description: "Correlation analysis" },
      { id: "stacked_bar", name: "Stacked Bar", icon: "layers", description: "Multi-series stacked bars" },
      { id: "waterfall_chart", name: "Waterfall", icon: "git-branch", description: "Incremental value changes" },
      { id: "gauge", name: "Gauge", icon: "activity", description: "Progress toward target" },
    ],
  })),

  getDataSources: protectedProcedure.query(() => ({
    sources: [
      { id: "settlements", name: "Settlements", fields: ["daily_total", "agent_count", "by_tier", "top_agents", "trend_30d"] },
      { id: "fraud", name: "Fraud Detection", fields: ["detection_rate", "false_positive_rate", "blocked_amount", "by_type", "geo_distribution", "model_performance"] },
      { id: "agents", name: "Agent Network", fields: ["active_count", "avg_tx_per_agent", "network_uptime", "avg_success_rate", "top_performers", "volume_vs_success", "compliance_status"] },
      { id: "compliance", name: "Compliance", fields: ["aml_score", "sar_count", "limit_breaches", "limit_monitoring", "sar_monthly", "score_trend"] },
      { id: "finance", name: "Financial", fields: ["total_revenue", "net_profit", "profit_margin", "commission_total", "revenue_by_channel", "pnl_waterfall", "monthly_trend"] },
      { id: "transactions", name: "Transactions", fields: ["volume", "count", "by_type", "by_channel", "success_rate", "avg_amount", "hourly_distribution"] },
    ],
  })),
});
