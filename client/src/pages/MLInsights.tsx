/**
 * ML Insights Page — ESP failure predictions, anomaly detection, model performance
 * Data: Live tRPC ml.predictions and wells.list
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { AlertTriangle, ArrowUpRight, BrainCircuit, RefreshCw, TrendingDown, Activity, Cpu, Zap } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ScatterChart, Scatter, ZAxis, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

function riskLevel(prob: number) {
  if (prob >= 0.70) return { level: "CRITICAL", color: "text-red-400",     bg: "bg-red-950/60",     border: "border-red-700/40 bg-red-950/10" };
  if (prob >= 0.40) return { level: "HIGH",     color: "text-amber-400",   bg: "bg-amber-950/60",   border: "border-amber-700/40 bg-amber-950/10" };
  if (prob >= 0.20) return { level: "MEDIUM",   color: "text-blue-400",    bg: "bg-blue-950/60",    border: "border-blue-700/40 bg-blue-950/10" };
  return               { level: "LOW",      color: "text-emerald-400", bg: "bg-emerald-950/60", border: "border-border/50 bg-card" };
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 shadow-xl text-xs">
      <div className="text-muted-foreground mb-1 font-mono">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="font-mono font-bold text-foreground">{(p.value * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

function RiskGauge({ probability }: { probability: number }) {
  const pct = probability * 100;
  const color = pct >= 70 ? "#EF4444" : pct >= 40 ? "#F59E0B" : pct >= 20 ? "#3B82F6" : "#10B981";
  return (
    <div className="relative flex flex-col items-center">
      <svg viewBox="0 0 120 70" className="w-28 h-16">
        <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="oklch(1 0 0 / 10%)" strokeWidth="8" strokeLinecap="round" />
        <path
          d="M 10 60 A 50 50 0 0 1 110 60"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${pct * 1.57} 157`}
          opacity={0.9}
        />
        <text x="60" y="58" textAnchor="middle" fill={color} fontSize="16" fontFamily="JetBrains Mono" fontWeight="bold">
          {pct.toFixed(0)}%
        </text>
      </svg>
    </div>
  );
}

export default function MLInsightsPage() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [modelFilter, setModelFilter] = useState<string>("all");

  const { data: allPredictions = [], isLoading, refetch } = trpc.ml.predictions.useQuery({ limit: 100 });
  const { data: wells = [] } = trpc.wells.list.useQuery();

  const predictions = useMemo(() =>
    modelFilter === "all" ? allPredictions : allPredictions.filter((p: any) => p.modelType === modelFilter),
    [allPredictions, modelFilter]);

  const selectedPred = predictions[selectedIdx] as any;

  const modelMetrics = useMemo(() => {
    if (!predictions.length) return null;
    const withConf = predictions.filter((p: any) => p.confidence != null);
    const avgConf = withConf.length ? withConf.reduce((s: number, p: any) => s + (p.confidence ?? 0), 0) / withConf.length : 0;
    const highRisk = predictions.filter((p: any) => (p.failureProbability ?? 0) >= 0.7).length;
    const medRisk  = predictions.filter((p: any) => (p.failureProbability ?? 0) >= 0.4 && (p.failureProbability ?? 0) < 0.7).length;
    const withAnomaly = predictions.filter((p: any) => (p.anomalyScore ?? 0) > 0.5).length;
    const avgHealth = predictions.filter((p: any) => p.healthScore != null)
      .reduce((s: number, p: any) => s + (p.healthScore ?? 0), 0) / Math.max(predictions.length, 1);
    return { avgConf, highRisk, medRisk, withAnomaly, avgHealth, total: predictions.length };
  }, [predictions]);

  const featureData = useMemo(() => {
    if (!selectedPred?.features) return [
      { feature: "Vibration",           importance: 0.28 },
      { feature: "Current Imbalance",   importance: 0.22 },
      { feature: "Temperature",         importance: 0.18 },
      { feature: "Frequency Deviation", importance: 0.15 },
      { feature: "Run Time",            importance: 0.12 },
    ];
    const f = selectedPred.features as Record<string, number>;
    return Object.entries(f).map(([feature, importance]) => ({ feature, importance }))
      .sort((a, b) => b.importance - a.importance).slice(0, 8);
  }, [selectedPred]);

  const anomalyScatterData = useMemo(() =>
    predictions.filter((p: any) => p.anomalyScore != null).map((p: any) => ({
      wellId: p.wellId,
      wellName: (wells as any[]).find((w: any) => w.wellId === p.wellId)?.name ?? p.wellId,
      anomalyScore: p.anomalyScore,
      failureProb: p.failureProbability ?? 0,
      healthScore: p.healthScore ?? 100,
      modelType: p.modelType,
    })), [predictions, wells]);

  const riskTimeline = useMemo(() => {
    const byDate: Record<string, { critical: number; high: number; medium: number; low: number }> = {};
    predictions.forEach((p: any) => {
      const d = new Date(p.predictedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (!byDate[d]) byDate[d] = { critical: 0, high: 0, medium: 0, low: 0 };
      const prob = p.failureProbability ?? 0;
      if (prob >= 0.7) byDate[d].critical++;
      else if (prob >= 0.4) byDate[d].high++;
      else if (prob >= 0.2) byDate[d].medium++;
      else byDate[d].low++;
    });
    return Object.entries(byDate).slice(-14).map(([date, counts]) => ({ date, ...counts }));
  }, [predictions]);

  const modelTypes = useMemo(() => Array.from(new Set(allPredictions.map((p: any) => p.modelType))) as string[], [allPredictions]);

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold font-[Syne] flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-amber-400" /> ML Insights
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">XGBoost + LSTM ensemble · ESP failure prediction · Real-time anomaly detection</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={modelFilter} onValueChange={setModelFilter}>
            <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder="All models" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Models</SelectItem>
              {modelTypes.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Live KPI row derived from actual predictions */}
      {isLoading ? (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : modelMetrics ? (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { label: "Total Predictions",   value: modelMetrics.total,                                  icon: Cpu,           color: "text-foreground" },
            { label: "Avg Confidence",       value: `${(modelMetrics.avgConf * 100).toFixed(1)}%`,        icon: Activity,      color: modelMetrics.avgConf >= 0.85 ? "text-emerald-400" : "text-amber-400" },
            { label: "Avg Health Score",     value: modelMetrics.avgHealth.toFixed(0),                    icon: TrendingDown,  color: modelMetrics.avgHealth >= 70 ? "text-emerald-400" : modelMetrics.avgHealth >= 50 ? "text-amber-400" : "text-red-400" },
            { label: "Critical Risk Wells",  value: modelMetrics.highRisk,                                icon: AlertTriangle, color: modelMetrics.highRisk > 0 ? "text-red-400" : "text-emerald-400" },
            { label: "High Risk Wells",      value: modelMetrics.medRisk,                                 icon: Zap,           color: modelMetrics.medRisk > 0 ? "text-amber-400" : "text-emerald-400" },
            { label: "Anomaly Detections",   value: modelMetrics.withAnomaly,                             icon: BrainCircuit,  color: modelMetrics.withAnomaly > 0 ? "text-orange-400" : "text-emerald-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-lg border border-border/50 bg-card p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Icon className={`w-3 h-3 ${color}`} />
                <div className="text-[10px] text-muted-foreground">{label}</div>
              </div>
              <div className={cn("text-lg font-mono font-bold", color)}>{value}</div>
            </div>
          ))}
        </div>
      ) : null}

      <Tabs defaultValue="predictions">
        <TabsList className="bg-muted/30 border border-border/50">
          <TabsTrigger value="predictions" className="text-xs">Failure Predictions</TabsTrigger>
          <TabsTrigger value="anomalies"   className="text-xs">Anomaly Detection</TabsTrigger>
          <TabsTrigger value="features"    className="text-xs">Feature Importance</TabsTrigger>
          <TabsTrigger value="timeline"    className="text-xs">Risk Timeline</TabsTrigger>
        </TabsList>

        {/* Predictions */}
        <TabsContent value="predictions" className="mt-4 space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44" />)}</div>
          ) : predictions.length === 0 ? (
            <div className="text-sm text-muted-foreground p-8 text-center rounded-lg border border-border/50">
              <BrainCircuit className="w-10 h-10 mx-auto mb-3 opacity-30" />
              No ML predictions available. Seed demo data from Admin → Seed Database.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {predictions.map((pred: any, i: number) => {
                const prob = pred.failureProbability ?? 0;
                const rl = riskLevel(prob);
                const well = (wells as any[]).find((w: any) => w.wellId === pred.wellId);
                return (
                  <div key={pred.id ?? i}
                    className={cn("rounded-lg border p-4 cursor-pointer transition-all", rl.border, selectedIdx === i && "ring-1 ring-amber-500/50")}
                    onClick={() => setSelectedIdx(i)}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">{well?.name ?? pred.wellId}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{well?.field ?? "—"} · {pred.modelType?.replace(/_/g, " ")}</div>
                      </div>
                      <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded", rl.bg, rl.color)}>{rl.level}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-muted-foreground">Failure Probability</div>
                        <RiskGauge probability={prob} />
                      </div>
                      <div className="text-right space-y-1">
                        {pred.healthScore != null && (
                          <div>
                            <div className="text-[10px] text-muted-foreground">Health Score</div>
                            <div className={cn("font-mono font-bold text-sm", pred.healthScore >= 70 ? "text-emerald-400" : pred.healthScore >= 50 ? "text-amber-400" : "text-red-400")}>{pred.healthScore.toFixed(0)}</div>
                          </div>
                        )}
                        {pred.daysToFailure != null && (
                          <div>
                            <div className="text-[10px] text-muted-foreground">Days to Failure</div>
                            <div className={cn("font-mono font-bold text-sm", pred.daysToFailure <= 7 ? "text-red-400" : pred.daysToFailure <= 30 ? "text-amber-400" : "text-foreground")}>{pred.daysToFailure}d</div>
                          </div>
                        )}
                        {pred.confidence != null && (
                          <div>
                            <div className="text-[10px] text-muted-foreground">Confidence</div>
                            <div className="font-mono text-xs text-muted-foreground">{(pred.confidence * 100).toFixed(0)}%</div>
                          </div>
                        )}
                      </div>
                    </div>
                    {pred.recommendation && (
                      <div className="mt-2 text-[10px] text-muted-foreground border-t border-border/30 pt-2 line-clamp-2">{pred.recommendation}</div>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">{new Date(pred.predictedAt).toLocaleString()}</span>
                      <Link href={`/wells/${pred.wellId}`}>
                        <span className="text-[10px] text-amber-400 hover:underline flex items-center gap-0.5">View Well <ArrowUpRight className="w-3 h-3" /></span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Anomaly Detection */}
        <TabsContent value="anomalies" className="mt-4 space-y-4">
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-[Syne]">Anomaly Score Distribution — Isolation Forest + LSTM Autoencoder</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {anomalyScatterData.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">No anomaly scores available. Predictions with anomaly scores will appear here.</div>
              ) : (
                <>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
                        <XAxis dataKey="anomalyScore" name="Anomaly Score" type="number" domain={[0, 1]} tick={{ fontSize: 10, fill: "#6B7280" }} label={{ value: "Anomaly Score", position: "insideBottom", offset: -10, fontSize: 10, fill: "#6B7280" }} />
                        <YAxis dataKey="failureProb" name="Failure Prob" type="number" domain={[0, 1]} tick={{ fontSize: 10, fill: "#6B7280" }} label={{ value: "Failure Prob", angle: -90, position: "insideLeft", fontSize: 10, fill: "#6B7280" }} />
                        <ZAxis dataKey="healthScore" range={[30, 200]} name="Health Score" />
                        <Tooltip content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="bg-card border border-border rounded-md px-3 py-2 text-xs">
                              <div className="font-semibold text-foreground">{d.wellName}</div>
                              <div className="text-muted-foreground">Anomaly: {(d.anomalyScore * 100).toFixed(1)}%</div>
                              <div className="text-muted-foreground">Failure: {(d.failureProb * 100).toFixed(1)}%</div>
                              <div className="text-muted-foreground">Health: {d.healthScore?.toFixed(0)}</div>
                            </div>
                          );
                        }} />
                        <Scatter data={anomalyScatterData} name="Wells">
                          {anomalyScatterData.map((d, i) => (
                            <Cell key={i} fill={d.anomalyScore >= 0.7 ? "#ef4444" : d.anomalyScore >= 0.4 ? "#f59e0b" : "#10b981"} opacity={0.8} />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 space-y-2">
                    {anomalyScatterData.filter(d => d.anomalyScore >= 0.5).sort((a, b) => b.anomalyScore - a.anomalyScore).slice(0, 5).map((event, i) => (
                      <div key={i} className={cn("p-3 rounded-md border", event.anomalyScore >= 0.7 ? "border-red-700/30 bg-red-950/10" : "border-amber-700/30 bg-amber-950/10")}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className={cn("w-3.5 h-3.5", event.anomalyScore >= 0.7 ? "text-red-400" : "text-amber-400")} />
                            <span className="text-sm font-medium text-foreground">{event.wellName}</span>
                            <Badge variant="outline" className="text-[10px]">{event.modelType?.replace(/_/g, " ")}</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs font-mono">
                            <span className="text-muted-foreground">Anomaly: <span className={event.anomalyScore >= 0.7 ? "text-red-400 font-bold" : "text-amber-400 font-bold"}>{(event.anomalyScore * 100).toFixed(1)}%</span></span>
                            <span className="text-muted-foreground">Failure: <span className="text-foreground">{(event.failureProb * 100).toFixed(1)}%</span></span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feature Importance */}
        <TabsContent value="features" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-[Syne]">Feature Importance — {selectedPred ? ((wells as any[]).find((w: any) => w.wellId === selectedPred.wellId)?.name ?? selectedPred.wellId) : "Select a prediction"}</CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={featureData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
                    <YAxis dataKey="feature" type="category" tick={{ fontSize: 10, fill: "#9CA3AF", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} width={130} />
                    <Tooltip contentStyle={{ background: "oklch(0.21 0.006 285.885)", border: "none", borderRadius: "4px", fontSize: "10px" }} />
                    <Bar dataKey="importance" fill="#D97706" radius={[0, 3, 3, 0]} name="Importance" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-[Syne]">Health Score Distribution</CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={[
                    { range: "0-20",   count: predictions.filter((p: any) => (p.healthScore ?? 0) < 20).length },
                    { range: "20-40",  count: predictions.filter((p: any) => (p.healthScore ?? 0) >= 20 && (p.healthScore ?? 0) < 40).length },
                    { range: "40-60",  count: predictions.filter((p: any) => (p.healthScore ?? 0) >= 40 && (p.healthScore ?? 0) < 60).length },
                    { range: "60-80",  count: predictions.filter((p: any) => (p.healthScore ?? 0) >= 60 && (p.healthScore ?? 0) < 80).length },
                    { range: "80-100", count: predictions.filter((p: any) => (p.healthScore ?? 0) >= 80).length },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" />
                    <XAxis dataKey="range" tick={{ fontSize: 10, fill: "#6B7280" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#6B7280" }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "oklch(0.21 0.006 285.885)", border: "none", borderRadius: "4px", fontSize: "10px" }} />
                    <Bar dataKey="count" name="Wells" radius={[3, 3, 0, 0]}>
                      {[0, 1, 2, 3, 4].map(i => <Cell key={i} fill={["#ef4444","#f97316","#f59e0b","#3b82f6","#10b981"][i]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Risk Timeline */}
        <TabsContent value="timeline" className="mt-4">
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-[Syne]">Risk Level Timeline — Last 14 Days</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              {riskTimeline.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">No timeline data available.</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={riskTimeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6B7280" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#6B7280" }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "oklch(0.21 0.006 285.885)", border: "none", borderRadius: "4px", fontSize: "10px" }} />
                    <Bar dataKey="critical" name="Critical" stackId="a" fill="#ef4444" />
                    <Bar dataKey="high"     name="High"     stackId="a" fill="#f59e0b" />
                    <Bar dataKey="medium"   name="Medium"   stackId="a" fill="#3b82f6" />
                    <Bar dataKey="low"      name="Low"      stackId="a" fill="#10b981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
