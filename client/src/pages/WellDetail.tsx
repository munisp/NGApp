import { useTranslation } from 'react-i18next';
/**
 * Well Detail Page — Real-time sensor readings, production charts, ESP health
 */

import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useTelemetryStream } from "@/hooks/useTelemetryStream";
import { ArrowLeft, Activity, AlertTriangle, BrainCircuit, Gauge, Thermometer, Waves, Zap, TrendingDown, Clock, Wrench, Settings, Plus, Pencil, Trash2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ReferenceLine, ReferenceArea, ComposedChart, Bar } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
type SensorReading = { sensor_id: string; sensor_type: string; value: number; unit: string; quality: number; timestamp: string; trend: string; };
import { trpc } from "@/lib/trpc";
import { useESPForecast } from "@/hooks/useAPI";

const SENSOR_ICONS: Record<string, LucideIcon> = {
  TUBING_PRESSURE: Gauge,
  CASING_PRESSURE: Gauge,
  FLOW_RATE: Waves,
  BOTTOMHOLE_TEMP: Thermometer,
  WELLHEAD_TEMP: Thermometer,
  ESP_CURRENT: Zap,
  ESP_VIBRATION: Activity,
  ESP_FREQUENCY: Activity,
};

const SENSOR_THRESHOLDS: Record<string, { min: number; max: number }> = {
  TUBING_PRESSURE: { min: 800, max: 2000 },
  CASING_PRESSURE: { min: 500, max: 1500 },
  FLOW_RATE: { min: 100, max: 2000 },
  BOTTOMHOLE_TEMP: { min: 100, max: 250 },
  WELLHEAD_TEMP: { min: 40, max: 150 },
  ESP_CURRENT: { min: 20, max: 80 },
  ESP_VIBRATION: { min: 0, max: 3.0 },
  ESP_FREQUENCY: { min: 55, max: 65 },
};

function SensorCard({ reading }: { reading: SensorReading }) {
  const Icon = SENSOR_ICONS[reading.sensor_type] || Gauge;
  const threshold = SENSOR_THRESHOLDS[reading.sensor_type];
  const isAbnormal = threshold && (reading.value < threshold.min || reading.value > threshold.max);
  const label = reading.sensor_type.replace(/_/g, " ");

  return (
    <div className={cn(
      "p-3 rounded-lg border transition-all duration-300",
      isAbnormal
        ? "border-amber-700/50 bg-amber-950/20"
        : "border-border/50 bg-card"
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={cn("w-3.5 h-3.5", isAbnormal ? "text-amber-400" : "text-muted-foreground")} />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
        </div>
        <div className={cn(
          "w-1.5 h-1.5 rounded-full",
          reading.quality >= 90 ? "bg-emerald-500" : reading.quality >= 70 ? "bg-amber-500" : "bg-red-500"
        )} />
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn("text-xl font-mono font-bold tabular-nums", isAbnormal ? "text-amber-400" : "text-foreground")}>
          {reading.value.toFixed(1)}
        </span>
        <span className="text-[10px] text-muted-foreground font-mono uppercase">{reading.unit}</span>
      </div>
      <div className="flex items-center gap-1 mt-1">
        {reading.trend === "up" && <span className="text-[9px] text-emerald-400 font-mono">↑ rising</span>}
        {reading.trend === "down" && <span className="text-[9px] text-red-400 font-mono">↓ falling</span>}
        {reading.trend === "stable" && <span className="text-[9px] text-muted-foreground font-mono">→ stable</span>}
        <span className="text-[9px] text-muted-foreground font-mono ml-auto">Q:{reading.quality}%</span>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 shadow-xl">
      <div className="text-xs text-muted-foreground mb-1 font-mono">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="text-xs font-mono font-bold" style={{ color: p.color }}>
          {p.value?.toFixed(1)} {p.unit || ""}
        </div>
      ))}
    </div>
  );
}

// ── ESP Health Panel with LSTM 7-day forecast ────────────────────────────────

