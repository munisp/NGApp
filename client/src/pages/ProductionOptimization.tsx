/**
 * ProductionOptimization.tsx
 * Arps decline curve analysis, EUR forecasting, and IPR/VLP setpoint advisor.
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell,
} from "recharts";
import { toast } from "sonner";
import { TrendingDown, Zap, BarChart3, Target, RefreshCw, Plus, Trash2, Activity, Download, Cpu } from "lucide-react";

// ── Rust Physics Engine: Nodal Analysis Panel ─────────────────────────────────
function RustNodalPanel() {
  const wellsQuery = trpc.wells.list.useQuery({ limit: 200 });
  const wellsList = wellsQuery.data && 'wells' in wellsQuery.data ? (wellsQuery.data as any).wells : [];
  const [wellId, setWellId] = useState("");
  const [resPressure, setResPressure] = useState(3200);
  const [pi, setPi] = useState(2.5);
  const [tubingId, setTubingId] = useState(2.441);
  const [wellDepth, setWellDepth] = useState(8500);
  const [whPressure, setWhPressure] = useState(200);
  const [gor, setGor] = useState(500);
  const [waterCut, setWaterCut] = useState(0.2);
  const nodalMutation = trpc.physicsEngine.nodal.useMutation({
    onError: (e) => toast.error(`Rust engine error: ${e.message}`),
  });
  const result = nodalMutation.data as any;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Cpu className="w-5 h-5 text-orange-400" />
        <span className="text-white font-semibold">Rust Physics Engine — IPR/VLP Nodal Analysis</span>
        <Badge variant="outline" className="bg-orange-500/20 text-orange-300 border-orange-500/40 text-xs">:4001 live</Badge>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <Label className="text-slate-300 text-xs">Well</Label>
          <select value={wellId} onChange={e => setWellId(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-md px-2 py-1.5 text-sm mt-1">
            <option value="">Select well...</option>
            {wellsList.map((w: any) => <option key={w.wellId} value={w.wellId}>{w.name}</option>)}
          </select>
        </div>
        <div><Label className="text-slate-300 text-xs">Reservoir Pressure (psia)</Label>
          <Input type="number" value={resPressure} onChange={e => setResPressure(+e.target.value)} className="bg-slate-700 border-slate-600 text-white mt-1" /></div>
        <div><Label className="text-slate-300 text-xs">PI (BPD/psi)</Label>
          <Input type="number" step="0.1" value={pi} onChange={e => setPi(+e.target.value)} className="bg-slate-700 border-slate-600 text-white mt-1" /></div>
        <div><Label className="text-slate-300 text-xs">Tubing ID (in)</Label>
          <Input type="number" step="0.001" value={tubingId} onChange={e => setTubingId(+e.target.value)} className="bg-slate-700 border-slate-600 text-white mt-1" /></div>
        <div><Label className="text-slate-300 text-xs">Well Depth (ft)</Label>
          <Input type="number" value={wellDepth} onChange={e => setWellDepth(+e.target.value)} className="bg-slate-700 border-slate-600 text-white mt-1" /></div>
        <div><Label className="text-slate-300 text-xs">WH Pressure (psia)</Label>
          <Input type="number" value={whPressure} onChange={e => setWhPressure(+e.target.value)} className="bg-slate-700 border-slate-600 text-white mt-1" /></div>
        <div><Label className="text-slate-300 text-xs">GOR (scf/bbl)</Label>
          <Input type="number" value={gor} onChange={e => setGor(+e.target.value)} className="bg-slate-700 border-slate-600 text-white mt-1" /></div>
        <div><Label className="text-slate-300 text-xs">Water Cut (0-1)</Label>
          <Input type="number" step="0.01" min="0" max="1" value={waterCut} onChange={e => setWaterCut(+e.target.value)} className="bg-slate-700 border-slate-600 text-white mt-1" /></div>
      </div>
      <Button onClick={() => nodalMutation.mutate({ wellId: wellId || "RUST-TEST", reservoirPressure: resPressure, qMax: resPressure * pi, wellheadPressure: whPressure, tvdFt: wellDepth, gorScfPerBbl: gor, waterCut: waterCut, fluidGradient: 0.433, skinFactor: 0, espFrequencyHz: 60, points: 60 })}
        disabled={nodalMutation.isPending} className="bg-orange-600 hover:bg-orange-700 text-white">
        {nodalMutation.isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Computing...</> : <><Cpu className="w-4 h-4 mr-2" />Run Rust Nodal Analysis</>}
      </Button>
      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {label: "Operating Rate", value: `${result.operating_rate_bpd?.toFixed(0) ?? "—"} BPD`, color: "cyan"},
              {label: "BHFP", value: `${result.operating_bhfp_psia?.toFixed(0) ?? "—"} psia`, color: "blue"},
              {label: "Drawdown", value: `${result.drawdown_psi?.toFixed(0) ?? "—"} psi`, color: "purple"},
              {label: "Deliverability", value: result.deliverability_index ?? "—", color: result.deliverability_index === "HIGH" ? "green" : result.deliverability_index === "MEDIUM" ? "yellow" : "red"},
            ].map(item => (
              <Card key={item.label} className="bg-slate-800/60 border-slate-700">
                <CardContent className="pt-3 pb-3">
                  <p className="text-slate-400 text-xs">{item.label}</p>
                  <p className={`text-lg font-bold text-${item.color}-400`}>{item.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          {result.recommendation && (
            <div className="bg-slate-800/40 border border-orange-700/40 rounded p-3">
              <p className="text-orange-300 text-xs font-medium mb-1">Rust Engine Recommendation</p>
              <p className="text-white text-sm">{result.recommendation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type CurveType = "EXPONENTIAL" | "HYPERBOLIC" | "HARMONIC";

const CURVE_COLORS: Record<CurveType, string> = {
  EXPONENTIAL: "#f59e0b",
  HYPERBOLIC: "#3b82f6",
  HARMONIC: "#10b981",
};

const CURVE_LABELS: Record<CurveType, string> = {
  EXPONENTIAL: "Exponential (b=0)",
  HYPERBOLIC: "Hyperbolic (0<b<1)",
  HARMONIC: "Harmonic (b=1)",
};

// ─── Decline Curve Tab ────────────────────────────────────────────────────────

function DeclineCurveTab() {
  const { isAuthenticated } = useAuth();
  const [selectedWellId, setSelectedWellId] = useState("");
  const [curveType, setCurveType] = useState<CurveType>("EXPONENTIAL");
  const [economicLimit, setEconomicLimit] = useState(5);
  const [manualMode, setManualMode] = useState(false);
  const [manualQi, setManualQi] = useState(500);
  const [manualDi, setManualDi] = useState(0.3);
  const [manualB, setManualB] = useState(0.5);

  const wellsQuery = trpc.wells.list.useQuery({ limit: 200 });
  const curvesQuery = trpc.productionOptimization.listCurves.useQuery({ wellId: selectedWellId || undefined });

  const wellsList = (wellsQuery.data && 'wells' in wellsQuery.data ? wellsQuery.data.wells : []);

  const forecastQuery = trpc.productionOptimization.forecast.useQuery({
    qi: manualQi,
    di: manualDi,
    b: curveType === "EXPONENTIAL" ? 0 : curveType === "HARMONIC" ? 1 : manualB,
    economicLimit,
    curveType,
  }, { enabled: manualMode });

  const [lookbackDays, setLookbackDays] = useState(90);

  const fitMutation = trpc.productionOptimization.fitCurve.useMutation({
    onSuccess: (data) => {
      toast.success("Decline curve fitted", {
        description: `EUR: ${(data.eurBbls ?? 0).toLocaleString()} BBL | Life: ${data.remainingLifeYears?.toFixed(1)} yrs`,
      });
      curvesQuery.refetch();
    },
    onError: (err) => toast.error("Fit failed", { description: err.message }),
  });

  const fitFromHistoryMutation = trpc.productionOptimization.fitFromHistory.useMutation({
    onSuccess: (data) => {
      toast.success("Auto-fitted from production history", {
        description: data.message,
        duration: 8000,
      });
      // Pre-populate manual fields with fitted values
      setManualQi(Math.round(data.qi));
      setManualDi(Math.round(data.di * 1000) / 1000);
      setManualB(Math.round(data.b * 100) / 100);
      setCurveType(data.curveType as CurveType);
      curvesQuery.refetch();
    },
    onError: (err) => toast.error("Auto-fit failed", { description: err.message }),
  });

  const deleteMutation = trpc.productionOptimization.deleteCurve.useMutation({
    onSuccess: () => { toast.success("Curve deleted"); curvesQuery.refetch(); },
  });

  const wells = wellsList;
  const curves = curvesQuery.data ?? [];

  // Build chart data from latest curve or manual params
  const latestCurve = curves[0];
  const chartData = useMemo(() => {
    if (manualMode && forecastQuery.data) return forecastQuery.data.forecastPoints;
    if (!latestCurve) return [];
    // Reconstruct forecast from saved params
    const { qi, di, b, economicLimit: el } = latestCurve;
    const points: Array<{ year: number; rate: number; cumulative: number }> = [];
    const dt = 1 / 12;
    let t = 0, cum = 0;
    while (t <= 30) {
      let rate: number;
      const bVal = b ?? 0;
      if (bVal === 0) rate = qi * Math.exp(-di * t);
      else if (Math.abs(bVal - 1) < 1e-6) rate = qi / (1 + di * t);
      else rate = qi / Math.pow(1 + bVal * di * t, 1 / bVal);
      if (rate < (el ?? 5)) break;
      cum += rate * dt * 365;
      if (Math.abs(t * 12 - Math.round(t * 12)) < 0.01 && Math.round(t * 12) % 3 === 0) {
        points.push({ year: Math.round(t * 10) / 10, rate: Math.round(rate * 10) / 10, cumulative: Math.round(cum) });
      }
      t += dt;
    }
    return points;
  }, [latestCurve, manualMode, forecastQuery.data]);

  const displayEUR = manualMode ? forecastQuery.data?.eurBbls : latestCurve?.eurBbls;
  const displayLife = manualMode ? forecastQuery.data?.remainingLifeYears : latestCurve?.remainingLifeYears;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-amber-400" />
              Curve Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Well</Label>
              <Select value={selectedWellId} onValueChange={setSelectedWellId}>
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue placeholder="Select well..." />
                </SelectTrigger>
                <SelectContent>
                  {wells.map(w => (
                    <SelectItem key={w.wellId} value={w.wellId} className="text-xs">
                      {w.wellId} — {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Decline Type</Label>
              <Select value={curveType} onValueChange={v => setCurveType(v as CurveType)}>
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["EXPONENTIAL", "HYPERBOLIC", "HARMONIC"] as CurveType[]).map(t => (
                    <SelectItem key={t} value={t} className="text-xs">{CURVE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Economic Limit (BBL/day)</Label>
              <Input
                type="number"
                value={economicLimit}
                onChange={e => setEconomicLimit(Number(e.target.value))}
                className="h-8 text-xs mt-1"
                min={1}
                max={100}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="manualMode"
                checked={manualMode}
                onChange={e => setManualMode(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="manualMode" className="text-xs text-muted-foreground cursor-pointer">
                Manual parameter entry
              </Label>
            </div>
            {manualMode && (
              <div className="space-y-3 border border-border/40 rounded-md p-3">
                <div>
                  <Label className="text-xs text-muted-foreground">qi (BBL/day initial rate)</Label>
                  <Input type="number" value={manualQi} onChange={e => setManualQi(Number(e.target.value))} className="h-8 text-xs mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Di (annual decline rate)</Label>
                  <Input type="number" value={manualDi} onChange={e => setManualDi(Number(e.target.value))} step={0.01} className="h-8 text-xs mt-1" />
                </div>
                {curveType === "HYPERBOLIC" && (
                  <div>
                    <Label className="text-xs text-muted-foreground">b-factor (0–1)</Label>
                    <Input type="number" value={manualB} onChange={e => setManualB(Number(e.target.value))} step={0.1} min={0} max={1} className="h-8 text-xs mt-1" />
                  </div>
                )}
              </div>
            )}
            {/* Lookback period selector for auto-fit */}
            {!manualMode && (
              <div>
                <Label className="text-xs text-muted-foreground">Lookback Period</Label>
                <Select value={String(lookbackDays)} onValueChange={v => setLookbackDays(Number(v))}>
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30" className="text-xs">Last 30 days</SelectItem>
                    <SelectItem value="60" className="text-xs">Last 60 days</SelectItem>
                    <SelectItem value="90" className="text-xs">Last 90 days</SelectItem>
                    <SelectItem value="180" className="text-xs">Last 6 months</SelectItem>
                    <SelectItem value="365" className="text-xs">Last 12 months</SelectItem>
                    <SelectItem value="730" className="text-xs">Last 24 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-2">
              {isAuthenticated && !manualMode && (
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs bg-amber-600 hover:bg-amber-700"
                  disabled={!selectedWellId || fitFromHistoryMutation.isPending}
                  onClick={() => fitFromHistoryMutation.mutate({
                    wellId: selectedWellId,
                    curveType,
                    economicLimit,
                    lookbackDays,
                  })}
                >
                  {fitFromHistoryMutation.isPending ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Activity className="w-3 h-3 mr-1" />}
                  Fit from History
                </Button>
              )}
              {isAuthenticated && manualMode && selectedWellId && (
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs bg-blue-600 hover:bg-blue-700"
                  disabled={fitMutation.isPending}
                  onClick={() => fitMutation.mutate({
                    wellId: selectedWellId,
                    curveType,
                    economicLimit,
                    manualQi,
                    manualDi,
                    manualB: curveType === "HYPERBOLIC" ? manualB : undefined,
                  })}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Save Curve
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* EUR KPI boxes */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-3">
          {[
            { label: "Estimated Ultimate Recovery", value: displayEUR ? `${(displayEUR / 1000).toFixed(1)}K` : "—", unit: "BBL", color: "text-amber-400" },
            { label: "Remaining Producing Life", value: displayLife ? `${displayLife.toFixed(1)}` : "—", unit: "years", color: "text-blue-400" },
            { label: "Initial Rate (qi)", value: manualMode ? manualQi.toLocaleString() : (latestCurve?.qi?.toFixed(0) ?? "—"), unit: "BBL/day", color: "text-emerald-400" },
            { label: "Decline Rate (Di)", value: manualMode ? `${(manualDi * 100).toFixed(1)}%` : (latestCurve?.di ? `${(latestCurve.di * 100).toFixed(1)}%` : "—"), unit: "per year", color: "text-rose-400" },
          ].map(kpi => (
            <Card key={kpi.label} className="bg-card border-border/50">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.unit}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Decline Curve Chart */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            Production Rate Forecast
            {latestCurve && (
              <Badge variant="outline" className="ml-2 text-xs border-amber-700/40 text-amber-400">
                {CURVE_LABELS[latestCurve.curveType as CurveType]}
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs">Arps decline curve projection to economic limit</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="year" stroke="#64748b" fontSize={10} tickFormatter={v => `Y${v}`} />
                <YAxis yAxisId="rate" stroke="#64748b" fontSize={10} tickFormatter={v => `${v}`} />
                <YAxis yAxisId="cum" orientation="right" stroke="#64748b" fontSize={10} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                <Tooltip
                  contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 6, fontSize: 11 }}
                  formatter={(value: number, name: string) => [
                    name === "rate" ? `${value} BBL/day` : `${value.toLocaleString()} BBL`,
                    name === "rate" ? "Production Rate" : "Cumulative Production"
                  ]}
                  labelFormatter={v => `Year ${v}`}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine yAxisId="rate" y={economicLimit} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "Econ Limit", fill: "#ef4444", fontSize: 9 }} />
                <Line yAxisId="rate" type="monotone" dataKey="rate" stroke="#f59e0b" strokeWidth={2} dot={false} name="rate" />
                <Line yAxisId="cum" type="monotone" dataKey="cumulative" stroke="#3b82f6" strokeWidth={1.5} dot={false} strokeDasharray="4 4" name="cumulative" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
              {selectedWellId ? "No decline curve fitted yet — click \"Fit to History\" to generate." : "Select a well to view decline curve forecast."}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saved Curves Table */}
      {curves.length > 0 && (
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Saved Decline Curves</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40">
                    {["Well", "Type", "qi (BBL/d)", "Di (%/yr)", "b", "EUR (MBBL)", "Life (yrs)", "Fitted", ""].map(h => (
                      <th key={h} className="text-left py-2 px-2 text-muted-foreground font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {curves.map(c => (
                    <tr key={c.id} className="border-b border-border/20 hover:bg-muted/20">
                      <td className="py-2 px-2 font-mono text-amber-400">{c.wellId}</td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className="text-xs" style={{ borderColor: CURVE_COLORS[c.curveType as CurveType] + "60", color: CURVE_COLORS[c.curveType as CurveType] }}>
                          {c.curveType}
                        </Badge>
                      </td>
                      <td className="py-2 px-2">{c.qi.toFixed(0)}</td>
                      <td className="py-2 px-2">{(c.di * 100).toFixed(1)}%</td>
                      <td className="py-2 px-2">{(c.b ?? 0).toFixed(2)}</td>
                      <td className="py-2 px-2 text-emerald-400">{c.eurBbls ? `${(c.eurBbls / 1000).toFixed(1)}K` : "—"}</td>
                      <td className="py-2 px-2">{c.remainingLifeYears?.toFixed(1) ?? "—"}</td>
                      <td className="py-2 px-2 text-muted-foreground">{new Date(c.fittedAt).toLocaleDateString()}</td>
                      <td className="py-2 px-2">
                        {isAuthenticated && (
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-rose-400"
                            onClick={() => deleteMutation.mutate({ id: c.id })}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── EUR Summary Tab ──────────────────────────────────────────────────────────

function EURSummaryTab() {
  const summaryQuery = trpc.productionOptimization.eurSummary.useQuery();
  const summary = summaryQuery.data ?? [];

  const totalEUR = summary.reduce((s, r) => s + (r.eurBbls ?? 0), 0);
  const avgLife = summary.length > 0 ? summary.reduce((s, r) => s + (r.remainingLifeYears ?? 0), 0) / summary.length : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Portfolio EUR", value: `${(totalEUR / 1e6).toFixed(2)}M`, unit: "BBL", color: "text-amber-400" },
          { label: "Wells Analysed", value: summary.length.toString(), unit: "wells", color: "text-blue-400" },
          { label: "Avg Remaining Life", value: `${avgLife.toFixed(1)}`, unit: "years", color: "text-emerald-400" },
        ].map(kpi => (
          <Card key={kpi.label} className="bg-card border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.unit}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              EUR by Well
            </CardTitle>
            {summary.length > 0 && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                onClick={() => {
                  const headers = ["wellId","field","curveType","qi_bpd","di_pct_yr","b","eur_bbl","remaining_life_yrs","workover_flag"];
                  const rows = summary.map((r: any) => [
                    r.wellId, r.field ?? "", r.curveType,
                    r.qi.toFixed(2), (r.di * 100).toFixed(2), r.b?.toFixed(3) ?? "0",
                    Math.round(r.eurBbls ?? 0), (r.remainingLifeYears ?? 0).toFixed(2),
                    r.hasWorkoverFlag ? "1" : "0"
                  ]);
                  const csv = [headers.join(","), ...rows.map((r: any[]) => r.join(","))].join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = `portfolio-eur-${new Date().toISOString().slice(0,10)}.csv`;
                  a.click(); URL.revokeObjectURL(url);
                }}>
                <Download className="w-3 h-3" />
                Download CSV
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {summary.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={summary.sort((a, b) => (b.eurBbls ?? 0) - (a.eurBbls ?? 0)).slice(0, 20)} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="wellId" stroke="#64748b" fontSize={9} />
                  <YAxis stroke="#64748b" fontSize={10} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 6, fontSize: 11 }}
                    formatter={(v: number) => [`${v.toLocaleString()} BBL`, "EUR"]} />
                  <Line type="monotone" dataKey="eurBbls" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: "#f59e0b" }} />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/40">
                      {["Well", "Name", "Type", "qi", "Di", "EUR (BBL)", "Life (yrs)"].map(h => (
                        <th key={h} className="text-left py-2 px-2 text-muted-foreground font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summary.sort((a, b) => (b.eurBbls ?? 0) - (a.eurBbls ?? 0)).map(r => (
                      <tr key={r.wellId} className="border-b border-border/20 hover:bg-muted/20">
                        <td className="py-2 px-2 font-mono text-amber-400">{r.wellId}</td>
                        <td className="py-2 px-2 text-muted-foreground">{r.wellName}</td>
                        <td className="py-2 px-2">
                          <Badge variant="outline" className="text-xs" style={{ borderColor: CURVE_COLORS[r.curveType as CurveType] + "60", color: CURVE_COLORS[r.curveType as CurveType] }}>
                            {r.curveType}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">{r.qi.toFixed(0)} BBL/d</td>
                        <td className="py-2 px-2">{(r.di * 100).toFixed(1)}%/yr</td>
                        <td className="py-2 px-2 text-emerald-400 font-semibold">{(r.eurBbls ?? 0).toLocaleString()}</td>
                        <td className="py-2 px-2">{(r.remainingLifeYears ?? 0).toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
              No EUR data yet — fit decline curves in the Decline Curve tab first.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Setpoint Advisor Tab ─────────────────────────────────────────────────────

function SetpointAdvisorTab() {
  const [wellId, setWellId] = useState("");
  const [pr, setPr] = useState(3500);
  const [pb, setPb] = useState(2200);
  const [qmax, setQmax] = useState(800);

  const wellsQuery = trpc.wells.list.useQuery({ limit: 200 });
  const wells = (wellsQuery.data && 'wells' in wellsQuery.data ? wellsQuery.data.wells : []);

  const advisorQuery = trpc.productionOptimization.setpointAdvisor.useQuery(
    { wellId, reservoirPressure: pr, bubblePointPressure: pb, maxOilRate: qmax },
    { enabled: !!wellId }
  );

  const result = advisorQuery.data;

  // Combine IPR and VLP for chart
  const chartData = useMemo(() => {
    if (!result) return [];
    const iprMap = new Map(result.iprPoints.map(p => [p.rate, p.bhp]));
    const vlpMap = new Map(result.vlpPoints.map(p => [p.rate, p.bhp]));
    const allRates = Array.from(iprMap.keys()).concat(Array.from(vlpMap.keys()));
    const rates = Array.from(new Set(allRates)).sort((a, b) => a - b);
    return rates.map(rate => ({
      rate,
      ipr: iprMap.get(rate),
      vlp: vlpMap.get(rate),
    }));
  }, [result]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-400" />
              IPR/VLP Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Well</Label>
              <Select value={wellId} onValueChange={setWellId}>
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue placeholder="Select well..." />
                </SelectTrigger>
                <SelectContent>
                  {wells.map(w => (
                    <SelectItem key={w.wellId} value={w.wellId} className="text-xs">
                      {w.wellId} — {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Reservoir Pressure (psi): {pr}</Label>
              <Slider value={[pr]} onValueChange={([v]) => setPr(v)} min={500} max={8000} step={50} className="mt-2" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Bubble Point Pressure (psi): {pb}</Label>
              <Slider value={[pb]} onValueChange={([v]) => setPb(v)} min={200} max={6000} step={50} className="mt-2" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">AOF / Max Rate (BBL/day): {qmax}</Label>
              <Slider value={[qmax]} onValueChange={([v]) => setQmax(v)} min={50} max={5000} step={50} className="mt-2" />
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <div className="lg:col-span-2 space-y-3">
          {result ? (
            <>
              <Card className="bg-card border-border/50">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-3 font-semibold uppercase tracking-wide">Setpoint Recommendations</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Choke Position", value: result.recommendations.chokePosition, color: "text-amber-400" },
                      { label: "ESP Frequency", value: result.recommendations.espFrequency, color: "text-blue-400" },
                      { label: "Target BHP", value: result.recommendations.targetBhp, color: "text-emerald-400" },
                    ].map(r => (
                      <div key={r.label} className="text-center">
                        <p className={`text-xl font-bold ${r.color}`}>{r.value}</p>
                        <p className="text-xs text-muted-foreground mt-1">{r.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 p-3 bg-muted/20 rounded-md border border-border/30">
                    <p className="text-xs text-muted-foreground leading-relaxed">{result.recommendations.rationale}</p>
                  </div>
                </CardContent>
              </Card>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Optimal Rate", value: `${result.optimalRate.toLocaleString()}`, unit: "BBL/day", color: "text-amber-400" },
                  { label: "Absolute Open Flow", value: `${result.aof.toLocaleString()}`, unit: "BBL/day", color: "text-blue-400" },
                ].map(kpi => (
                  <Card key={kpi.label} className="bg-card border-border/50">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">{kpi.label}</p>
                      <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
                      <p className="text-xs text-muted-foreground">{kpi.unit}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <Card className="bg-card border-border/50 h-full">
              <CardContent className="p-6 flex items-center justify-center h-full">
                <p className="text-muted-foreground text-sm">Select a well and adjust parameters to see setpoint recommendations.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* IPR/VLP Chart */}
      {result && (
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-400" />
              IPR / VLP Intersection (Vogel Model)
            </CardTitle>
            <CardDescription className="text-xs">Inflow Performance Relationship vs Vertical Lift Performance</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="rate" stroke="#64748b" fontSize={10} tickFormatter={v => `${v}`} label={{ value: "Rate (BBL/day)", position: "insideBottom", offset: -2, fill: "#64748b", fontSize: 10 }} />
                <YAxis stroke="#64748b" fontSize={10} label={{ value: "BHP (psi)", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 6, fontSize: 11 }}
                  formatter={(v: number, name: string) => [`${v} psi`, name === "ipr" ? "IPR (Inflow)" : "VLP (Lift)"]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine x={result.optimalRate} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Optimal", fill: "#f59e0b", fontSize: 9 }} />
                <Line type="monotone" dataKey="ipr" stroke="#3b82f6" strokeWidth={2} dot={false} name="ipr" connectNulls />
                <Line type="monotone" dataKey="vlp" stroke="#10b981" strokeWidth={2} dot={false} name="vlp" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProductionOptimization() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-amber-400" />
            Production Optimization
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Well decline analysis · Production forecasting · Optimization recommendations
          </p>
        </div>
        <Badge variant="outline" className="border-amber-700/40 text-amber-400 text-xs">
          Reservoir Engineering
        </Badge>
      </div>

      <Tabs defaultValue="decline">
        <TabsList className="bg-muted/30 border border-border/40">
          <TabsTrigger value="decline" className="text-xs">
            <TrendingDown className="w-3 h-3 mr-1.5" />
            Decline Curves
          </TabsTrigger>
          <TabsTrigger value="eur" className="text-xs">
            <BarChart3 className="w-3 h-3 mr-1.5" />
            EUR Summary
          </TabsTrigger>
          <TabsTrigger value="setpoint" className="text-xs">
            <Target className="w-3 h-3 mr-1.5" />
            Setpoint Advisor
          </TabsTrigger>
          <TabsTrigger value="portfolio" className="text-xs">
            <Activity className="w-3 h-3 mr-1.5" />
            Portfolio EUR
          </TabsTrigger>
          <TabsTrigger value="rust" className="text-xs data-[state=active]:bg-orange-600 data-[state=active]:text-white flex items-center gap-1">
            <Cpu className="w-3 h-3" />
            Rust Nodal
          </TabsTrigger>
        </TabsList>

        <TabsContent value="decline" className="mt-4">
          <DeclineCurveTab />
        </TabsContent>
        <TabsContent value="eur" className="mt-4">
          <EURSummaryTab />
        </TabsContent>
        <TabsContent value="setpoint" className="mt-4">
          <SetpointAdvisorTab />
        </TabsContent>
        <TabsContent value="portfolio" className="mt-4">
          <PortfolioEURTab />
        </TabsContent>
        <TabsContent value="rust" className="mt-4">
          <RustNodalPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Portfolio EUR Comparison Tab ─────────────────────────────────────────────

function PortfolioEURTab() {
  const [lookbackDays, setLookbackDays] = useState(90);
  const [showWorkoversOnly, setShowWorkoversOnly] = useState(false);

  const { data: portfolio, isLoading, refetch, isFetching } = trpc.productionOptimization.portfolioEUR.useQuery(
    { lookbackDays, economicLimit: 5, limit: 30 },
    { staleTime: 60_000 }
  );

  const displayed = showWorkoversOnly
    ? (portfolio ?? []).filter(w => w.workoversRecommended)
    : (portfolio ?? []);

  const maxEUR = Math.max(...(displayed.map(w => w.eurBbls)), 1);

  const LOOKBACK_OPTIONS = [
    { label: "30 days", value: 30 },
    { label: "60 days", value: 60 },
    { label: "90 days", value: 90 },
    { label: "180 days", value: 180 },
    { label: "1 year", value: 365 },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-5 h-5 animate-spin text-amber-500 mr-2" />
        <span className="text-sm text-muted-foreground">Fitting decline curves for all active wells…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Lookback</Label>
          <Select value={String(lookbackDays)} onValueChange={v => setLookbackDays(Number(v))}>
            <SelectTrigger className="w-28 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOOKBACK_OPTIONS.map(o => (
                <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => setShowWorkoversOnly(v => !v)}
        >
          {showWorkoversOnly ? "Show All Wells" : "Workover Candidates Only"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={!portfolio || portfolio.length === 0}
          onClick={() => {
            if (!portfolio || portfolio.length === 0) return;
            const rows = [
              ["Well ID", "Well Name", "Field", "EUR (BBL)", "EUR (MMBBL)", "Decline Rate (Di)", "b-Factor", "Remaining Life (yr)", "Workover Candidate"].join(","),
              ...portfolio.map(w => [
                w.wellId,
                `"${w.wellName.replace(/"/g, '""')}"`,
                `"${(w.field ?? "").replace(/"/g, '""')}"`,
                w.eurBbls.toFixed(0),
                (w.eurBbls / 1e6).toFixed(4),
                w.di.toFixed(4),
                (w.di > 0 ? 0.5 : 0).toFixed(3), // b-factor (default 0.5 for hyperbolic)
                w.remainingLifeYears.toFixed(2),
                w.workoversRecommended ? "Yes" : "No",
              ].join(",")),
            ].join("\n");
            const blob = new Blob([rows], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `portfolio-eur-${lookbackDays}d-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success(`Exported ${portfolio.length} wells to CSV`);
          }}
        >
          <Download className="w-3 h-3 mr-1" />
          Download CSV
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs ml-auto"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
          Refresh
        </Button>
      </div>

      {/* Summary KPIs */}
      {portfolio && portfolio.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Wells Analysed",
              value: portfolio.length,
              unit: "",
              color: "text-amber-400",
            },
            {
              label: "Total Portfolio EUR",
              value: `${(portfolio.reduce((s, w) => s + w.eurBbls, 0) / 1e6).toFixed(1)}M`,
              unit: "BBL",
              color: "text-emerald-400",
            },
            {
              label: "Workover Candidates",
              value: portfolio.filter(w => w.workoversRecommended).length,
              unit: "wells",
              color: "text-rose-400",
            },
            {
              label: "Avg Remaining Life",
              value: (portfolio.reduce((s, w) => s + w.remainingLifeYears, 0) / portfolio.length).toFixed(1),
              unit: "years",
              color: "text-blue-400",
            },
          ].map(kpi => (
            <Card key={kpi.label} className="border-border/50 bg-card/60">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className={`text-lg font-bold font-mono mt-0.5 ${kpi.color}`}>
                  {kpi.value} <span className="text-xs font-normal text-muted-foreground">{kpi.unit}</span>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Horizontal bar chart */}
      {displayed.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {showWorkoversOnly
                ? "No workover candidates found in the selected period."
                : "No wells with sufficient production history found."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="font-[Syne] text-sm font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-500" />
              EUR Ranking — {displayed.length} Wells
              <span className="text-xs font-normal text-muted-foreground ml-1">
                ({lookbackDays}d lookback, exponential decline)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pb-4">
            {displayed.slice(0, 20).map((well, idx) => {
              const pct = (well.eurBbls / maxEUR) * 100;
              return (
                <div key={well.wellId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-muted-foreground w-5 text-right shrink-0">{idx + 1}</span>
                      <span className="font-medium truncate max-w-[140px]">{well.wellName}</span>
                      <span className="text-muted-foreground shrink-0">{well.field}</span>
                      {well.workoversRecommended && (
                        <Badge className="bg-rose-600/20 text-rose-400 border-rose-600/30 text-[10px] px-1 py-0 shrink-0">
                          Workover
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <span className="text-muted-foreground">
                        {well.remainingLifeYears.toFixed(1)} yr
                      </span>
                      <span className="font-mono font-bold text-amber-400 w-20 text-right">
                        {well.eurBbls >= 1e6
                          ? `${(well.eurBbls / 1e6).toFixed(2)}M`
                          : `${(well.eurBbls / 1e3).toFixed(0)}K`} BBL
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        well.workoversRecommended
                          ? "bg-rose-500/70"
                          : idx < 3
                          ? "bg-amber-500"
                          : "bg-amber-500/60"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {displayed.length > 20 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                Showing top 20 of {displayed.length} wells
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recharts bar chart for top 10 */}
      {displayed.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="font-[Syne] text-sm font-bold">Top 10 Wells — EUR Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={displayed.slice(0, 10)} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  type="number"
                  tickFormatter={v => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1e3).toFixed(0)}K`}
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                />
                <YAxis
                  type="category"
                  dataKey="wellName"
                  width={90}
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                />
                <Tooltip
                  contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6 }}
                  formatter={(v: number) => [`${v.toLocaleString()} BBL`, "EUR"]}
                />
                <Bar dataKey="eurBbls" name="EUR (BBL)" radius={[0, 3, 3, 0]}>
                  {displayed.slice(0, 10).map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.workoversRecommended ? "#f43f5e" : index < 3 ? "#f59e0b" : "#d97706"}
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Red bars indicate workover candidates (high decline rate or &lt;1 yr remaining life)
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
