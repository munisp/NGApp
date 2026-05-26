import { useTranslation } from 'react-i18next';
/**
 * Analytics Page — Production analytics, decline curves, KPI benchmarks
 */

import { useState, useMemo } from "react";
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend, PieChart, Pie, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Bell, BellOff, Clock, TrendingDown, TrendingUp, Zap } from "lucide-react";

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 shadow-xl text-xs">
      <div className="text-muted-foreground mb-1 font-mono">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-mono font-bold text-foreground">{p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// Generate decline curve data
function generateDeclineCurve() {
  const historical = Array.from({ length: 24 }, (_, i) => ({
    month: `M-${24 - i}`,
    actual: Math.round(1800 * Math.exp(-0.012 * (24 - i)) + Math.sin(i * 1.7) * 40),
    type: "historical",
  }));
  const projected = Array.from({ length: 12 }, (_, i) => ({
    month: `M+${i + 1}`,
    p10: Math.round(1800 * Math.exp(-0.012 * (24 + i)) * 1.25),
    p50: Math.round(1800 * Math.exp(-0.012 * (24 + i))),
    p90: Math.round(1800 * Math.exp(-0.012 * (24 + i)) * 0.75),
    type: "projected",
  }));
  return { historical, projected };
}

// Benchmark data
const BENCHMARKS = [
  { kpi: "Uptime", ours: 96.4, avg: 94.1, top: 98.2, unit: "%" },
  { kpi: "MTBF", ours: 142, avg: 118, top: 165, unit: "days" },
  { kpi: "Prod. Eff.", ours: 94.2, avg: 91.5, top: 96.8, unit: "%" },
  { kpi: "Water Cut", ours: 37.7, avg: 42.1, top: 28.0, unit: "%" },
  { kpi: "Alarm Rate", ours: 0.8, avg: 1.4, top: 0.5, unit: "/well/day" },
];

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const [selectedWell, setSelectedWell] = useState("well-001");
  const { historical, projected } = generateDeclineCurve();

  // Live tRPC data
  const { data: wellsData } = trpc.wells.list.useQuery({ limit: 100 });
  const { data: prodSummary } = trpc.production.summary.useQuery();
  const { data: alarmStats } = trpc.wells.alarmStats.useQuery();
  const { data: productionTrend } = trpc.wells.productionTrend.useQuery({ days: 30 });

  const wellOptions = (wellsData?.wells ?? []).map((w: any) => ({ id: w.wellId, name: w.name }));
  // Use live production trend data, fallback to empty array for charts
  const productionData = (productionTrend ?? []).map((d: any) => ({
    date: d.date ?? d.day ?? new Date().toISOString().slice(0, 10),
    oil_bbls: d.oilBbls ?? d.oil_bbls ?? 0,
    water_bbls: d.waterBbls ?? d.water_bbls ?? 0,
    gas_mcf: d.gasMmscf ? d.gasMmscf * 1000 : d.gas_mcf ?? 0,
    uptime_hours: d.uptimeHours ?? d.uptime_hours ?? 24,
  }));

  const fieldData = [
    { field: "Permian", oil: 22_400, gas: 58.2, wells: 48 },
    { field: "Eagle Ford", oil: 12_800, gas: 28.4, wells: 31 },
    { field: "Bakken", oil: 8_600, gas: 18.1, wells: 24 },
    { field: "DJ Basin", oil: 2_100, gas: 12.6, wells: 18 },
    { field: "Marcellus", oil: 1_200, gas: 7.2, wells: 14 },
    { field: "Haynesville", oil: 1_220, gas: 0, wells: 7 },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold font-[Syne]">{t('analytics.title')}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Decline curve analysis · Field benchmarks · Production efficiency</p>
      </div>

      <Tabs defaultValue="production">
        <TabsList className="bg-muted/30 border border-border/50">
          <TabsTrigger value="production" className="text-xs">Production</TabsTrigger>
          <TabsTrigger value="decline" className="text-xs">Decline Curves</TabsTrigger>
          <TabsTrigger value="benchmarks" className="text-xs">Benchmarks</TabsTrigger>
          <TabsTrigger value="fields" className="text-xs">By Field</TabsTrigger>
          <TabsTrigger value="isa182" className="text-xs">ISA-18.2 Alarms</TabsTrigger>
        </TabsList>

        {/* Production */}
        <TabsContent value="production" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <Select value={selectedWell} onValueChange={setSelectedWell}>
              <SelectTrigger className="w-52 h-8 text-sm bg-card border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {wellOptions.map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-[Syne]">60-Day Oil & Water Production</CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={productionData.map(d => ({ ...d, date: d.date.slice(5) }))}>
                    <defs>
                      <linearGradient id="oilG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D97706" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#D97706" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="waterG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} interval={9} />
                    <YAxis tick={{ fontSize: 9, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="oil_bbls" stroke="#D97706" strokeWidth={2} fill="url(#oilG)" dot={false} name="Oil BBL" />
                    <Area type="monotone" dataKey="water_bbls" stroke="#06B6D4" strokeWidth={1.5} fill="url(#waterG)" dot={false} name="Water BBL" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-[Syne]">Gas Production & Uptime</CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={productionData.slice(-14).map(d => ({ ...d, date: d.date.slice(5), uptime: d.uptime_hours / 24 * 100 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" tick={{ fontSize: 9, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} domain={[80, 100]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar yAxisId="left" dataKey="gas_mcf" fill="#3B82F6" radius={[2, 2, 0, 0]} name="Gas MCF" />
                    <Line yAxisId="right" type="monotone" dataKey="uptime" stroke="#10B981" strokeWidth={2} dot={false} name="Uptime %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Decline Curves */}
        <TabsContent value="decline" className="mt-4">
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-[Syne]">Arps Decline Curve Analysis — Permian Basin #47</CardTitle>
                <div className="text-xs font-mono text-muted-foreground bg-muted/40 px-2 py-1 rounded">
                  Di = 14.4%/yr · EUR = 842K BBL
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine x="M+1" stroke="oklch(1 0 0 / 20%)" strokeDasharray="4 4" label={{ value: "Today", fill: "#6B7280", fontSize: 9 }} />
                  <Line data={historical} type="monotone" dataKey="actual" stroke="#D97706" strokeWidth={2} dot={false} name="Actual BPD" />
                  <Line data={projected} type="monotone" dataKey="p50" stroke="#10B981" strokeWidth={2} strokeDasharray="5 3" dot={false} name="P50 Forecast" />
                  <Line data={projected} type="monotone" dataKey="p10" stroke="#6B7280" strokeWidth={1} strokeDasharray="3 3" dot={false} name="P10 (Optimistic)" />
                  <Line data={projected} type="monotone" dataKey="p90" stroke="#6B7280" strokeWidth={1} strokeDasharray="3 3" dot={false} name="P90 (Conservative)" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Benchmarks */}
        <TabsContent value="benchmarks" className="mt-4">
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-[Syne]">Industry Benchmark Comparison</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              {BENCHMARKS.map(({ kpi, ours, avg, top, unit }) => {
                const maxVal = Math.max(ours, avg, top) * 1.1;
                const isLowerBetter = kpi === "Water Cut" || kpi === "Alarm Rate";
                const ourStatus = isLowerBetter ? (ours <= top ? "top" : ours <= avg ? "avg" : "below") : (ours >= top ? "top" : ours >= avg ? "avg" : "below");
                return (
                  <div key={kpi}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-foreground">{kpi}</div>
                      <div className={cn("text-xs font-mono font-bold",
                        ourStatus === "top" ? "text-emerald-400" : ourStatus === "avg" ? "text-amber-400" : "text-red-400"
                      )}>
                        {ours} {unit}
                        <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                          {ourStatus === "top" ? "▲ Top Quartile" : ourStatus === "avg" ? "→ Above Average" : "▼ Below Average"}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {[
                        { label: "Ours", value: ours, color: ourStatus === "top" ? "bg-emerald-500" : ourStatus === "avg" ? "bg-amber-500" : "bg-red-500" },
                        { label: "Industry Avg", value: avg, color: "bg-zinc-500" },
                        { label: "Top Quartile", value: top, color: "bg-blue-500" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="flex items-center gap-3">
                          <div className="w-20 text-[10px] text-muted-foreground text-right">{label}</div>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full", color)} style={{ width: `${(value / maxVal) * 100}%` }} />
                          </div>
                          <div className="w-16 text-[10px] font-mono text-muted-foreground">{value} {unit}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Field */}
        <TabsContent value="fields" className="mt-4">
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-[Syne]">Production by Field / Basin</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={fieldData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
                  <YAxis dataKey="field" type="category" tick={{ fontSize: 10, fill: "#9CA3AF", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} width={70} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="oil" fill="#D97706" radius={[0, 3, 3, 0]} name="Oil BPD" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        {/* ── ISA-18.2 Alarm Performance Tab ─────────────────────────────── */}
        <TabsContent value="isa182" className="mt-4 space-y-4">
          <AlarmPerformanceDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── ISA-18.2 Alarm Performance Dashboard ─────────────────────────────────────

// ISA-18.2 static fallback data (used only when DB is empty)
const ISA_DAILY_FALLBACK = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(2026, 1, 12 - 29 + i);
  const label = `${d.getMonth() + 1}/${d.getDate()}`;
  const base = 0.8 + Math.sin(i * 0.4) * 0.3;
  return { date: label, alarmRate: +(base * 0.9).toFixed(2), standing: 2 + (i % 3), chattering: i % 2, floods: 0, suppressed: 1 + (i % 4), isa_limit: 1.0 };
});

function AlarmPerformanceDashboard() {
  const [period, setPeriod] = useState("30d");
  const days = period === "7d" ? 7 : period === "14d" ? 14 : 30;
  const { data: isaDaily } = trpc.alarms.isaDaily.useQuery({ days });
  const { data: priorityDist } = trpc.alarms.priorityDist.useQuery();
  const { data: chatteringAlarms } = trpc.alarms.chatteringList.useQuery();
  const { data: alarmStats } = trpc.alarms.stats.useQuery();

  const data = (isaDaily && isaDaily.length > 0) ? isaDaily : ISA_DAILY_FALLBACK.slice(-days);
  const alarmPriorityDist = (priorityDist && priorityDist.some(p => p.value > 0)) ? priorityDist : [
    { name: "Critical", value: 12, color: "#ef4444" },
    { name: "High",     value: 28, color: "#f97316" },
    { name: "Medium",   value: 45, color: "#eab308" },
    { name: "Low",      value: 15, color: "#6b7280" },
  ];
  const chatteringList = (chatteringAlarms && chatteringAlarms.length > 0) ? chatteringAlarms : [
    { tag: "PT-1042", description: "Tubing Pressure High", wellId: "Permian Basin #47", count: 47, last24h: 12 },
    { tag: "FT-0231", description: "Flow Rate Low",        wellId: "Eagle Ford #12",   count: 38, last24h: 9  },
    { tag: "VT-0089", description: "ESP Vibration High",   wellId: "Permian Basin #47", count: 31, last24h: 8  },
  ];
  const standingCount = alarmStats?.standing ?? 3;
  const chatteringCount = alarmStats?.chattering ?? 5;
  const avgAlarmRate = data.length > 0 ? (data.reduce((s, d) => s + d.alarmRate, 0) / data.length).toFixed(2) : "0.82";
  const isaKpis = [
    { label: "Avg Alarm Rate",     value: avgAlarmRate, unit: "/well/hr", limit: "< 1.0", ok: Number(avgAlarmRate) < 1.0, icon: Bell },
    { label: "Standing Alarms",    value: String(standingCount), unit: "active", limit: "< 5", ok: standingCount < 5, icon: BellOff },
    { label: "Chattering Alarms",  value: String(chatteringCount), unit: "tags", limit: "< 3", ok: chatteringCount < 3, icon: Zap },
    { label: "Flood Events (30d)", value: String(data.filter(d => d.floods > 0).length), unit: "events", limit: "0", ok: data.filter(d => d.floods > 0).length === 0, icon: AlertTriangle },
    { label: "Suppressed Alarms",  value: String(data.reduce((s, d) => s + d.suppressed, 0)), unit: "active", limit: "< 10", ok: data.reduce((s, d) => s + d.suppressed, 0) < 10, icon: BellOff },
    { label: "Alarm Response Time",value: "4.2",  unit: "min avg",  limit: "< 5",   ok: true,  icon: Clock },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-[Syne] font-bold text-foreground">ISA-18.2 Alarm Performance</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Alarm management compliance metrics — standing alarms, chattering, and flood analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-24 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="14d">14 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {isaKpis.map(kpi => (
          <Card key={kpi.label} className={cn(
            "border",
            kpi.ok ? "border-border/50 bg-card" : "border-red-800/40 bg-red-950/5"
          )}>
            <CardContent className="p-3">
              <div className={cn("w-6 h-6 rounded-md flex items-center justify-center mb-2",
                kpi.ok ? "bg-emerald-950/40 text-emerald-400" : "bg-red-950/40 text-red-400"
              )}>
                <kpi.icon className="w-3.5 h-3.5" />
              </div>
              <div className={cn("text-lg font-mono font-bold", kpi.ok ? "text-foreground" : "text-red-400")}>
                {kpi.value}
                <span className="text-xs font-normal text-muted-foreground ml-1">{kpi.unit}</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{kpi.label}</div>
              <div className={cn("text-[9px] font-mono mt-1", kpi.ok ? "text-emerald-500" : "text-red-500")}>
                Limit: {kpi.limit} {kpi.ok ? "✓" : "✗"}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alarm rate trend + priority distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-[Syne]">Daily Alarm Rate (alarms/well/hr)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="alarmGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} interval={Math.floor(data.length / 6)} />
                <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} domain={[0, 2]} />
                <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "11px" }} />
                <ReferenceLine y={1.0} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "ISA limit", fill: "#ef4444", fontSize: 9 }} />
                <Area type="monotone" dataKey="alarmRate" stroke="#d97706" strokeWidth={2} fill="url(#alarmGrad)" name="Alarm Rate" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-[Syne]">Priority Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={alarmPriorityDist} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                  {alarmPriorityDist.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "11px" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1 mt-1">
              {alarmPriorityDist.map(d => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                    <span className="text-muted-foreground">{d.name}</span>
                  </div>
                  <span className="font-mono text-foreground">{d.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Standing + Chattering alarms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Standing alarms */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-[Syne] flex items-center gap-2">
              <BellOff className="w-4 h-4 text-amber-400" />
              Standing Alarms
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">{standingCount} active</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {standingCount === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">No standing alarms — system nominal</div>
              ) : (
                <div className="text-xs text-amber-400 text-center py-4">{standingCount} standing alarm{standingCount !== 1 ? 's' : ''} active — review in Alarms page</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Chattering alarms */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-[Syne] flex items-center gap-2">
              <Zap className="w-4 h-4 text-red-400" />
              Chattering Alarms (Top 5)
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">ISA violation</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {chatteringList.map((a: any) => (
                <div key={a.tag} className="flex items-center gap-3 p-2 rounded-lg bg-red-950/10 border border-red-800/20">
                  <div className="font-mono text-[10px] text-red-400 shrink-0 w-16">{a.tag}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-foreground">{a.description}</div>
                    <div className="text-[10px] text-muted-foreground">{a.wellId}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono font-bold text-red-400">{a.count}</div>
                    <div className="text-[9px] text-muted-foreground">total / {a.last24h} today</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Flood events + suppression chart */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-[Syne]">Alarm Floods &amp; Suppressions (30-day)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} interval={Math.floor(data.length / 6)} />
              <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} />
              <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "11px" }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="floods" name="Flood Events" fill="#ef4444" opacity={0.8} />
              <Bar dataKey="chattering" name="Chattering" fill="#f97316" opacity={0.8} />
              <Bar dataKey="suppressed" name="Suppressed" fill="#6b7280" opacity={0.6} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