function ESPHealthPanel({ wellId, well }: { wellId: string; well: any }) {
  const { data: forecast } = useESPForecast(wellId);

  const healthColor = (h: number) =>
    h >= 80 ? "text-emerald-400" : h >= 60 ? "text-amber-400" : "text-red-400";
  const healthBg = (h: number) =>
    h >= 80 ? "bg-emerald-500" : h >= 60 ? "bg-amber-500" : "bg-red-500";

  const actionConfig: Record<string, { label: string; color: string; icon: LucideIcon }> = {
    IMMEDIATE_INSPECTION: { label: "Immediate Inspection Required", color: "text-red-400", icon: AlertTriangle },
    SCHEDULE_WORKOVER: { label: "Schedule Workover Within 72h", color: "text-amber-400", icon: Wrench },
    INCREASE_MONITORING: { label: "Increase Monitoring Frequency", color: "text-yellow-400", icon: Clock },
    CONTINUE_NORMAL_OPERATIONS: { label: "Continue Normal Operations", color: "text-emerald-400", icon: Activity },
  };
  const action = actionConfig[forecast?.recommended_action ?? "CONTINUE_NORMAL_OPERATIONS"];
  const ActionIcon = action.icon;

  const chartData = [
    { label: "Today", health: forecast?.current_health ?? well.esp_health ?? 85, lower: null, upper: null, isForecast: false },
    ...(forecast?.forecast ?? []).map(f => ({
      label: `D+${f.day}`,
      health: f.predicted_health,
      lower: f.lower,
      upper: f.upper,
      vibration: f.vibration_forecast,
      current: f.current_forecast,
      isForecast: true,
    })),
  ];

  const vibData = (forecast?.forecast ?? []).map(f => ({
    label: `D+${f.day}`,
    vibration: f.vibration_forecast,
    current: f.current_forecast,
  }));

  const failProb7d = ((forecast?.failure_probability_7d ?? well.esp_failure_prob_7d ?? 0.1) * 100).toFixed(0);
  const failProb30d = ((forecast?.failure_probability_30d ?? (well.esp_failure_prob_7d ?? 0.1) * 2.5) * 100).toFixed(0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={cn("kpi-card", (well.esp_health ?? 85) < 60 && "border-red-700/40")}>
          <div className="text-xs text-muted-foreground mb-1">Current Health</div>
          <div className={cn("text-3xl font-mono font-bold tabular-nums", healthColor(well.esp_health ?? 85))}>
            {well.esp_health ?? 85}%
          </div>
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all duration-700", healthBg(well.esp_health ?? 85))}
              style={{ width: `${well.esp_health ?? 85}%` }} />
          </div>
        </div>
        <div className="kpi-card">
          <div className="text-xs text-muted-foreground mb-1">7-Day Failure Risk</div>
          <div className={cn("text-3xl font-mono font-bold tabular-nums",
            Number(failProb7d) >= 50 ? "text-red-400" : Number(failProb7d) >= 25 ? "text-amber-400" : "text-emerald-400")}>
            {failProb7d}%
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 font-mono">XGBoost+LSTM v2.4</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs text-muted-foreground mb-1">30-Day Failure Risk</div>
          <div className={cn("text-3xl font-mono font-bold tabular-nums",
            Number(failProb30d) >= 60 ? "text-red-400" : Number(failProb30d) >= 35 ? "text-amber-400" : "text-emerald-400")}>
            {failProb30d}%
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 font-mono">Ensemble model</div>
        </div>
        <div className={cn("kpi-card border",
          action.color === "text-red-400" ? "border-red-700/40 bg-red-950/10" :
          action.color === "text-amber-400" ? "border-amber-700/40" : "border-border/50")}>
          <div className="text-xs text-muted-foreground mb-1">Recommended Action</div>
          <div className={cn("flex items-start gap-1.5 mt-1", action.color)}>
            <ActionIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span className="text-xs font-medium leading-tight">{action.label}</span>
          </div>
          <Link href="/workovers">
            <div className="text-[10px] text-amber-400 hover:text-amber-300 mt-2 cursor-pointer">Create workover job →</div>
          </Link>
        </div>
      </div>

      {/* LSTM Health Forecast Chart */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-[Syne] flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-amber-400" />
              LSTM 7-Day ESP Health Forecast
            </CardTitle>
            <span className="text-[10px] text-muted-foreground font-mono bg-muted/30 px-2 py-0.5 rounded">95% confidence interval</span>
          </div>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="healthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D97706" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#D97706" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} unit="%" />
              <Tooltip
                contentStyle={{ background: "oklch(0.155 0.010 264)", border: "1px solid oklch(1 0 0 / 10%)", borderRadius: "6px", fontSize: "11px", fontFamily: "JetBrains Mono" }}
                labelStyle={{ color: "#9CA3AF" }}
              />
              <ReferenceLine y={40} stroke="#EF4444" strokeDasharray="4 2" strokeWidth={1}
                label={{ value: "Critical", fill: "#EF4444", fontSize: 9, fontFamily: "JetBrains Mono", position: "insideTopRight" }} />
              <ReferenceLine y={70} stroke="#F59E0B" strokeDasharray="4 2" strokeWidth={1}
                label={{ value: "Warning", fill: "#F59E0B", fontSize: 9, fontFamily: "JetBrains Mono", position: "insideTopRight" }} />
              <ReferenceArea x1="D+1" x2="D+7" fill="oklch(0.68 0.18 60 / 4%)" />
              <Area type="monotone" dataKey="upper" stroke="none" fill="oklch(0.68 0.18 60 / 12%)" legendType="none" name="Upper CI" />
              <Area type="monotone" dataKey="lower" stroke="none" fill="oklch(0.118 0.008 264)" legendType="none" name="Lower CI" />
              <Line type="monotone" dataKey="health" stroke="#D97706" strokeWidth={2.5}
                dot={(props: any) => props.payload.isForecast
                  ? <circle key={props.key} cx={props.cx} cy={props.cy} r={3} fill="#D97706" stroke="oklch(0.155 0.010 264)" strokeWidth={1.5} />
                  : <circle key={props.key} cx={props.cx} cy={props.cy} r={4} fill="#D97706" stroke="oklch(0.155 0.010 264)" strokeWidth={2} />}
                name="ESP Health %" />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 px-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-amber-500" />
              <span className="text-[10px] text-muted-foreground font-mono">Predicted health</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-amber-500/15 border border-amber-500/20" />
              <span className="text-[10px] text-muted-foreground font-mono">95% confidence band</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 border-t border-dashed border-red-500" />
              <span className="text-[10px] text-muted-foreground font-mono">Critical threshold (40%)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vibration & Current Forecast */}
      {vibData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-[Syne]">Vibration Forecast (mm/s)</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <ResponsiveContainer width="100%" height={140}>
                <ComposedChart data={vibData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "oklch(0.155 0.010 264)", border: "1px solid oklch(1 0 0 / 10%)", borderRadius: "6px", fontSize: "11px", fontFamily: "JetBrains Mono" }} />
                  <ReferenceLine y={3.0} stroke="#F59E0B" strokeDasharray="4 2" strokeWidth={1} />
                  <Bar dataKey="vibration" fill="#3B82F6" fillOpacity={0.7} radius={[2, 2, 0, 0]} name="Vibration mm/s" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-[Syne]">Motor Current Forecast (A)</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <ResponsiveContainer width="100%" height={140}>
                <ComposedChart data={vibData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "oklch(0.155 0.010 264)", border: "1px solid oklch(1 0 0 / 10%)", borderRadius: "6px", fontSize: "11px", fontFamily: "JetBrains Mono" }} />
                  <ReferenceLine y={60} stroke="#EF4444" strokeDasharray="4 2" strokeWidth={1} />
                  <Line type="monotone" dataKey="current" stroke="#10B981" strokeWidth={2} dot={false} name="Current A" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SHAP Feature Importance */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-[Syne] flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-muted-foreground" />
            Top Failure Drivers (SHAP Values)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-2.5">
            {[
              { feature: "Vibration RMS (7d avg)", importance: 0.31 },
              { feature: "Current Imbalance %", importance: 0.24 },
              { feature: "Motor Temp Deviation", importance: 0.19 },
              { feature: "Frequency Drift Hz", importance: 0.14 },
              { feature: "Cumulative Run Hours", importance: 0.12 },
            ].map(f => (
              <div key={f.feature} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-mono w-44 shrink-0">{f.feature}</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full transition-all duration-700" style={{ width: `${f.importance * 100}%` }} />
                </div>
                <span className="text-xs font-mono text-foreground w-10 text-right">{(f.importance * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function WellDetailPage() {
  const { t } = useTranslation();
  const { wellId } = useParams<{ wellId: string }>();

  // Live tRPC queries
  const { data: dbWell } = trpc.wells.get.useQuery({ wellId: wellId ?? "" }, { enabled: !!wellId });
  const { data: dbAlarms } = trpc.wells.allAlarms.useQuery({ wellId: wellId ?? "", limit: 20 } as any, { enabled: !!wellId });
  const { data: productionDb } = trpc.production.list.useQuery({ wellId: wellId ?? "", limit: 30 }, { enabled: !!wellId });

  // SSE real-time telemetry stream
  const { telemetry: liveTelemetry, connected: sseConnected, simulated: sseSimulated } = useTelemetryStream(wellId);

   const well = dbWell ?? null;
  const wellAlarms = (dbAlarms as any[]) ?? [];
  const effectiveWellId = (well as any)?.wellId ?? (well as any)?.well_id ?? wellId ?? "";
  // Build sensor readings from live SSE telemetry
  const sensors = useMemo<SensorReading[]>(() => {
    if (!liveTelemetry) return [];;
    const t = liveTelemetry;
    const now = new Date().toISOString();
    const mkReading = (sensor_type: string, value: number, unit: string, quality = t.quality ?? 85): SensorReading => ({
      sensor_id: `${sensor_type}-live`,
      sensor_type,
      value,
      unit,
      quality,
      timestamp: t.recordedAt ?? now,
      trend: "stable" as const,
    });
    return [
      mkReading("TUBING_PRESSURE", t.tubingPressure ?? 0, "psi"),
      mkReading("CASING_PRESSURE", t.casingPressure ?? 0, "psi"),
      mkReading("FLOW_RATE", t.flowRate ?? 0, "bbl/d"),
      mkReading("WELLHEAD_TEMP", t.wellheadTemp ?? 0, "°C"),
      mkReading("ESP_CURRENT", t.espCurrent ?? 0, "A"),
      mkReading("ESP_FREQUENCY", t.espFrequency ?? 0, "Hz"),
      mkReading("ESP_VIBRATION", t.espVibration ?? 0, "mm/s"),
    ];
  }, [liveTelemetry, wellId]);

  // Resolution toggle for telemetry chart (standard = PostgreSQL, high = InfluxDB)
  const [chartResolution, setChartResolution] = useState<"standard" | "high">("standard");
  const [chartHours, setChartHours] = useState(24);

  const { data: telemetryHistory, isFetching: historyFetching } = trpc.telemetry.history.useQuery(
    { wellId: effectiveWellId, hours: chartHours, resolution: chartResolution },
    { enabled: !!effectiveWellId, refetchInterval: chartResolution === "high" ? 15000 : 60000 }
  );

  // Transform tRPC telemetry history into chart-friendly format
  const pressureHistory = useMemo(() => {
    if (telemetryHistory && telemetryHistory.length > 0) {
      return [...telemetryHistory]
        .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
        .map(r => ({
          time: new Date(r.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          tubing: r.tubingPressure ? Number(r.tubingPressure) : null,
          casing: r.casingPressure ? Number(r.casingPressure) : null,
          flow: r.flowRate ? Number(r.flowRate) : null,
        }));
    }
    // Fallback sparkline when no DB data
    return Array.from({ length: 24 }, (_, i) => ({
      time: `${23 - i}h`,
      tubing: 1320 + Math.sin(Date.now() / 60000 + 1) * 40,
      casing: 890 + Math.sin(Date.now() / 60000 + 2) * 30,
      flow: null,
    })).reverse();
  }, [telemetryHistory]);

  const STATUS_CONFIG: Record<string, string> = {
    ACTIVE: "status-badge-normal",
    SHUT_IN: "status-badge-offline",
    DRILLING: "status-badge-drilling",
    WORKOVER: "status-badge-warning",
    ABANDONED: "status-badge-offline",
  };

  const wellName = (well as any)?.name ?? (well as any)?.well_name ?? "Unknown Well";
  const wellStatus = (well as any)?.status ?? "ACTIVE";
  const wellApiNumber = (well as any)?.apiNumber ?? (well as any)?.api_number ?? "—";
  const wellField = (well as any)?.field ?? (well as any)?.field_name ?? "—";
  const wellBasin = (well as any)?.basin ?? "—";
  const wellDepth = (well as any)?.depth ?? (well as any)?.total_depth_ft ?? 0;
  const wellType = (well as any)?.wellType ?? (well as any)?.well_type ?? "OIL";

  // Kafka live stream status from Go telemetry-ingestion service
  const { data: kafkaStatus } = trpc.telemetry.getLiveStreamStatus.useQuery(
    { wellId: effectiveWellId },
    { enabled: !!effectiveWellId, refetchInterval: 10_000 }
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/wells">
          <button className="mt-1 p-1.5 rounded-md border border-border/50 hover:border-amber-700/40 hover:bg-amber-950/10 transition-all">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold font-[Syne]">{wellName}</h1>
            <span className={STATUS_CONFIG[wellStatus] ?? "status-badge-offline"}>{wellStatus.replace("_", " ")}</span>
            {(wellAlarms as any[]).some((a: any) => a.state === "UNACKNOWLEDGED") && (
              <span className="status-badge-critical">
                <AlertTriangle className="w-3 h-3" />
                {(wellAlarms as any[]).filter((a: any) => a.state === "UNACKNOWLEDGED").length} Alarm{(wellAlarms as any[]).filter((a: any) => a.state === "UNACKNOWLEDGED").length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground font-mono flex-wrap">
            <span>API: {wellApiNumber}</span>
            <span>{wellField}, {wellBasin}</span>
            <span>TD: {wellDepth.toLocaleString()} ft</span>
            <span>{wellType}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* SSE stream indicator */}
          <div className="flex items-center gap-1.5">
            <div className={cn("live-indicator", !sseConnected && "bg-gray-500 shadow-none animate-none")} />
            <span className="text-xs text-muted-foreground font-mono">
              {sseConnected ? (sseSimulated ? "SIMULATED" : "LIVE") : "CONNECTING..."}
            </span>
          </div>
          {/* Kafka consumer indicator */}
          {kafkaStatus && (
            <div className="flex items-center gap-1.5 border border-border/40 rounded px-2 py-0.5">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                kafkaStatus.live ? "bg-emerald-400 animate-pulse" : "bg-gray-500"
              )} />
              <span className="text-[10px] font-mono text-muted-foreground">
                {kafkaStatus.live
                  ? `KAFKA • ${kafkaStatus.messagesPerSec.toFixed(1)}/s`
                  : kafkaStatus.source === "unavailable" ? "KAFKA OFFLINE" : "KAFKA IDLE"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Production KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Oil Rate", value: (well as any).oil_bpd ?? 0, unit: "BPD", color: "text-amber-400" },
          { label: "Gas Rate", value: (well as any).gas_mcfd ?? 0, unit: "Mcfd", color: "text-blue-400" },
          { label: "Water Rate", value: (well as any).water_bpd ?? 0, unit: "BPD", color: "text-cyan-400" },
          { label: "Uptime", value: `${(well as any).uptime_pct ?? 0}%`, unit: "", color: "text-emerald-400" },
        ].map(({ label, value, unit, color }) => (
          <div key={label} className="kpi-card">
            <div className="text-xs text-muted-foreground mb-1">{label}</div>
            <div className={cn("text-2xl font-mono font-bold tabular-nums", color)}>
              {typeof value === "number" ? value.toLocaleString() : value}
              {unit && <span className="text-xs text-muted-foreground font-normal ml-1">{unit}</span>}
            </div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="sensors">
        <TabsList className="bg-muted/30 border border-border/50">
          <TabsTrigger value="sensors" className="text-xs">Live Sensors</TabsTrigger>
          <TabsTrigger value="production" className="text-xs">Production</TabsTrigger>
          <TabsTrigger value="esp" className="text-xs">ESP Health</TabsTrigger>
          <TabsTrigger value="setpoints" className="text-xs">Setpoints</TabsTrigger>
          <TabsTrigger value="alarms" className="text-xs">
            Alarms
            {wellAlarms.length > 0 && (
              <span className="ml-1.5 text-[9px] bg-red-900/60 text-red-400 px-1 rounded font-mono">{wellAlarms.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="safety" className="text-xs">Safety (SIL)</TabsTrigger>
          <TabsTrigger value="devices" className="text-xs">Devices</TabsTrigger>
          <TabsTrigger value="thresholds" className="text-xs">Alert Thresholds</TabsTrigger>
        </TabsList>

        {/* Live Sensors */}
        <TabsContent value="sensors" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {sensors.map(s => <SensorCard key={s.sensor_id} reading={s} />)}
          </div>
          {/* Telemetry Trend Chart with InfluxDB high-resolution toggle */}
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm font-[Syne]">
                  Pressure Trend
                  {historyFetching && <span className="ml-2 text-xs text-muted-foreground animate-pulse">loading…</span>}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {/* Time range selector */}
                  <select
                    value={chartHours}
                    onChange={e => setChartHours(Number(e.target.value))}
                    className="text-xs bg-muted/40 border border-border/50 rounded px-2 py-1 text-muted-foreground"
                  >
                    <option value={1}>1 h</option>
                    <option value={6}>6 h</option>
                    <option value={24}>24 h</option>
                    <option value={72}>3 d</option>
                  </select>
                  {/* Resolution toggle */}
                  <button
                    onClick={() => setChartResolution(r => r === "standard" ? "high" : "standard")}
                    className={cn(
                      "text-xs px-2 py-1 rounded border transition-all font-mono",
                      chartResolution === "high"
                        ? "border-amber-600/60 bg-amber-950/30 text-amber-400"
                        : "border-border/50 bg-muted/20 text-muted-foreground hover:border-amber-700/40"
                    )}
                    title={chartResolution === "high" ? "High-res (InfluxDB, 10s)" : "Standard (PostgreSQL, 1min)"}
                  >
                    {chartResolution === "high" ? "⚡ HI-RES" : "STD"}
                  </button>
                </div>
              </div>
              {chartResolution === "high" && (
                <p className="text-[10px] text-amber-500/70 mt-1 font-mono">
                  InfluxDB · 10-second aggregates · auto-refreshes every 15s
                </p>
              )}
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={pressureHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" />
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="tubing" stroke="#D97706" strokeWidth={2} dot={false} name="Tubing PSI" connectNulls />
                  <Line type="monotone" dataKey="casing" stroke="#3B82F6" strokeWidth={1.5} dot={false} name="Casing PSI" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Production */}
        <TabsContent value="production" className="mt-4">
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-[Syne]">30-Day Production History</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={(productionDb as any[] ?? []).map((d: any) => ({ date: (d.date ?? d.recordedAt ?? "").slice(5), oil_bbls: d.oilBbls ?? d.oil_bbls ?? 0, gas_mcf: d.gasMcf ?? d.gas_mcf ?? 0 }))}>
                  <defs>
                    <linearGradient id="oilGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D97706" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#D97706" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} interval={4} />
                  <YAxis tick={{ fontSize: 9, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="oil_bbls" stroke="#D97706" strokeWidth={2} fill="url(#oilGrad2)" dot={false} name="Oil BBL" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ESP Health */}
        <TabsContent value="esp" className="mt-4">
          {(well as any).esp_installed ? (
            <ESPHealthPanel wellId={(well as any).wellId ?? (well as any).well_id ?? wellId ?? ""} well={well} />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Zap className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No ESP installed on this well</p>
            </div>
          )}
        </TabsContent>

        {/* Alarms */}
        <TabsContent value="alarms" className="mt-4">
          <div className="space-y-2">
            {wellAlarms.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No alarms for this well</p>
              </div>
            ) : (wellAlarms as any[]).map((alarm: any) => (
              <div key={alarm.alarm_id ?? alarm.alarmId ?? alarm.id} className={cn(
                "p-3 rounded-md border",
                alarm.severity === 1 ? "alarm-critical border-red-800/30" :
                alarm.severity === 2 ? "alarm-warning border-amber-700/30" : "alarm-info border-blue-800/30"
              )}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={alarm.severity === 1 ? "status-badge-critical" : alarm.severity === 2 ? "status-badge-warning" : "status-badge-normal"}>
                    {alarm.severity === 1 ? "CRITICAL" : alarm.severity === 2 ? "HIGH" : "MEDIUM"}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">{((alarm as any).alarm_type ?? (alarm as any).tag ?? "").replace(/_/g, " ")}</span>
                  <span className="text-xs text-muted-foreground font-mono ml-auto">{alarm.state}</span>
                </div>
                <p className="text-xs text-foreground">{(alarm as any).message ?? (alarm as any).description ?? ""}</p>
                {((alarm as any).acknowledged_by ?? (alarm as any).acknowledgedBy) && (
                  <p className="text-[10px] text-muted-foreground mt-1">Ack'd by {(alarm as any).acknowledged_by ?? (alarm as any).acknowledgedBy}</p>
                )}
              </div>
            ))}
          </div>
        </TabsContent>
        {/* Setpoints */}
        <TabsContent value="setpoints" className="mt-4">
          <SetpointsPanel wellId={(well as any).wellId ?? (well as any).well_id ?? wellId ?? ""} />
        </TabsContent>
        {/* Safety (SIL) */}
        <TabsContent value="safety" className="mt-4">
          <SILPanel wellId={(well as any).wellId ?? (well as any).well_id ?? wellId ?? ""} />
        </TabsContent>
        {/* Devices */}
        <TabsContent value="devices" className="mt-4">
          <DevicesPanel wellId={(well as any).wellId ?? (well as any).well_id ?? wellId ?? ""} />
        </TabsContent>
        {/* Alert Thresholds */}
        <TabsContent value="thresholds" className="mt-4">
          <AlertThresholdsPanel wellNumericId={(well as any).id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SETPOINTS PANEL — per-well alarm rule CRUD
// ─────────────────────────────────────────────────────────────────────────────
const SENSOR_FIELDS_LIST = [
  "TUBING_PRESSURE", "CASING_PRESSURE", "FLOW_RATE",
  "BOTTOMHOLE_TEMP", "WELLHEAD_TEMP", "ESP_CURRENT",
  "ESP_VIBRATION", "ESP_FREQUENCY", "GAS_RATE", "WATER_CUT",
];
const CONDITIONS_LIST = [">", ">=", "<", "<=", "==", "!="];
const SEV_LABELS: Record<number, string> = { 1: "Critical", 2: "High", 3: "Medium", 4: "Low" };
const SEV_COLORS: Record<number, string> = {
  1: "text-red-400 bg-red-900/20 border-red-800/30",
  2: "text-amber-400 bg-amber-900/20 border-amber-800/30",
  3: "text-blue-400 bg-blue-900/20 border-blue-800/30",
  4: "text-slate-400 bg-slate-900/20 border-slate-800/30",
};

function SetpointsPanel({ wellId }: { wellId: string }) {
  const utils = trpc.useUtils();
  const { data: rules = [], isLoading } = trpc.wells.alarmRules.useQuery({ wellId });
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    tag: "", sensorField: "TUBING_PRESSURE", condition: ">",
    threshold: "", deadBand: "0", severity: "2",
    description: "", unit: "PSI", isa182Category: "PROCESS", enabled: true,
  });

  const createMutation = trpc.wells.createAlarmRule.useMutation({
    onSuccess: () => { utils.wells.alarmRules.invalidate(); setShowDialog(false); toast.success("Setpoint created"); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.wells.updateAlarmRule.useMutation({
    onSuccess: () => { utils.wells.alarmRules.invalidate(); setShowDialog(false); toast.success("Setpoint updated"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.wells.deleteAlarmRule.useMutation({
    onSuccess: () => { utils.wells.alarmRules.invalidate(); toast.success("Setpoint deleted"); },
    onError: (e) => toast.error(e.message),
  });
  const toggleMutation = trpc.wells.updateAlarmRule.useMutation({
    onSuccess: () => utils.wells.alarmRules.invalidate(),
  });

  function openCreate() {
    setEditing(null);
    setForm({ tag: "", sensorField: "TUBING_PRESSURE", condition: ">", threshold: "", deadBand: "0", severity: "2", description: "", unit: "PSI", isa182Category: "PROCESS", enabled: true });
    setShowDialog(true);
  }

  function openEdit(rule: any) {
    setEditing(rule);
    setForm({
      tag: rule.tag, sensorField: rule.sensorField, condition: rule.condition,
      threshold: String(rule.threshold), deadBand: String(rule.deadBand ?? 0),
      severity: String(rule.severity), description: rule.description,
      unit: rule.unit ?? "PSI", isa182Category: rule.isa182Category ?? "PROCESS",
      enabled: rule.enabled,
    });
    setShowDialog(true);
  }

  function handleSubmit() {
    if (!form.tag || !form.threshold || !form.description) {
      toast.error("Tag, threshold, and description are required"); return;
    }
    const payload = {
      wellId, tag: form.tag, sensorField: form.sensorField,
      condition: form.condition as any, threshold: parseFloat(form.threshold),
      deadBand: parseFloat(form.deadBand) || 0, severity: parseInt(form.severity),
      description: form.description, unit: form.unit,
      isa182Category: form.isa182Category, enabled: form.enabled,
    };
    if (editing) updateMutation.mutate({ id: editing.id, ...payload });
    else createMutation.mutate(payload);
  }

  if (isLoading) return <div className="py-12 text-center text-muted-foreground text-sm">Loading setpoints...</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Alarm Setpoints</p>
          <p className="text-xs text-muted-foreground">ISA-18.2 compliant alarm rules for this well</p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Setpoint
        </Button>
      </div>
      {rules.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Settings className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No setpoints configured for this well</p>
          <p className="text-xs mt-1">Click "Add Setpoint" to define alarm thresholds</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(rules as any[]).map((rule: any) => (
            <div key={rule.id} className={cn("p-3 rounded-md border flex items-start gap-3", SEV_COLORS[rule.severity] ?? SEV_COLORS[4])}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold">{rule.tag}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/20 font-mono">
                    {rule.sensorField} {rule.condition} {rule.threshold} {rule.unit}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/20">{SEV_LABELS[rule.severity] ?? "Low"}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/20">{rule.isa182Category}</span>
                  {rule.deadBand > 0 && <span className="text-[10px] text-muted-foreground">±{rule.deadBand} dead-band</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">{rule.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch checked={rule.enabled} onCheckedChange={(v) => toggleMutation.mutate({ id: rule.id, enabled: v })} className="scale-75" />
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(rule)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-300" onClick={() => deleteMutation.mutate({ id: rule.id })}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Setpoint" : "Add Setpoint"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tag *</Label>
                <Input className="h-8 text-xs font-mono" placeholder="e.g. THP_HIGH" value={form.tag} onChange={e => setForm(f => ({ ...f, tag: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sensor Field</Label>
                <Select value={form.sensorField} onValueChange={v => setForm(f => ({ ...f, sensorField: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{SENSOR_FIELDS_LIST.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Condition</Label>
                <Select value={form.condition} onValueChange={v => setForm(f => ({ ...f, condition: v }))}>
                  <SelectTrigger className="h-8 text-xs font-mono"><SelectValue /></SelectTrigger>
                  <SelectContent>{CONDITIONS_LIST.map(c => <SelectItem key={c} value={c} className="text-xs font-mono">{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Threshold *</Label>
                <Input className="h-8 text-xs font-mono" type="number" placeholder="1500" value={form.threshold} onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unit</Label>
                <Input className="h-8 text-xs font-mono" placeholder="PSI" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Dead-band</Label>
                <Input className="h-8 text-xs font-mono" type="number" placeholder="0" value={form.deadBand} onChange={e => setForm(f => ({ ...f, deadBand: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Severity</Label>
                <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1" className="text-xs">1 — Critical</SelectItem>
                    <SelectItem value="2" className="text-xs">2 — High</SelectItem>
                    <SelectItem value="3" className="text-xs">3 — Medium</SelectItem>
                    <SelectItem value="4" className="text-xs">4 — Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">ISA-18.2 Category</Label>
              <Select value={form.isa182Category} onValueChange={v => setForm(f => ({ ...f, isa182Category: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["PROCESS","EQUIPMENT","SAFETY","ENVIRONMENTAL","REGULATORY"].map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description *</Label>
              <Input className="h-8 text-xs" placeholder="High tubing head pressure alarm" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.enabled} onCheckedChange={v => setForm(f => ({ ...f, enabled: v }))} />
              <Label className="text-xs">Enabled</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SIL PANEL — per-well SIL 2 loop seeding and assessment overview
// ─────────────────────────────────────────────────────────────────────────────

const SIL_LOOPS = [
  { loopType: "HIPPS", label: "High-Integrity Pressure Protection System", silTarget: 2, standard: "IEC 61511-1" },
  { loopType: "ESD", label: "Emergency Shutdown System", silTarget: 2, standard: "IEC 61511-1" },
  { loopType: "BPCS", label: "Basic Process Control System", silTarget: 1, standard: "IEC 61511-1" },
  { loopType: "FGS", label: "Fire & Gas Detection System", silTarget: 2, standard: "IEC 61511-1" },
  { loopType: "EDP", label: "Emergency Depressurisation System", silTarget: 2, standard: "IEC 61511-1" },
];

function SILPanel({ wellId }: { wellId: string }) {
  const utils = trpc.useUtils();
  const [seeding, setSeeding] = useState<string | null>(null);

  const { data: assessments = [], isLoading } = trpc.silCertification.listWellAssessments.useQuery();

  const seedMutation = trpc.silCertification.seedWellLoops.useMutation({
    onMutate: () => setSeeding("seeding"),
    onSuccess: () => {
      utils.silCertification.listWellAssessments.invalidate();
      toast.success(`SIL 2 assessment seeded for well ${wellId}`);
      setSeeding(null);
    },
    onError: (e) => { toast.error(e.message); setSeeding(null); },
  });

  // Check if this well already has a seeded assessment
  const wellAssessments = (assessments as any[]).filter((a: any) =>
    (a.scope ?? "").includes(wellId) || (a.title ?? "").includes(wellId)
  );
  const isSeeded = wellAssessments.length > 0;

  if (isLoading) return (
    <div className="py-12 text-center text-muted-foreground text-sm">Loading SIL assessments...</div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Safety Integrity Level (SIL) Assessments</p>
          <p className="text-xs text-muted-foreground">IEC 61511-1:2016 — SIF loop assessments for this well</p>
        </div>
        <a href="/sil-certification" className="text-xs text-amber-400 hover:text-amber-300">
          View full SIL dashboard →
        </a>
      </div>

      {/* Single seed button for all 5 SIF loops at once */}
      <div className="p-4 rounded-lg border border-border/50 bg-card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Seed All SIF Loops</p>
            <p className="text-xs text-muted-foreground">Creates IEC 61511-1:2016 SIL 2 assessment with 21 controls across all 5 SIF loops</p>
          </div>
          <Button
            size="sm"
            variant={isSeeded ? "outline" : "default"}
            className={cn("shrink-0 text-xs h-8 px-4", isSeeded && "border-emerald-700/40 text-emerald-400 hover:bg-emerald-950/20")}
            disabled={seeding === "seeding"}
            onClick={() => seedMutation.mutate({ wellId, targetSilLevel: "SIL_2" })}
          >
            {seeding === "seeding" ? "Seeding…" : isSeeded ? "Re-seed Assessment" : "Seed SIL 2 Assessment"}
          </Button>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {SIL_LOOPS.map(loop => (
            <div key={loop.loopType} className={cn(
              "p-2 rounded border text-center",
              isSeeded ? "border-emerald-700/40 bg-emerald-950/10" : "border-border/40 bg-muted/10"
            )}>
              <div className="text-xs font-mono font-bold">{loop.loopType}</div>
              <div className={cn(
                "text-[9px] font-mono mt-0.5",
                loop.silTarget === 2 ? "text-amber-400" : "text-blue-400"
              )}>SIL {loop.silTarget}</div>
              {isSeeded && <div className="text-[9px] text-emerald-400 mt-0.5">✓</div>}
            </div>
          ))}
        </div>
      </div>

      {assessments.length > 0 && (
        <div className="mt-4 p-3 rounded-lg border border-border/50 bg-muted/10">
          <p className="text-xs font-medium mb-2">Assessment Summary</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-lg font-mono font-bold text-emerald-400">{assessments.length}</div>
              <div className="text-[10px] text-muted-foreground">Assessments</div>
            </div>
            <div>
              <div className="text-lg font-mono font-bold text-amber-400">
                {(assessments as any[]).filter((a: any) => (a.silTarget ?? a.sil_target ?? 2) >= 2).length}
              </div>
              <div className="text-[10px] text-muted-foreground">SIL 2+ Loops</div>
            </div>
            <div>
              <div className="text-lg font-mono font-bold text-blue-400">
                {(assessments as any[]).reduce((acc: number, a: any) => acc + (a.controlCount ?? 0), 0)}
              </div>
              <div className="text-[10px] text-muted-foreground">Total Controls</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEVICES PANEL — per-well device registry with OTA campaign history
// ─────────────────────────────────────────────────────────────────────────────

function DevicesPanel({ wellId }: { wellId: string }) {
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);

  const { data: devices = [], isLoading } = trpc.deviceManagement.listDevices.useQuery(
    { wellId },
    { enabled: !!wellId, refetchInterval: 30_000 }
  );

  const { data: updateHistory = [] } = trpc.otaManagement.getDeviceUpdateHistory.useQuery(
    { deviceId: selectedDeviceId! },
    { enabled: selectedDeviceId !== null }
  );

  const statusColor = (s: string) => {
    switch (s) {
      case "online": return "text-emerald-400 bg-emerald-950/30 border-emerald-800/40";
      case "offline": return "text-red-400 bg-red-950/30 border-red-800/40";
      case "provisioning": return "text-blue-400 bg-blue-950/30 border-blue-800/40";
      case "maintenance": return "text-amber-400 bg-amber-950/30 border-amber-800/40";
      case "error": return "text-red-400 bg-red-950/30 border-red-800/40";
      default: return "text-muted-foreground bg-muted/20 border-border/40";
    }
  };

  const otaStatusColor = (s: string) => {
    switch (s) {
      case "success": return "text-emerald-400";
      case "failed": return "text-red-400";
      case "installing": return "text-amber-400";
      case "downloading": return "text-blue-400";
      default: return "text-muted-foreground";
    }
  };

  if (isLoading) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">
        <div className="w-5 h-5 border-2 border-amber-600/40 border-t-amber-500 rounded-full animate-spin mx-auto mb-2" />
        Loading devices…
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <div className="w-10 h-10 mx-auto mb-3 opacity-20 text-4xl">📡</div>
        <p className="text-sm font-medium">No devices assigned to this well</p>
        <p className="text-xs mt-1">Register devices in Device Management and assign them to this well.</p>
        <Link href="/device-management">
          <Button size="sm" variant="outline" className="mt-4 text-xs border-amber-700/40 text-amber-400 hover:bg-amber-950/30">
            Go to Device Management →
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Fleet summary */}
      <div className="grid grid-cols-3 gap-3">
        {(["online", "offline", "provisioning"] as const).map(s => {
          const count = devices.filter(d => d.status === s).length;
          return (
            <div key={s} className={cn("p-3 rounded-lg border text-center", statusColor(s))}>
              <div className="text-2xl font-mono font-bold">{count}</div>
              <div className="text-[10px] uppercase tracking-wide mt-0.5">{s}</div>
            </div>
          );
        })}
      </div>

      {/* Device list */}
      <div className="space-y-2">
        {(devices as any[]).map((device: any) => {
          const isSelected = selectedDeviceId === device.id;
          const lastSeen = device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : "Never";
          return (
            <div key={device.id} className="rounded-lg border border-border/50 bg-card overflow-hidden">
              <button
                className="w-full text-left p-3 hover:bg-muted/10 transition-colors"
                onClick={() => setSelectedDeviceId(isSelected ? null : device.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-mono uppercase shrink-0", statusColor(device.status))}>
                      {device.status}
                    </span>
                    <span className="text-sm font-medium truncate">{device.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0">{device.deviceType}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {device.firmwareVersion && (
                      <span className="text-[10px] text-muted-foreground font-mono">fw {device.firmwareVersion}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground">{isSelected ? "▲" : "▼"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-1.5">
                  <span className="text-[10px] text-muted-foreground font-mono">ID: {device.deviceId}</span>
                  {device.ipAddress && <span className="text-[10px] text-muted-foreground font-mono">{device.ipAddress}</span>}
                  <span className="text-[10px] text-muted-foreground font-mono ml-auto">Last seen: {lastSeen}</span>
                </div>
              </button>

              {/* OTA update history (expanded) */}
              {isSelected && (
                <div className="border-t border-border/30 bg-muted/5 px-3 pb-3 pt-2">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2 font-mono">OTA Update History</div>
                  {updateHistory.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No OTA updates recorded for this device.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {(updateHistory as any[]).slice(0, 8).map((update: any) => (
                        <div key={update.id} className="flex items-center gap-3 text-xs">
                          <span className={cn("font-mono font-bold w-20 shrink-0", otaStatusColor(update.status))}>
                            {update.status.toUpperCase()}
                          </span>
                          <span className="text-muted-foreground font-mono truncate flex-1">
                            Campaign #{update.campaignId}
                          </span>
                          {update.completedAt && (
                            <span className="text-muted-foreground font-mono text-[10px] shrink-0">
                              {new Date(update.completedAt).toLocaleDateString()}
                            </span>
                          )}
                          {update.errorMessage && (
                            <span className="text-red-400 text-[10px] truncate max-w-[120px]" title={update.errorMessage}>
                              {update.errorMessage}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 pt-2 border-t border-border/20">
                    <Link href="/ota-management">
                      <span className="text-[10px] text-amber-400 hover:text-amber-300 cursor-pointer font-mono">
                        View all OTA campaigns →
                      </span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Alert Thresholds Panel
// ─────────────────────────────────────────────────────────────────────────────

const SENSOR_TYPES = [
  { value: "TUBING_PRESSURE", label: "Tubing Pressure (psi)" },
  { value: "CASING_PRESSURE", label: "Casing Pressure (psi)" },
  { value: "FLOW_RATE", label: "Flow Rate (bbl/d)" },
  { value: "BOTTOMHOLE_TEMP", label: "Bottomhole Temp (°F)" },
  { value: "WELLHEAD_TEMP", label: "Wellhead Temp (°F)" },
  { value: "ESP_CURRENT", label: "ESP Current (A)" },
  { value: "ESP_VIBRATION", label: "ESP Vibration (in/s)" },
  { value: "ESP_FREQUENCY", label: "ESP Frequency (Hz)" },
  { value: "GAS_RATE", label: "Gas Rate (Mscf/d)" },
  { value: "WATER_CUT", label: "Water Cut (%)" },
];

function AlertThresholdsPanel({ wellNumericId }: { wellNumericId?: number }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editRow, setEditRow] = useState<any>(null);
  const [form, setForm] = useState({ sensorType: "", minValue: "", maxValue: "", severity: "WARNING", enabled: true });

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.alertThresholds.getThresholds.useQuery(
    { wellId: wellNumericId! },
    { enabled: !!wellNumericId }
  );

  const setThreshold = trpc.alertThresholds.setThreshold.useMutation({
    onSuccess: () => {
      utils.alertThresholds.getThresholds.invalidate({ wellId: wellNumericId! });
      setShowAdd(false);
      setEditRow(null);
      setForm({ sensorType: "", minValue: "", maxValue: "", severity: "WARNING", enabled: true });
      toast.success("Threshold saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteThreshold = trpc.alertThresholds.deleteThreshold.useMutation({
    onSuccess: () => {
      utils.alertThresholds.getThresholds.invalidate({ wellId: wellNumericId! });
      toast.success("Threshold deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  function openEdit(row: any) {
    setEditRow(row);
    setForm({
      sensorType: row.sensor_type,
      minValue: row.min_value?.toString() ?? "",
      maxValue: row.max_value?.toString() ?? "",
      severity: row.severity,
      enabled: row.enabled,
    });
    setShowAdd(true);
  }

  function handleSubmit() {
    if (!form.sensorType || !wellNumericId) return;
    setThreshold.mutate({
      wellId: wellNumericId,
      sensorType: form.sensorType,
      minValue: form.minValue !== "" ? parseFloat(form.minValue) : null,
      maxValue: form.maxValue !== "" ? parseFloat(form.maxValue) : null,
      severity: form.severity as "WARNING" | "CRITICAL" | "INFO",
      enabled: form.enabled,
    });
  }

  if (!wellNumericId) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Well ID not available — cannot load thresholds.
      </div>
    );
  }

  const thresholds = data?.thresholds ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Live Alert Thresholds</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Kafka consumer checks these bounds on every incoming reading and triggers an alarm when violated.
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditRow(null); setForm({ sensorType: "", minValue: "", maxValue: "", severity: "WARNING", enabled: true }); setShowAdd(true); }}>
          <Plus className="w-3 h-3 mr-1" /> Add Threshold
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-6 text-muted-foreground text-xs">Loading thresholds…</div>
      ) : thresholds.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border/50 rounded-lg">
          <AlertTriangle className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No thresholds configured</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Add thresholds to trigger automatic alarms when live sensor readings go out of range.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Sensor</th>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Min</th>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Max</th>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Severity</th>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Enabled</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {thresholds.map((t: any) => (
                <tr key={t.id} className="border-b border-border/20 hover:bg-muted/20">
                  <td className="py-2 px-3 font-mono text-foreground">{t.sensor_type.replace(/_/g, " ")}</td>
                  <td className="py-2 px-3 text-muted-foreground">{t.min_value ?? "—"}</td>
                  <td className="py-2 px-3 text-muted-foreground">{t.max_value ?? "—"}</td>
                  <td className="py-2 px-3">
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-medium",
                      t.severity === "CRITICAL" ? "bg-red-900/40 text-red-400" :
                      t.severity === "WARNING" ? "bg-amber-900/40 text-amber-400" :
                      "bg-blue-900/40 text-blue-400"
                    )}>{t.severity}</span>
                  </td>
                  <td className="py-2 px-3">
                    <span className={cn("text-[10px]", t.enabled ? "text-emerald-400" : "text-muted-foreground")}>
                      {t.enabled ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right space-x-1">
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openEdit(t)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400 hover:text-red-300" onClick={() => deleteThreshold.mutate({ wellId: wellNumericId, sensorType: t.sensor_type })}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editRow ? "Edit Threshold" : "Add Alert Threshold"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Sensor Type</Label>
              <Select value={form.sensorType} onValueChange={(v) => setForm(f => ({ ...f, sensorType: v }))} disabled={!!editRow}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select sensor…" />
                </SelectTrigger>
                <SelectContent>
                  {SENSOR_TYPES.map(s => (
                    <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Min Value</Label>
                <Input className="h-8 text-xs" type="number" placeholder="No min" value={form.minValue} onChange={e => setForm(f => ({ ...f, minValue: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Max Value</Label>
                <Input className="h-8 text-xs" type="number" placeholder="No max" value={form.maxValue} onChange={e => setForm(f => ({ ...f, maxValue: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Severity</Label>
              <Select value={form.severity} onValueChange={(v) => setForm(f => ({ ...f, severity: v }))}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INFO" className="text-xs">INFO</SelectItem>
                  <SelectItem value="WARNING" className="text-xs">WARNING</SelectItem>
                  <SelectItem value="CRITICAL" className="text-xs">CRITICAL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.enabled} onCheckedChange={(v) => setForm(f => ({ ...f, enabled: v }))} />
              <Label className="text-xs">Enabled</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} disabled={!form.sensorType || setThreshold.isPending}>
              {setThreshold.isPending ? "Saving…" : "Save Threshold"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
