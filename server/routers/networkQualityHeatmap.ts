/**
 * Network Quality Heatmap Router — Sprint 93
 *
 * Aggregates offline queue metrics by geographic region to produce
 * heatmap data for visualizing connectivity quality across Africa.
 * Extends the offlineQueue router with geospatial dimensions.
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";

// ── Region Model ──
interface RegionMetrics {
  regionId: string;
  regionName: string;
  country: string;
  lat: number;
  lng: number;
  agentCount: number;
  avgLatencyMs: number;
  avgBandwidthKbps: number;
  failRate: number;
  dominantNetwork: string;
  queueDepth: number;
  syncSuccessRate: number;
  lastUpdated: number;
  networkBreakdown: {
    type: string;
    percentage: number;
    avgLatency: number;
  }[];
}

interface ConnectivityEvent {
  id: string;
  regionId: string;
  timestamp: number;
  eventType: "outage" | "degradation" | "recovery" | "threshold_breach";
  severity: "critical" | "warning" | "info";
  description: string;
  affectedAgents: number;
  duration?: number;
}

// ── Seed Data: African Regions ──
const regions: RegionMetrics[] = [
  {
    regionId: "ng-lagos",
    regionName: "Lagos",
    country: "Nigeria",
    lat: 6.5244,
    lng: 3.3792,
    agentCount: 342,
    avgLatencyMs: 180,
    avgBandwidthKbps: 850,
    failRate: 0.08,
    dominantNetwork: "4g",
    queueDepth: 45,
    syncSuccessRate: 0.92,
    lastUpdated: Date.now() - 60000,
    networkBreakdown: [
      { type: "4g", percentage: 55, avgLatency: 120 },
      { type: "3g", percentage: 30, avgLatency: 280 },
      { type: "2g", percentage: 10, avgLatency: 850 },
      { type: "wifi", percentage: 5, avgLatency: 45 },
    ],
  },
  {
    regionId: "ng-kano",
    regionName: "Kano",
    country: "Nigeria",
    lat: 12.0022,
    lng: 8.5920,
    agentCount: 187,
    avgLatencyMs: 420,
    avgBandwidthKbps: 320,
    failRate: 0.22,
    dominantNetwork: "3g",
    queueDepth: 156,
    syncSuccessRate: 0.78,
    lastUpdated: Date.now() - 120000,
    networkBreakdown: [
      { type: "3g", percentage: 45, avgLatency: 380 },
      { type: "2g", percentage: 40, avgLatency: 920 },
      { type: "4g", percentage: 10, avgLatency: 180 },
      { type: "edge", percentage: 5, avgLatency: 1200 },
    ],
  },
  {
    regionId: "ng-abuja",
    regionName: "Abuja",
    country: "Nigeria",
    lat: 9.0579,
    lng: 7.4951,
    agentCount: 215,
    avgLatencyMs: 220,
    avgBandwidthKbps: 680,
    failRate: 0.11,
    dominantNetwork: "4g",
    queueDepth: 67,
    syncSuccessRate: 0.89,
    lastUpdated: Date.now() - 90000,
    networkBreakdown: [
      { type: "4g", percentage: 48, avgLatency: 150 },
      { type: "3g", percentage: 35, avgLatency: 320 },
      { type: "2g", percentage: 12, avgLatency: 780 },
      { type: "wifi", percentage: 5, avgLatency: 50 },
    ],
  },
  {
    regionId: "ke-nairobi",
    regionName: "Nairobi",
    country: "Kenya",
    lat: -1.2921,
    lng: 36.8219,
    agentCount: 298,
    avgLatencyMs: 150,
    avgBandwidthKbps: 1200,
    failRate: 0.05,
    dominantNetwork: "4g",
    queueDepth: 23,
    syncSuccessRate: 0.95,
    lastUpdated: Date.now() - 45000,
    networkBreakdown: [
      { type: "4g", percentage: 62, avgLatency: 100 },
      { type: "3g", percentage: 25, avgLatency: 250 },
      { type: "wifi", percentage: 10, avgLatency: 35 },
      { type: "2g", percentage: 3, avgLatency: 600 },
    ],
  },
  {
    regionId: "ke-mombasa",
    regionName: "Mombasa",
    country: "Kenya",
    lat: -4.0435,
    lng: 39.6682,
    agentCount: 124,
    avgLatencyMs: 310,
    avgBandwidthKbps: 480,
    failRate: 0.15,
    dominantNetwork: "3g",
    queueDepth: 89,
    syncSuccessRate: 0.85,
    lastUpdated: Date.now() - 180000,
    networkBreakdown: [
      { type: "3g", percentage: 50, avgLatency: 290 },
      { type: "4g", percentage: 25, avgLatency: 140 },
      { type: "2g", percentage: 20, avgLatency: 750 },
      { type: "edge", percentage: 5, avgLatency: 1100 },
    ],
  },
  {
    regionId: "gh-accra",
    regionName: "Accra",
    country: "Ghana",
    lat: 5.6037,
    lng: -0.1870,
    agentCount: 176,
    avgLatencyMs: 200,
    avgBandwidthKbps: 720,
    failRate: 0.09,
    dominantNetwork: "4g",
    queueDepth: 38,
    syncSuccessRate: 0.91,
    lastUpdated: Date.now() - 75000,
    networkBreakdown: [
      { type: "4g", percentage: 50, avgLatency: 130 },
      { type: "3g", percentage: 35, avgLatency: 300 },
      { type: "2g", percentage: 10, avgLatency: 700 },
      { type: "wifi", percentage: 5, avgLatency: 40 },
    ],
  },
  {
    regionId: "tz-dar",
    regionName: "Dar es Salaam",
    country: "Tanzania",
    lat: -6.7924,
    lng: 39.2083,
    agentCount: 145,
    avgLatencyMs: 280,
    avgBandwidthKbps: 520,
    failRate: 0.14,
    dominantNetwork: "3g",
    queueDepth: 102,
    syncSuccessRate: 0.86,
    lastUpdated: Date.now() - 150000,
    networkBreakdown: [
      { type: "3g", percentage: 48, avgLatency: 260 },
      { type: "2g", percentage: 28, avgLatency: 680 },
      { type: "4g", percentage: 18, avgLatency: 150 },
      { type: "wifi", percentage: 6, avgLatency: 55 },
    ],
  },
  {
    regionId: "ug-kampala",
    regionName: "Kampala",
    country: "Uganda",
    lat: 0.3476,
    lng: 32.5825,
    agentCount: 112,
    avgLatencyMs: 350,
    avgBandwidthKbps: 380,
    failRate: 0.19,
    dominantNetwork: "3g",
    queueDepth: 134,
    syncSuccessRate: 0.81,
    lastUpdated: Date.now() - 200000,
    networkBreakdown: [
      { type: "3g", percentage: 42, avgLatency: 320 },
      { type: "2g", percentage: 35, avgLatency: 820 },
      { type: "4g", percentage: 15, avgLatency: 170 },
      { type: "edge", percentage: 8, avgLatency: 1050 },
    ],
  },
  {
    regionId: "rw-kigali",
    regionName: "Kigali",
    country: "Rwanda",
    lat: -1.9403,
    lng: 29.8739,
    agentCount: 89,
    avgLatencyMs: 190,
    avgBandwidthKbps: 900,
    failRate: 0.06,
    dominantNetwork: "4g",
    queueDepth: 18,
    syncSuccessRate: 0.94,
    lastUpdated: Date.now() - 55000,
    networkBreakdown: [
      { type: "4g", percentage: 58, avgLatency: 110 },
      { type: "3g", percentage: 28, avgLatency: 270 },
      { type: "wifi", percentage: 10, avgLatency: 40 },
      { type: "2g", percentage: 4, avgLatency: 550 },
    ],
  },
  {
    regionId: "ng-port-harcourt",
    regionName: "Port Harcourt",
    country: "Nigeria",
    lat: 4.8156,
    lng: 7.0498,
    agentCount: 98,
    avgLatencyMs: 380,
    avgBandwidthKbps: 350,
    failRate: 0.21,
    dominantNetwork: "3g",
    queueDepth: 145,
    syncSuccessRate: 0.79,
    lastUpdated: Date.now() - 240000,
    networkBreakdown: [
      { type: "3g", percentage: 40, avgLatency: 350 },
      { type: "2g", percentage: 38, avgLatency: 880 },
      { type: "4g", percentage: 15, avgLatency: 190 },
      { type: "edge", percentage: 7, avgLatency: 1150 },
    ],
  },
  {
    regionId: "et-addis",
    regionName: "Addis Ababa",
    country: "Ethiopia",
    lat: 9.0250,
    lng: 38.7469,
    agentCount: 156,
    avgLatencyMs: 260,
    avgBandwidthKbps: 550,
    failRate: 0.13,
    dominantNetwork: "3g",
    queueDepth: 78,
    syncSuccessRate: 0.87,
    lastUpdated: Date.now() - 130000,
    networkBreakdown: [
      { type: "3g", percentage: 45, avgLatency: 240 },
      { type: "2g", percentage: 25, avgLatency: 650 },
      { type: "4g", percentage: 22, avgLatency: 140 },
      { type: "wifi", percentage: 8, avgLatency: 50 },
    ],
  },
  {
    regionId: "za-johannesburg",
    regionName: "Johannesburg",
    country: "South Africa",
    lat: -26.2041,
    lng: 28.0473,
    agentCount: 267,
    avgLatencyMs: 120,
    avgBandwidthKbps: 1500,
    failRate: 0.04,
    dominantNetwork: "4g",
    queueDepth: 12,
    syncSuccessRate: 0.96,
    lastUpdated: Date.now() - 30000,
    networkBreakdown: [
      { type: "4g", percentage: 65, avgLatency: 80 },
      { type: "wifi", percentage: 20, avgLatency: 30 },
      { type: "3g", percentage: 12, avgLatency: 200 },
      { type: "2g", percentage: 3, avgLatency: 500 },
    ],
  },
];

const connectivityEvents: ConnectivityEvent[] = [
  {
    id: "evt-001",
    regionId: "ng-kano",
    timestamp: Date.now() - 3600000,
    eventType: "outage",
    severity: "critical",
    description: "Major 4G tower outage in Kano metropolitan area affecting 87 agents",
    affectedAgents: 87,
    duration: 7200000,
  },
  {
    id: "evt-002",
    regionId: "ug-kampala",
    timestamp: Date.now() - 7200000,
    eventType: "degradation",
    severity: "warning",
    description: "Network degradation due to heavy rainfall — 3G speeds dropping to 2G levels",
    affectedAgents: 45,
    duration: 3600000,
  },
  {
    id: "evt-003",
    regionId: "ke-nairobi",
    timestamp: Date.now() - 1800000,
    eventType: "recovery",
    severity: "info",
    description: "Safaricom 4G service restored in Nairobi CBD after scheduled maintenance",
    affectedAgents: 0,
  },
  {
    id: "evt-004",
    regionId: "ng-port-harcourt",
    timestamp: Date.now() - 5400000,
    eventType: "threshold_breach",
    severity: "warning",
    description: "Queue depth exceeded 100 items — sync backlog growing in Port Harcourt",
    affectedAgents: 34,
  },
  {
    id: "evt-005",
    regionId: "tz-dar",
    timestamp: Date.now() - 10800000,
    eventType: "degradation",
    severity: "warning",
    description: "Vodacom network congestion during peak hours — latency spike to 800ms+",
    affectedAgents: 62,
    duration: 5400000,
  },
];

export const networkQualityHeatmapRouter = router({
  /** Get all region metrics for the heatmap */
  getRegionMetrics: publicProcedure
    .input(
      z.object({
        country: z.string().optional(),
        minFailRate: z.number().optional(),
        sortBy: z.enum(["failRate", "latency", "queueDepth", "agentCount"]).optional(),
      }).optional()
    )
    .query(({ input }) => {
      let filtered = [...regions];

      if (input?.country) {
        filtered = filtered.filter((r: any) => r.country === input.country);
      }
      if (input?.minFailRate !== undefined) {
        filtered = filtered.filter((r: any) => r.failRate >= input.minFailRate!);
      }

      const sortBy = input?.sortBy || "failRate";
      filtered.sort((a: any, b: any) => {
        switch (sortBy) {
          case "failRate":
            return b.failRate - a.failRate;
          case "latency":
            return b.avgLatencyMs - a.avgLatencyMs;
          case "queueDepth":
            return b.queueDepth - a.queueDepth;
          case "agentCount":
            return b.agentCount - a.agentCount;
          default:
            return 0;
        }
      });

      return filtered;
    }),

  /** Get aggregated summary across all regions */
  getSummary: publicProcedure.query(() => {
    const totalAgents = regions.reduce((s: any, r: any) => s + r.agentCount, 0);
    const avgLatency =
      regions.reduce((s: any, r: any) => s + r.avgLatencyMs * r.agentCount, 0) / totalAgents;
    const avgFailRate =
      regions.reduce((s: any, r: any) => s + r.failRate * r.agentCount, 0) / totalAgents;
    const totalQueueDepth = regions.reduce((s: any, r: any) => s + r.queueDepth, 0);
    const avgSyncSuccess =
      regions.reduce((s: any, r: any) => s + r.syncSuccessRate * r.agentCount, 0) / totalAgents;

    const criticalRegions = regions.filter((r: any) => r.failRate > 0.15);
    const warningRegions = regions.filter(
      (r) => r.failRate > 0.10 && r.failRate <= 0.15
    );
    const healthyRegions = regions.filter((r: any) => r.failRate <= 0.10);

    const countryBreakdown = Object.entries(
      regions.reduce(
        (acc, r) => {
          if (!acc[r.country]) {
            acc[r.country] = { agents: 0, avgLatency: 0, avgFail: 0, count: 0 };
          }
          acc[r.country].agents += r.agentCount;
          acc[r.country].avgLatency += r.avgLatencyMs;
          acc[r.country].avgFail += r.failRate;
          acc[r.country].count += 1;
          return acc;
        },
        {} as Record<string, { agents: number; avgLatency: number; avgFail: number; count: number }>
      )
    ).map(([country, data]) => ({
      country,
      agents: data.agents,
      avgLatency: Math.round(data.avgLatency / data.count),
      avgFailRate: +(data.avgFail / data.count).toFixed(3),
      regionCount: data.count,
    }));

    return {
      totalRegions: regions.length,
      totalAgents,
      avgLatencyMs: Math.round(avgLatency),
      avgFailRate: +avgFailRate.toFixed(3),
      totalQueueDepth,
      avgSyncSuccessRate: +avgSyncSuccess.toFixed(3),
      criticalCount: criticalRegions.length,
      warningCount: warningRegions.length,
      healthyCount: healthyRegions.length,
      countryBreakdown,
    };
  }),

  /** Get connectivity events timeline */
  getEvents: publicProcedure
    .input(
      z.object({
        regionId: z.string().optional(),
        severity: z.enum(["critical", "warning", "info"]).optional(),
        limit: z.number().min(1).max(100).optional(),
      }).optional()
    )
    .query(({ input }) => {
      let filtered = [...connectivityEvents];

      if (input?.regionId) {
        filtered = filtered.filter((e: any) => e.regionId === input.regionId);
      }
      if (input?.severity) {
        filtered = filtered.filter((e: any) => e.severity === input.severity);
      }

      filtered.sort((a: any, b: any) => b.timestamp - a.timestamp);

      const limit = input?.limit || 50;
      return filtered.slice(0, limit);
    }),

  /** Get region detail with historical trend data */
  getRegionDetail: publicProcedure
    .input(z.object({ regionId: z.string() }))
    .query(({ input }) => {
      const region = regions.find((r: any) => r.regionId === input.regionId);
      if (!region) return null;

      // Generate 24-hour historical trend (simulated from current metrics)
      const hourlyTrend = Array.from({ length: 24 }, (_, i) => {
        const hour = 23 - i;
        const jitter = (Math.sin(hour * 0.8 + region.lat) * 0.3 + 1);
        return {
          hour,
          timestamp: Date.now() - hour * 3600000,
          latencyMs: Math.round(region.avgLatencyMs * jitter),
          failRate: +(region.failRate * jitter).toFixed(3),
          queueDepth: Math.round(region.queueDepth * jitter),
          activeAgents: Math.round(region.agentCount * (0.4 + 0.6 * Math.sin(((hour - 6) / 12) * Math.PI))),
        };
      }).reverse();

      const regionEvents = connectivityEvents.filter(
        (e) => e.regionId === input.regionId
      );

      return {
        ...region,
        hourlyTrend,
        recentEvents: regionEvents,
      };
    }),
});
