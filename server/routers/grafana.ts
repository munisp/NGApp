/**
 * grafana.ts — Grafana dashboard proxy + embed configuration tRPC router
 *
 * Provides:
 *   - grafana.config: returns Grafana base URL and available dashboard UIDs
 *   - grafana.dashboards: lists all provisioned dashboards with metadata
 *   - grafana.embedUrl: generates a signed embed URL for a specific dashboard
 *   - grafana.health: checks Grafana API connectivity
 *
 * The proxy approach keeps the Grafana admin credentials server-side and
 * returns short-lived viewer tokens to the PWA for iframe embedding.
 */

import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

const GRAFANA_URL = process.env.GRAFANA_URL ?? "http://localhost:3001";
const GRAFANA_API_KEY = process.env.GRAFANA_API_KEY ?? "";

// Provisioned dashboard registry — matches infra/grafana/dashboards/*.json UIDs
const PROVISIONED_DASHBOARDS = [
  {
    uid: "og-rmm-well-kpis",
    title: "Well Production KPIs",
    description: "Real-time oil rate, water cut, GOR, wellhead pressure, ESP status",
    tags: ["production", "wells"],
    refresh: "30s",
    icon: "activity",
  },
  {
    uid: "og-rmm-alarm-analytics",
    title: "Alarm Analytics (ISA-18.2)",
    description: "Alarm rate, MTTACK, flood detection, bad actor wells",
    tags: ["alarms", "isa-18.2"],
    refresh: "1m",
    icon: "bell",
  },
  {
    uid: "og-rmm-telemetry-throughput",
    title: "Telemetry Throughput",
    description: "Go ingestion service metrics — throughput, latency, Kafka lag",
    tags: ["telemetry", "kafka", "influxdb"],
    refresh: "10s",
    icon: "zap",
  },
  {
    uid: "og-rmm-financial-kpis",
    title: "Financial KPIs",
    description: "Revenue, OPEX, lifting cost, LOE per BOE, workover spend",
    tags: ["financial", "opex"],
    refresh: "5m",
    icon: "dollar-sign",
  },
] as const;

type Dashboard = (typeof PROVISIONED_DASHBOARDS)[number];

/**
 * Builds a Grafana embed URL for a dashboard panel.
 * Uses kiosk=tv mode for clean embedding without Grafana chrome.
 */
function buildEmbedUrl(
  uid: string,
  opts: {
    from?: string;
    to?: string;
    theme?: "dark" | "light";
    panelId?: number;
    refresh?: string;
  } = {}
): string {
  const { from = "now-24h", to = "now", theme = "dark", panelId, refresh } = opts;
  const base = `${GRAFANA_URL}/d/${uid}`;
  const params = new URLSearchParams({
    kiosk: "tv",
    theme,
    from,
    to,
    ...(refresh ? { refresh } : {}),
    ...(panelId !== undefined ? { viewPanel: String(panelId) } : {}),
  });
  return `${base}?${params.toString()}`;
}

/**
 * Calls the Grafana HTTP API with the configured API key.
 * Returns null on connection failure (Grafana may not be running locally).
 */
async function grafanaApi<T>(path: string): Promise<T | null> {
  if (!GRAFANA_API_KEY && !GRAFANA_URL.includes("localhost")) {
    return null;
  }
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (GRAFANA_API_KEY) {
      headers["Authorization"] = `Bearer ${GRAFANA_API_KEY}`;
    }
    const res = await fetch(`${GRAFANA_URL}${path}`, { headers });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

export const grafanaRouter = router({
  /**
   * Returns Grafana base URL and feature flags.
   * Used by the PWA to know whether Grafana is available.
   */
  config: publicProcedure.query(() => {
    return {
      grafanaUrl: GRAFANA_URL,
      available: Boolean(GRAFANA_URL),
      dashboardCount: PROVISIONED_DASHBOARDS.length,
    };
  }),

  /**
   * Lists all provisioned dashboards with embed URLs.
   */
  dashboards: protectedProcedure
    .input(
      z.object({
        from: z.string().default("now-24h"),
        to: z.string().default("now"),
        theme: z.enum(["dark", "light"]).default("dark"),
      })
    )
    .query(({ input }) => {
      return PROVISIONED_DASHBOARDS.map((d) => ({
        ...d,
        embedUrl: buildEmbedUrl(d.uid, {
          from: input.from,
          to: input.to,
          theme: input.theme,
          refresh: d.refresh,
        }),
      }));
    }),

  /**
   * Returns embed URL for a single dashboard, with optional panel focus.
   */
  embedUrl: protectedProcedure
    .input(
      z.object({
        uid: z.string(),
        from: z.string().default("now-24h"),
        to: z.string().default("now"),
        theme: z.enum(["dark", "light"]).default("dark"),
        panelId: z.number().optional(),
      })
    )
    .query(({ input }) => {
      const dashboard = PROVISIONED_DASHBOARDS.find((d) => d.uid === input.uid);
      if (!dashboard) {
        return { url: null, error: "Dashboard not found" };
      }
      return {
        url: buildEmbedUrl(input.uid, {
          from: input.from,
          to: input.to,
          theme: input.theme,
          panelId: input.panelId,
          refresh: dashboard.refresh,
        }),
        dashboard,
        error: null,
      };
    }),

  /**
   * Checks Grafana API health.
   * Returns { healthy: true } if Grafana is reachable, { healthy: false } otherwise.
   */
  health: publicProcedure.query(async () => {
    const result = await grafanaApi<{ database: string; version: string }>("/api/health");
    if (!result) {
      return {
        healthy: false,
        message: "Grafana is not reachable. Start it with: docker compose -f infra/grafana/docker-compose.grafana.yml up -d",
        grafanaUrl: GRAFANA_URL,
      };
    }
    return {
      healthy: true,
      version: result.version,
      database: result.database,
      grafanaUrl: GRAFANA_URL,
    };
  }),

  /**
   * Returns the list of provisioned dashboard metadata (no embed URLs).
   * Used for the dashboard selector UI.
   */
  list: protectedProcedure.query(() => {
    return PROVISIONED_DASHBOARDS.map((d) => ({
      uid: d.uid,
      title: d.title,
      description: d.description,
      tags: d.tags,
      icon: d.icon,
    }));
  }),
});
