/**
 * InfluxBenchmark.tsx — InfluxDB vs. Historian Performance Benchmark Page
 *
 * Runs and displays benchmark results comparing OG-RMM's InfluxDB layer
 * against Aveva PI System, Cognite CDF, and InfluxDB OSS targets across:
 *   - Write throughput (pts/sec)
 *   - Query latency (ms)
 *   - Tag count capacity
 *   - Compression ratio
 *   - Backfill speed
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import {
  Zap, Database, Clock, Archive, TrendingUp, Play, RefreshCw,
  CheckCircle2, AlertTriangle, XCircle, Info, Server, Activity,
} from "lucide-react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  exceeds: { label: "Exceeds Target", color: "text-emerald-400", bg: "bg-emerald-950/30 border-emerald-800/40", icon: CheckCircle2 },
  meets: { label: "Meets Target", color: "text-amber-400", bg: "bg-amber-950/30 border-amber-800/40", icon: AlertTriangle },
  below: { label: "Below Target", color: "text-red-400", bg: "bg-red-950/30 border-red-800/40", icon: XCircle },
  na: { label: "N/A", color: "text-muted-foreground", bg: "bg-muted/10 border-border/30", icon: Info },
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CATEGORY_ICONS: Record<string, any> = {
  write: Zap,
  query: Clock,
  capacity: Database,
  compression: Archive,
  backfill: TrendingUp,
};

const CATEGORY_LABELS: Record<string, string> = {
  write: "Write Throughput",
  query: "Query Latency",
  capacity: "Capacity",
  compression: "Compression",
  backfill: "Backfill Speed",
};

// ─── RESULT CARD ──────────────────────────────────────────────────────────────

function ResultCard({ result }: {
  result: {
    id: string;
    name: string;
    category: string;
    backend: string;
    value: number;
    unit: string;
    targetValue: number;
    targetLabel: string;
    competitorValues: { name: string; value: number; unit: string }[];
    status: string;
    notes: string;
    durationMs: number;
  };
}) {
  const cfg = STATUS_CONFIG[result.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.na;
  const Icon = cfg.icon;
  const CatIcon = CATEGORY_ICONS[result.category] ?? Activity;

  const isLowerBetter = result.category === "query";
  const targetRatio = isLowerBetter
    ? result.targetValue / Math.max(result.value, 0.001)
    : result.value / Math.max(result.targetValue, 0.001);
  const barWidth = Math.min(Math.max(targetRatio * 100, 5), 100);

  return (
    <Card className={cn("bg-card border transition-all", cfg.bg)}>
      <CardContent className="pt-3 pb-3 px-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CatIcon className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">{result.name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Icon className={cn("w-3.5 h-3.5", cfg.color)} />
            <span className={cn("text-[10px] font-mono", cfg.color)}>{cfg.label}</span>
          </div>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <span className={cn("text-2xl font-mono font-bold", cfg.color)}>
              {result.value >= 1000000
                ? `${(result.value / 1000000).toFixed(1)}M`
                : result.value >= 1000
                  ? `${(result.value / 1000).toFixed(1)}K`
                  : result.value.toFixed(result.unit === "ms" ? 0 : 1)}
            </span>
            <span className="text-xs text-muted-foreground ml-1">{result.unit}</span>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground">Target</div>
            <div className="text-xs font-mono text-muted-foreground/70">
              {result.targetValue >= 1000000
                ? `${(result.targetValue / 1000000).toFixed(0)}M`
                : result.targetValue >= 1000
                  ? `${(result.targetValue / 1000).toFixed(0)}K`
                  : result.targetValue} {result.unit}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-muted/20 rounded-full h-1.5">
          <div
            className={cn("h-1.5 rounded-full transition-all", {
              "bg-emerald-500": result.status === "exceeds",
              "bg-amber-500": result.status === "meets",
              "bg-red-500": result.status === "below",
              "bg-muted": result.status === "na",
            })}
            style={{ width: `${barWidth}%` }}
          />
        </div>

        <div className="text-[10px] text-muted-foreground/60">{result.notes}</div>

        {/* Competitor comparison */}
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          {result.competitorValues.map(c => (
            <div key={c.name} className="text-center">
              <div className="text-[9px] text-muted-foreground/50 truncate">{c.name.split(" ")[0]}</div>
              <div className="text-[10px] font-mono text-muted-foreground/70">
                {c.value >= 1000000
                  ? `${(c.value / 1000000).toFixed(0)}M`
                  : c.value >= 1000
                    ? `${(c.value / 1000).toFixed(0)}K`
                    : c.value} {c.unit}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function InfluxBenchmark() {
  const [isRunning, setIsRunning] = useState(false);

  const { data: config } = trpc.influxBenchmark.config.useQuery();
  const { data: latest, refetch: refetchLatest } = trpc.influxBenchmark.latest.useQuery();
  const { data: history } = trpc.influxBenchmark.history.useQuery({ limit: 5 });

  const runBenchmark = trpc.influxBenchmark.run.useMutation({
    onMutate: () => setIsRunning(true),
    onSuccess: () => {
      refetchLatest();
      setIsRunning(false);
      toast.success("Benchmark complete");
    },
    onError: (err) => {
      setIsRunning(false);
      toast.error(`Benchmark failed: ${err.message}`);
    },
  });

  // Radar chart data
  const radarData = latest?.results
    ? [
        { metric: "Write\nSmall", ogRmm: Math.min((latest.results.find(r => r.id === "write-small-batch")?.value ?? 0) / 1000, 100), pi: 100, cognite: 50 },
        { metric: "Write\nLarge", ogRmm: Math.min((latest.results.find(r => r.id === "write-large-batch")?.value ?? 0) / 3000, 100), pi: 100, cognite: 50 },
        { metric: "Query\nLatency", ogRmm: Math.max(100 - (latest.results.find(r => r.id === "query-range-1h")?.value ?? 100), 0), pi: 92, cognite: 85 },
        { metric: "Capacity", ogRmm: Math.min((latest.results.find(r => r.id === "capacity-tag-count")?.value ?? 0) / 10000, 100), pi: 100, cognite: 100 },
        { metric: "Compression", ogRmm: Math.min((latest.results.find(r => r.id === "compression-ratio")?.value ?? 0) * 8, 100), pi: 96, cognite: 100 },
        { metric: "Backfill", ogRmm: Math.min((latest.results.find(r => r.id === "backfill-speed")?.value ?? 0) / 5000, 100), pi: 100, cognite: 100 },
      ]
    : [];

  // Score trend
  const scoreTrend = history?.map((run, i) => ({
    run: `Run ${history.length - i}`,
    score: run.summary.overallScore,
  })).reverse() ?? [];

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold font-[Syne] flex items-center gap-2">
            <Server className="w-5 h-5 text-amber-400" />
            InfluxDB Benchmark
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Historian-grade performance comparison vs. Aveva PI System and Cognite CDF
          </p>
        </div>
        <Button
          onClick={() => runBenchmark.mutate()}
          disabled={isRunning}
          className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
          size="sm"
        >
          {isRunning ? (
            <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Running…</>
          ) : (
            <><Play className="w-3.5 h-3.5 mr-1.5" />Run Benchmark</>
          )}
        </Button>
      </div>

      {/* Config status */}
      {config && (
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono",
          config.influxConfigured
            ? "border-emerald-800/50 bg-emerald-950/20 text-emerald-400"
            : "border-blue-800/50 bg-blue-950/20 text-blue-400"
        )}>
          <Database className="w-3.5 h-3.5 shrink-0" />
          <span>
            Backend: <strong>{config.activeBackend}</strong>
            {!config.influxConfigured && " — Set INFLUXDB_URL, INFLUXDB_TOKEN, and INFLUXDB_BUCKET to benchmark against a live InfluxDB instance"}
          </span>
        </div>
      )}

      {/* Summary cards */}
      {latest && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-card border-border/50">
            <CardContent className="pt-3 pb-3 px-4">
              <div className="text-[10px] text-muted-foreground">Overall Score</div>
              <div className={cn(
                "text-2xl font-mono font-bold",
                latest.summary.overallScore >= 80 ? "text-emerald-400" :
                latest.summary.overallScore >= 60 ? "text-amber-400" : "text-red-400"
              )}>{latest.summary.overallScore}%</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border/50">
            <CardContent className="pt-3 pb-3 px-4">
              <div className="text-[10px] text-muted-foreground">Tests Exceeding Target</div>
              <div className="text-2xl font-mono font-bold text-emerald-400">{latest.summary.exceeds}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border/50">
            <CardContent className="pt-3 pb-3 px-4">
              <div className="text-[10px] text-muted-foreground">Tests Meeting Target</div>
              <div className="text-2xl font-mono font-bold text-amber-400">{latest.summary.meets}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border/50">
            <CardContent className="pt-3 pb-3 px-4">
              <div className="text-[10px] text-muted-foreground">Backend</div>
              <div className="text-sm font-mono font-bold text-muted-foreground">{latest.backend}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results grid */}
      {latest?.results && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {latest.results.map(result => (
            <ResultCard key={result.id} result={result} />
          ))}
        </div>
      )}

      {/* No results yet */}
      {!latest && !isRunning && (
        <Card className="bg-card border-border/50">
          <CardContent className="pt-12 pb-12 flex flex-col items-center gap-3 text-center">
            <Server className="w-10 h-10 text-muted-foreground/20" />
            <div className="text-sm text-muted-foreground">No benchmark results yet</div>
            <div className="text-xs text-muted-foreground/60">Click "Run Benchmark" to measure write throughput, query latency, and capacity against historian targets</div>
            <Button
              onClick={() => runBenchmark.mutate()}
              disabled={isRunning}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs mt-2"
              size="sm"
            >
              <Play className="w-3.5 h-3.5 mr-1.5" />
              Run First Benchmark
            </Button>
          </CardContent>
        </Card>
      )}

      {isRunning && (
        <Card className="bg-card border-amber-800/30">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
            <div className="text-sm text-amber-400 font-mono">Running benchmark suite…</div>
            <div className="text-xs text-muted-foreground">Testing write throughput, query latency, tag capacity, compression, and backfill speed</div>
          </CardContent>
        </Card>
      )}

      {/* Charts row */}
      {latest && radarData.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Radar chart */}
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-[Syne]">Performance vs. Competitors</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fill: "#6b7280" }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8, fill: "#4b5563" }} />
                  <Radar name="OG-RMM" dataKey="ogRmm" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} />
                  <Radar name="Aveva PI" dataKey="pi" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                  <Radar name="Cognite CDF" dataKey="cognite" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.1} />
                </RadarChart>
              </ResponsiveContainer>
              <div className="flex gap-3 justify-center text-[10px] text-muted-foreground mt-1">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />OG-RMM</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Aveva PI</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />Cognite CDF</span>
              </div>
            </CardContent>
          </Card>

          {/* Score trend */}
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-[Syne]">Score Trend (Last {scoreTrend.length} Runs)</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {scoreTrend.length > 1 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={scoreTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="run" tick={{ fontSize: 9, fill: "#6b7280" }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#6b7280" }} />
                    <Tooltip
                      contentStyle={{ background: "#0d1117", border: "1px solid #374151", fontSize: 11 }}
                      formatter={(v: number) => [`${v}%`, "Score"]}
                    />
                    <Bar dataKey="score" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground text-xs">
                  Run at least 2 benchmarks to see trend
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Competitor reference table */}
      {config && (
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-[Syne]">Historian Competitor Reference Targets</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left py-1.5 text-muted-foreground font-normal">Metric</th>
                  <th className="text-right py-1.5 text-muted-foreground font-normal">Aveva PI System</th>
                  <th className="text-right py-1.5 text-muted-foreground font-normal">Cognite CDF</th>
                  <th className="text-right py-1.5 text-muted-foreground font-normal">InfluxDB OSS</th>
                  <th className="text-right py-1.5 text-amber-400 font-semibold">OG-RMM Target</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                <tr className="border-b border-border/10">
                  <td className="py-1.5 text-muted-foreground">Tag Count</td>
                  <td className="text-right py-1.5">10M</td>
                  <td className="text-right py-1.5">50M</td>
                  <td className="text-right py-1.5">1M</td>
                  <td className="text-right py-1.5 text-amber-400">100K</td>
                </tr>
                <tr className="border-b border-border/10">
                  <td className="py-1.5 text-muted-foreground">Write Throughput</td>
                  <td className="text-right py-1.5">1M pts/s</td>
                  <td className="text-right py-1.5">500K pts/s</td>
                  <td className="text-right py-1.5">300K pts/s</td>
                  <td className="text-right py-1.5 text-amber-400">100K pts/s</td>
                </tr>
                <tr className="border-b border-border/10">
                  <td className="py-1.5 text-muted-foreground">Range Query Latency</td>
                  <td className="text-right py-1.5">&lt;80ms</td>
                  <td className="text-right py-1.5">&lt;150ms</td>
                  <td className="text-right py-1.5">&lt;50ms</td>
                  <td className="text-right py-1.5 text-amber-400">&lt;100ms</td>
                </tr>
                <tr className="border-b border-border/10">
                  <td className="py-1.5 text-muted-foreground">Compression Ratio</td>
                  <td className="text-right py-1.5">12:1</td>
                  <td className="text-right py-1.5">15:1</td>
                  <td className="text-right py-1.5">10:1</td>
                  <td className="text-right py-1.5 text-amber-400">8:1</td>
                </tr>
                <tr>
                  <td className="py-1.5 text-muted-foreground">Backfill Speed</td>
                  <td className="text-right py-1.5">2M pts/s</td>
                  <td className="text-right py-1.5">1M pts/s</td>
                  <td className="text-right py-1.5">500K pts/s</td>
                  <td className="text-right py-1.5 text-amber-400">200K pts/s</td>
                </tr>
              </tbody>
            </table>
            <p className="text-[10px] text-muted-foreground/50 mt-2">
              Competitor values sourced from published benchmarks and vendor documentation. OG-RMM targets are conservative estimates for the current InfluxDB OSS deployment.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
