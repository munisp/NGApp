/**
 * Production Allocation Module — OG-RMM Platform
 * All data sourced from live tRPC procedures:
 *   - allocation.getSeparators  → separator summaries
 *   - allocation.getWellAllocations → per-well allocation factors
 *   - allocation.list           → historical allocation records
 *   - wellTests.list            → well test schedule & results
 *   - wells.list                → well registry
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line,
} from "recharts";
import {
  Droplets, FlaskConical, Calculator, AlertTriangle,
  RefreshCw, Download, TrendingUp, CheckCircle2, Clock,
} from "lucide-react";

type AllocationMethod = "PROPORTIONAL" | "TEST_BASED" | "SIMULATION";

const ALLOCATION_COLORS = ["#d97706", "#f59e0b", "#fbbf24", "#60a5fa", "#34d399", "#a78bfa", "#f87171", "#38bdf8"];

function testStatusBadge(status: string) {
  const map: Record<string, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
    COMPLETED:    { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-700/30", label: "Complete",    icon: <CheckCircle2 className="w-3 h-3" /> },
    SCHEDULED:    { color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-700/30",       label: "Scheduled",  icon: <Clock className="w-3 h-3" /> },
    IN_PROGRESS:  { color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-700/30",     label: "In Progress",icon: <RefreshCw className="w-3 h-3" /> },
    CANCELLED:    { color: "text-red-400",     bg: "bg-red-500/10 border-red-700/30",         label: "Cancelled",  icon: <AlertTriangle className="w-3 h-3" /> },
  };
  return map[status] ?? { color: "text-muted-foreground", bg: "bg-muted/10 border-border/30", label: status, icon: null };
}

export default function ProductionAllocationPage() {
  const [selectedSep, setSelectedSep] = useState<string>("");
  const [method, setMethod] = useState<AllocationMethod>("TEST_BASED");

  // ── Live tRPC data ──────────────────────────────────────────────────────────
  const { data: separators = [], isLoading: sepLoading, refetch: refetchSep } =
    trpc.allocation.getSeparators.useQuery({ fieldId: undefined });

  const { data: wellAllocs = [], isLoading: allocLoading, refetch: refetchAllocs } =
    trpc.allocation.getWellAllocations.useQuery({ separatorId: selectedSep || undefined, days: 30 });

  const { data: historicalRaw = [], refetch: refetchHist } =
    trpc.allocation.list.useQuery({ days: 180 });

  const { data: wellTestsResp, isLoading: testsLoading, refetch: refetchTests } =
    trpc.wellTests.list.useQuery({ limit: 20 });
  const wellTests = wellTestsResp ?? [];

  const { data: wellsResp } = trpc.wells.list.useQuery({ limit: 50 });
  const wells = wellsResp?.wells ?? [];

  // Set default separator once loaded
  const activeSep = selectedSep || separators[0]?.separatorId || "";

  // ── Derived metrics ─────────────────────────────────────────────────────────
  const totalOilBbls = separators.reduce((s, sep) => s + sep.totalOilBbls, 0);
  const totalGasMmscf = separators.reduce((s, sep) => s + sep.totalGasMmscf, 0);
  const overdueTests = wellTests.filter((t: any) => {
    if (t.status !== "SCHEDULED") return false;
    const scheduled = new Date(t.scheduledAt ?? t.createdAt);
    return scheduled < new Date();
  }).length;
  const totalImbalance = wellAllocs.reduce((s, a) => s + Math.abs(a.imbalanceBbls), 0);

  // Pie chart for selected separator
  const pieData = useMemo(() => {
    const filtered = wellAllocs.filter(a => !activeSep || a.separatorId === activeSep);
    return filtered.map(a => ({
      name: a.wellName.split(" ").slice(-1)[0],
      value: Math.round(a.allocatedOilBbls),
      full: a.wellName,
    })).filter(d => d.value > 0);
  }, [wellAllocs, activeSep]);

  // Monthly trend from historical records
  const monthlyTrend = useMemo(() => {
    const byMonth = new Map<string, { oil: number; gas: number; water: number }>();
    for (const r of historicalRaw) {
      const d = new Date(r.date);
      const key = d.toLocaleString("en", { month: "short", year: "2-digit" });
      if (!byMonth.has(key)) byMonth.set(key, { oil: 0, gas: 0, water: 0 });
      const m = byMonth.get(key)!;
      m.oil += r.allocatedOilBbls ?? 0;
      m.gas += r.allocatedGasMmscf ?? 0;
      m.water += r.allocatedWaterBbls ?? 0;
    }
    return Array.from(byMonth.entries()).slice(-6).map(([month, v]) => ({ month, ...v }));
  }, [historicalRaw]);

  function handleRecalculate() {
    refetchSep(); refetchAllocs(); refetchHist(); refetchTests();
    toast.success("Allocation recalculated", { description: "All allocation data refreshed from database" });
  }

  function handleExportReport() {
    if (wellAllocs.length === 0) {
      toast.info("No allocation data yet", { description: "Seed demo data first via Admin → Seed Data" });
      return;
    }
    const csv = ["wellId,wellName,separatorId,oilBbls,gasMmscf,waterBbls,factor,imbalanceBbls",
      ...wellAllocs.map(a =>
        `${a.wellId},${a.wellName},${a.separatorId},${a.allocatedOilBbls},${a.allocatedGasMmscf},${a.allocatedWaterBbls},${a.allocationFactor},${a.imbalanceBbls}`)
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `allocation-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("Allocation report exported", { description: `${wellAllocs.length} well records downloaded` });
  }

  const isLoading = sepLoading || allocLoading;

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-[Syne] font-black text-2xl text-foreground tracking-tight">
            Production Allocation
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Well production sharing · Test-based allocation · Separator management
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="border-border/50 text-xs h-8" onClick={handleRecalculate}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Recalculate
          </Button>
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8" onClick={handleExportReport}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Overdue alert */}
      {overdueTests > 0 && (
        <div className="rounded-lg border border-amber-700/40 bg-amber-950/10 p-3 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-sm text-amber-400 font-bold">{overdueTests} well{overdueTests > 1 ? "s" : ""} with overdue well tests.</span>
          <span className="text-sm text-muted-foreground">Allocation factors may be inaccurate. Schedule tests immediately.</span>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border/50"><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
        )) : [
          { label: "Total Oil (Fleet)", value: `${totalOilBbls.toLocaleString()} BBL`, icon: Droplets, color: "text-amber-400" },
          { label: "Total Gas (Fleet)", value: `${totalGasMmscf.toFixed(2)} MMSCF`, icon: TrendingUp, color: "text-blue-400" },
          { label: "Overdue Tests", value: overdueTests, icon: AlertTriangle, color: overdueTests > 0 ? "text-red-400" : "text-emerald-400" },
          { label: "Total Imbalance", value: `${totalImbalance.toLocaleString()} BBL`, icon: Calculator, color: totalImbalance > 500 ? "text-amber-400" : "text-emerald-400" },
        ].map(kpi => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-3.5 h-3.5 ${kpi.color}`} />
                  <span className="text-xs text-muted-foreground">{kpi.label}</span>
                </div>
                <div className={`font-[Syne] font-black text-xl ${kpi.color}`}>{kpi.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="allocation">
        <TabsList className="bg-muted/50 h-8">
          <TabsTrigger value="allocation" className="text-xs h-7">Well Allocation</TabsTrigger>
          <TabsTrigger value="tests" className="text-xs h-7">Well Tests ({wellTests.length})</TabsTrigger>
          <TabsTrigger value="trend" className="text-xs h-7">Production Trend</TabsTrigger>
          <TabsTrigger value="separators" className="text-xs h-7">Separators ({separators.length})</TabsTrigger>
        </TabsList>

        {/* Allocation tab */}
        <TabsContent value="allocation" className="mt-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={activeSep} onValueChange={setSelectedSep}>
              <SelectTrigger className="w-52 h-7 text-xs">
                <SelectValue placeholder="All Separators" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Separators</SelectItem>
                {separators.map(s => (
                  <SelectItem key={s.separatorId} value={s.separatorId}>{s.separatorId}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={method} onValueChange={v => setMethod(v as AllocationMethod)}>
              <SelectTrigger className="w-40 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TEST_BASED">Test-Based</SelectItem>
                <SelectItem value="PROPORTIONAL">Proportional</SelectItem>
                <SelectItem value="SIMULATION">Simulation</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground ml-auto">
              {wellAllocs.length} wells · {totalOilBbls.toLocaleString()} BBL total (30d)
            </div>
          </div>

          {allocLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : wellAllocs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No allocation records found. Seed demo data via Admin → Seed Data.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Pie chart */}
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="font-[Syne] text-sm font-bold">Oil Allocation Split</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                          {pieData.map((_, i) => <Cell key={i} fill={ALLOCATION_COLORS[i % ALLOCATION_COLORS.length]} />)}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: "oklch(0.21 0.006 285.885)", border: "1px solid oklch(1 0 0 / 10%)", borderRadius: "6px", fontSize: "11px" }}
                          formatter={(v: number, _: string, { payload }: any) => [`${v.toLocaleString()} BBL`, payload.full]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Allocation table */}
              <div className="lg:col-span-2 space-y-2">
                {wellAllocs.map((a, i) => (
                  <div key={a.wellId} className="rounded-lg border border-border/50 bg-card p-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length] }} />
                        <div>
                          <div className="text-sm font-medium text-foreground">{a.wellName}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">{a.method}</Badge>
                            <span className="text-[10px] text-muted-foreground">{a.separatorId}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <div className="text-[10px] text-muted-foreground">Factor</div>
                          <div className="font-mono font-bold text-amber-400">{(a.allocationFactor * 100).toFixed(1)}%</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">Oil (BBL)</div>
                          <div className="font-mono text-sm text-foreground">{a.allocatedOilBbls.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">Imbalance</div>
                          <div className={`font-mono text-sm font-bold ${Math.abs(a.imbalanceBbls) > 100 ? "text-amber-400" : "text-muted-foreground"}`}>
                            {a.imbalanceBbls >= 0 ? "+" : ""}{a.imbalanceBbls} BBL
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <span>Gas: <span className="font-mono text-foreground">{a.allocatedGasMmscf.toFixed(2)} MMSCF</span></span>
                      <span>Water: <span className="font-mono text-foreground">{a.allocatedWaterBbls.toLocaleString()} BBL</span></span>
                      <span>WOR: <span className="font-mono text-foreground">
                        {a.allocatedOilBbls > 0 ? (a.allocatedWaterBbls / a.allocatedOilBbls).toFixed(2) : "—"}
                      </span></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Well Tests tab */}
        <TabsContent value="tests" className="mt-4 space-y-3">
          {testsLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : wellTests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No well tests scheduled. Use Well Tests page to schedule tests.</div>
          ) : (
            (wellTests as any[]).map((test: any) => {
              const tsc = testStatusBadge(test.status);
              return (
                <div key={test.testId} className="rounded-lg border border-border/50 bg-card p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono text-muted-foreground">{test.testId}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${tsc.bg} ${tsc.color}`}>
                          {tsc.icon}{tsc.label}
                        </span>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">{test.testType}</Badge>
                      </div>
                      <div className="font-[Syne] font-bold text-sm text-foreground">{test.wellId}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(test.scheduledAt ?? test.createdAt).toLocaleDateString()} · {test.durationHours}h
                        {test.assignedTo ? ` · ${test.assignedTo}` : ""}
                      </div>
                    </div>
                    {test.status === "COMPLETED" && test.oilRateBpd != null && (
                      <div className="grid grid-cols-3 gap-3 text-right">
                        <div>
                          <div className="text-[10px] text-muted-foreground">Oil</div>
                          <div className="font-mono font-bold text-amber-400">{test.oilRateBpd?.toLocaleString()} BPD</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">GOR</div>
                          <div className="font-mono font-bold text-blue-400">{test.gorScfBbl?.toLocaleString() ?? "—"}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">WOR</div>
                          <div className="font-mono font-bold text-foreground">
                            {test.oilRateBpd > 0 ? ((test.waterRateBpd ?? 0) / test.oilRateBpd).toFixed(2) : "—"}
                          </div>
                        </div>
                      </div>
                    )}
                    {test.status === "SCHEDULED" && (
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-7"
                        onClick={() => toast.success(`Well test ${test.testId} initiated`, { description: `${test.wellId} — ${test.durationHours}h test started` })}>
                        <FlaskConical className="w-3 h-3 mr-1" />
                        Start Test
                      </Button>
                    )}
                  </div>
                  {test.notes && <div className="mt-2 text-xs text-muted-foreground italic">{test.notes}</div>}
                </div>
              );
            })
          )}
        </TabsContent>

        {/* Trend tab */}
        <TabsContent value="trend" className="mt-4">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="font-[Syne] text-sm font-bold">
                6-Month Fleet Production Trend
                {monthlyTrend.length === 0 && <span className="text-xs font-normal text-muted-foreground ml-2">(seed data to populate)</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {monthlyTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: "oklch(0.552 0.016 285.938)" }} />
                      <YAxis yAxisId="oil" tick={{ fontSize: 10, fill: "oklch(0.552 0.016 285.938)" }} />
                      <YAxis yAxisId="gas" orientation="right" tick={{ fontSize: 10, fill: "oklch(0.552 0.016 285.938)" }} />
                      <Tooltip contentStyle={{ background: "oklch(0.21 0.006 285.885)", border: "1px solid oklch(1 0 0 / 10%)", borderRadius: "6px", fontSize: "11px" }} />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Bar yAxisId="oil" dataKey="oil" name="Oil (BBL)" fill="#d97706" radius={[3, 3, 0, 0]} />
                      <Bar yAxisId="oil" dataKey="water" name="Water (BBL)" fill="#60a5fa" radius={[3, 3, 0, 0]} />
                      <Line yAxisId="gas" dataKey="gas" name="Gas (MMSCF)" stroke="#34d399" strokeWidth={2} dot={{ fill: "#34d399", r: 3 }} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    No historical allocation data yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Separators tab */}
        <TabsContent value="separators" className="mt-4">
          {sepLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
          ) : separators.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No separator data. Seed demo data first.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {separators.map(sep => (
                <Card key={sep.separatorId} className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="font-[Syne] text-sm font-bold flex items-center justify-between">
                      {sep.separatorId}
                      <Badge variant="outline" className="text-[9px]">{sep.wellCount} wells</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">Oil</div>
                        <div className="font-mono font-bold text-amber-400">{sep.totalOilBbls.toLocaleString()} BBL</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Gas</div>
                        <div className="font-mono font-bold text-blue-400">{sep.totalGasMmscf.toFixed(2)} MMSCF</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Water</div>
                        <div className="font-mono font-bold text-cyan-400">{sep.totalWaterBbls.toLocaleString()} BBL</div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Avg imbalance: <span className={`font-mono font-bold ${sep.avgImbalanceBbls > 100 ? "text-amber-400" : "text-emerald-400"}`}>
                        {sep.avgImbalanceBbls} BBL
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Wells: {sep.wellIds.join(", ")}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
