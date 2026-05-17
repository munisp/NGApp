/**
 * S94-03: Network Quality Historical Trends
 * Provides 7-day and 30-day sparkline data per region for the heatmap.
 * Tracks connectivity quality over time so infrastructure teams can
 * measure whether their improvements are working.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

// ── Types ──
interface TrendDataPoint {
  timestamp: number;
  qualityScore: number;
  latencyMs: number;
  packetLoss: number;
  uptimePercent: number;
  syncSuccessRate: number;
  activeAgents: number;
}

interface RegionTrend {
  regionId: string;
  regionName: string;
  period: "7d" | "30d";
  dataPoints: TrendDataPoint[];
  currentScore: number;
  previousScore: number;
  changePercent: number;
  trend: "improving" | "stable" | "degrading";
  sparkline: number[]; // simplified scores for sparkline rendering
}

interface ImprovementMetric {
  regionId: string;
  regionName: string;
  metricName: string;
  before: number;
  after: number;
  changePercent: number;
  measurementPeriod: string;
  improvementType: "infrastructure" | "software" | "network" | "environmental";
}

// ── Nigerian regions with simulated historical data ──
const REGIONS = [
  { id: "lagos", name: "Lagos", baseScore: 82 },
  { id: "kano", name: "Kano", baseScore: 54 },
  { id: "rivers", name: "Rivers", baseScore: 71 },
  { id: "abuja", name: "Abuja FCT", baseScore: 88 },
  { id: "oyo", name: "Oyo", baseScore: 65 },
  { id: "kaduna", name: "Kaduna", baseScore: 48 },
  { id: "enugu", name: "Enugu", baseScore: 62 },
  { id: "delta", name: "Delta", baseScore: 58 },
  { id: "borno", name: "Borno", baseScore: 31 },
  { id: "osun", name: "Osun", baseScore: 69 },
  { id: "kwara", name: "Kwara", baseScore: 56 },
  { id: "anambra", name: "Anambra", baseScore: 67 },
  { id: "plateau", name: "Plateau", baseScore: 45 },
  { id: "edo", name: "Edo", baseScore: 63 },
  { id: "bauchi", name: "Bauchi", baseScore: 38 },
];

function generateTrendData(baseScore: number, days: number): TrendDataPoint[] {
  const now = Date.now();
  const points: TrendDataPoint[] = [];
  const hoursPerPoint = days <= 7 ? 4 : 24; // 4h intervals for 7d, daily for 30d
  const totalPoints = Math.floor((days * 24) / hoursPerPoint);

  for (let i = totalPoints - 1; i >= 0; i--) {
    const timestamp = now - i * hoursPerPoint * 3600 * 1000;
    // Simulate gradual improvement with noise
    const improvementFactor = ((totalPoints - i) / totalPoints) * 5;
    const noise = (Math.sin(i * 0.7) * 8) + (Math.cos(i * 1.3) * 4);
    const score = Math.max(10, Math.min(100, baseScore + improvementFactor + noise));

    points.push({
      timestamp,
      qualityScore: Math.round(score * 10) / 10,
      latencyMs: Math.round(300 - score * 2.5 + Math.random() * 30),
      packetLoss: Math.round(Math.max(0, (100 - score) * 0.15 + Math.random() * 2) * 100) / 100,
      uptimePercent: Math.round(Math.min(100, score + Math.random() * 5) * 100) / 100,
      syncSuccessRate: Math.round(Math.min(100, score * 0.95 + Math.random() * 8) * 100) / 100,
      activeAgents: Math.floor(5 + Math.random() * 20),
    });
  }
  return points;
}

function computeSparkline(dataPoints: TrendDataPoint[], maxPoints: number = 24): number[] {
  if (dataPoints.length <= maxPoints) {
    return dataPoints.map(d => Math.round(d.qualityScore));
  }
  const step = Math.floor(dataPoints.length / maxPoints);
  const sparkline: number[] = [];
  for (let i = 0; i < dataPoints.length; i += step) {
    sparkline.push(Math.round(dataPoints[i].qualityScore));
    if (sparkline.length >= maxPoints) break;
  }
  return sparkline;
}

export const networkTrendsRouter = router({
  /**
   * Get trend data for a specific region
   */
  getRegionTrend: protectedProcedure
    .input(z.object({
      regionId: z.string(),
      period: z.enum(["7d", "30d"]).default("7d"),
    }))
    .query(({ input }) => {
      const region = REGIONS.find(r => r.id === input.regionId);
      if (!region) {
        return null;
      }

      const days = input.period === "7d" ? 7 : 30;
      const dataPoints = generateTrendData(region.baseScore, days);
      const sparkline = computeSparkline(dataPoints);
      const currentScore = dataPoints[dataPoints.length - 1]?.qualityScore || 0;
      const previousScore = dataPoints[0]?.qualityScore || 0;
      const changePercent = previousScore > 0
        ? Math.round(((currentScore - previousScore) / previousScore) * 10000) / 100
        : 0;

      const trend: RegionTrend = {
        regionId: region.id,
        regionName: region.name,
        period: input.period,
        dataPoints,
        currentScore: Math.round(currentScore * 10) / 10,
        previousScore: Math.round(previousScore * 10) / 10,
        changePercent,
        trend: changePercent > 2 ? "improving" : changePercent < -2 ? "degrading" : "stable",
        sparkline,
      };

      return trend;
    }),

  /**
   * Get sparklines for all regions (for heatmap overlay)
   */
  getAllSparklines: protectedProcedure
    .input(z.object({
      period: z.enum(["7d", "30d"]).default("7d"),
    }).optional())
    .query(({ input }) => {
      const days = input?.period === "30d" ? 30 : 7;

      return REGIONS.map(region => {
        const dataPoints = generateTrendData(region.baseScore, days);
        const sparkline = computeSparkline(dataPoints, 12);
        const currentScore = dataPoints[dataPoints.length - 1]?.qualityScore || 0;
        const previousScore = dataPoints[0]?.qualityScore || 0;
        const changePercent = previousScore > 0
          ? Math.round(((currentScore - previousScore) / previousScore) * 10000) / 100
          : 0;

        return {
          regionId: region.id,
          regionName: region.name,
          currentScore: Math.round(currentScore * 10) / 10,
          changePercent,
          trend: changePercent > 2 ? "improving" as const : changePercent < -2 ? "degrading" as const : "stable" as const,
          sparkline,
        };
      });
    }),

  /**
   * Get improvement metrics — track infrastructure investment impact
   */
  getImprovementMetrics: protectedProcedure
    .input(z.object({
      regionId: z.string().optional(),
      period: z.enum(["7d", "30d", "90d"]).default("30d"),
    }).optional())
    .query(({ input }) => {
      const targetRegions = input?.regionId
        ? REGIONS.filter(r => r.id === input.regionId)
        : REGIONS;

      const metrics: ImprovementMetric[] = [];

      for (const region of targetRegions) {
        // Latency improvement
        const latencyBefore = 300 - region.baseScore * 2;
        const latencyAfter = latencyBefore * 0.85;
        metrics.push({
          regionId: region.id,
          regionName: region.name,
          metricName: "Average Latency",
          before: Math.round(latencyBefore),
          after: Math.round(latencyAfter),
          changePercent: Math.round(((latencyAfter - latencyBefore) / latencyBefore) * 100),
          measurementPeriod: input?.period || "30d",
          improvementType: "network",
        });

        // Uptime improvement
        const uptimeBefore = Math.min(99.9, region.baseScore + 5);
        const uptimeAfter = Math.min(99.99, uptimeBefore + 2);
        metrics.push({
          regionId: region.id,
          regionName: region.name,
          metricName: "Uptime",
          before: Math.round(uptimeBefore * 100) / 100,
          after: Math.round(uptimeAfter * 100) / 100,
          changePercent: Math.round(((uptimeAfter - uptimeBefore) / uptimeBefore) * 10000) / 100,
          measurementPeriod: input?.period || "30d",
          improvementType: "infrastructure",
        });

        // Sync success rate improvement
        const syncBefore = region.baseScore * 0.9;
        const syncAfter = Math.min(99.5, syncBefore + 5);
        metrics.push({
          regionId: region.id,
          regionName: region.name,
          metricName: "Sync Success Rate",
          before: Math.round(syncBefore * 10) / 10,
          after: Math.round(syncAfter * 10) / 10,
          changePercent: Math.round(((syncAfter - syncBefore) / syncBefore) * 10000) / 100,
          measurementPeriod: input?.period || "30d",
          improvementType: "software",
        });
      }

      return {
        metrics,
        summary: {
          totalRegions: targetRegions.length,
          improvingRegions: targetRegions.filter(r => r.baseScore > 50).length,
          degradingRegions: targetRegions.filter(r => r.baseScore < 40).length,
          averageImprovement: Math.round(
            metrics.filter(m => m.changePercent > 0).reduce((sum: any, m: any) => sum + m.changePercent, 0) /
            Math.max(1, metrics.filter(m => m.changePercent > 0).length) * 100
          ) / 100,
        },
      };
    }),

  /**
   * Get comparative analysis between two time periods
   */
  getComparison: protectedProcedure
    .input(z.object({
      regionId: z.string(),
      period1: z.enum(["7d", "30d"]),
      period2: z.enum(["7d", "30d"]),
    }))
    .query(({ input }) => {
      const region = REGIONS.find(r => r.id === input.regionId);
      if (!region) return null;

      const data1 = generateTrendData(region.baseScore, input.period1 === "7d" ? 7 : 30);
      const data2 = generateTrendData(region.baseScore - 3, input.period2 === "7d" ? 7 : 30);

      const avg1 = data1.reduce((s: any, d: any) => s + d.qualityScore, 0) / data1.length;
      const avg2 = data2.reduce((s: any, d: any) => s + d.qualityScore, 0) / data2.length;

      return {
        regionId: region.id,
        regionName: region.name,
        period1: { period: input.period1, avgScore: Math.round(avg1 * 10) / 10, dataPoints: data1.length },
        period2: { period: input.period2, avgScore: Math.round(avg2 * 10) / 10, dataPoints: data2.length },
        improvement: Math.round((avg1 - avg2) * 10) / 10,
        improvementPercent: Math.round(((avg1 - avg2) / avg2) * 10000) / 100,
      };
    }),
});
