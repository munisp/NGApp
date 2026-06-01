/**
 * HeavyOilOptimization.tsx
 * Heavy oil reservoir optimization: viscosity-temperature modeling (Beggs-Robinson),
 * EOR method recommendations (SAGD, CSS, Steam Flood), and production uplift analysis.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell,
} from "recharts";
import { toast } from "sonner";
import { AreaChart, Area } from "recharts";
import { Flame, TrendingUp, RefreshCw, Thermometer, Activity, DollarSign, FlaskConical } from "lucide-react";

// ── Butler SAGD Steam Chamber Simulation Tab ─────────────────────────────────
function SAGDSimulationTab() {
  const wellsQuery = trpc.wells.list.useQuery({ limit: 200 });
  const wells = wellsQuery.data && 'wells' in wellsQuery.data ? wellsQuery.data.wells : [];
  const [form, setForm] = useState({
    wellId: "",
    reservoirThicknessM: 20,
    reservoirLengthM: 500,
    porosity: 0.32,
    oilSaturation: 0.75,
    oilViscosityMpa: 100000,
    reservoirTempC: 10,
    steamTempC: 220,
    thermalDiffusivityM2Day: 0.0864,
    steamInjectionRateTonnesPerDay: 200,
    oilPriceUsdPerBbl: 70,
    steamCostUsdPerTonne: 25,
    simulationYears: 10,
  });
  const [result, setResult] = useState<any>(null);
  const set = (k: string, v: number | string) => setForm((f) => ({ ...f, [k]: v }));

  const sagdMutation = trpc.heavyOil.sagdSimulation.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success(`SAGD Simulation Complete`, {
        description: `Peak: ${data.peakOilRateBpd} bpd | SOR: ${data.steamToOilRatio} | NPV10: $${(data.npv10Usd / 1e6).toFixed(1)}M`,
      });
    },
    onError: (e) => toast.error("Simulation failed", { description: e.message }),
  });

  const FIELDS: [string, string, number, number, number][] = [
    ["Reservoir Thickness (m)", "reservoirThicknessM", 1, 200, 1],
    ["Well Pair Length (m)", "reservoirLengthM", 100, 2000, 50],
    ["Porosity (fraction)", "porosity", 0.1, 0.5, 0.01],
    ["Oil Saturation", "oilSaturation", 0.3, 0.95, 0.01],
    ["Cold Oil Viscosity (mPa.s)", "oilViscosityMpa", 1000, 1000000, 1000],
    ["Reservoir Temp (°C)", "reservoirTempC", 5, 50, 1],
    ["Steam Temp (°C)", "steamTempC", 150, 300, 5],
    ["Steam Rate (t/day)", "steamInjectionRateTonnesPerDay", 50, 1000, 50],
    ["Oil Price ($/bbl)", "oilPriceUsdPerBbl", 30, 150, 5],
    ["Steam Cost ($/tonne)", "steamCostUsdPerTonne", 10, 80, 5],
    ["Simulation Years", "simulationYears", 1, 30, 1],
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-orange-400" />
              Butler SAGD Simulation
            </CardTitle>
            <CardDescription className="text-slate-400">
              Parabolic steam chamber growth model. Ref: Butler R.M. (1985) JCPT 24(3):42-51.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-slate-300">Well Pair</Label>
              <select className="w-full mt-1 bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                value={form.wellId} onChange={(e) => set("wellId", e.target.value)}>
                <option value="">Select well...</option>
                {wells.map((w: any) => <option key={w.wellId} value={w.wellId}>{w.wellName}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {FIELDS.map(([label, key, min, max, step]) => (
                <div key={key}>
                  <Label className="text-slate-300 text-xs">{label}</Label>
                  <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number"
                    min={min} max={max} step={step}
                    value={(form as any)[key]}
                    onChange={(e) => set(key, +e.target.value)} />
                </div>
              ))}
            </div>
            <Button className="w-full bg-orange-600 hover:bg-orange-700 text-white"
              disabled={!form.wellId || sagdMutation.isPending}
              onClick={() => sagdMutation.mutate({ ...form, wellId: form.wellId })}>
              {sagdMutation.isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Simulating...</> : "Run SAGD Simulation"}
            </Button>
          </CardContent>
        </Card>

        {result ? (
          <Card className="bg-slate-800/60 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-sm">Results — {result.model}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-300 text-sm">
                {result.recommendation}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {([
                  ["Peak Oil Rate", `${result.peakOilRateBpd.toLocaleString()} bpd`],
                  ["Steam-to-Oil Ratio", `${result.steamToOilRatio}`],
                  ["Viscosity Ratio", `${result.viscosityRatio.toLocaleString()}x`],
                  ["Chamber Growth", result.steamChamberGrowthModel],
                  ["Total Oil (sim period)", `${(result.totalOilBbl10yr / 1e6).toFixed(2)} MMbbl`],
                  ["Total Revenue", `$${(result.totalRevenueUsd / 1e6).toFixed(1)}M`],
                  ["Total Steam Cost", `$${(result.totalSteamCostUsd / 1e6).toFixed(1)}M`],
                  ["NPV10", `$${(result.npv10Usd / 1e6).toFixed(1)}M`],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="bg-slate-700/50 rounded px-3 py-2">
                    <div className="text-slate-400 text-xs">{k}</div>
                    <div className="text-white font-semibold">{v}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-slate-800/60 border-slate-700 flex items-center justify-center">
            <CardContent className="text-center py-16">
              <Thermometer className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">Run simulation to see results</p>
              <p className="text-slate-500 text-xs mt-1">Butler (1985) parabolic steam chamber model</p>
            </CardContent>
          </Card>
        )}
      </div>

      {result && (
        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-sm">Annual Production &amp; Cash Flow Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={result.yearlyProfile} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="oilGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="year" stroke="#94a3b8" tick={{ fontSize: 11 }} label={{ value: "Year", position: "insideBottom", offset: -2, fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis yAxisId="left" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 6 }} labelStyle={{ color: "#e2e8f0" }} />
                  <Legend />
                  <Area yAxisId="left" type="monotone" dataKey="oilRateBpd" name="Oil Rate (bpd)" stroke="#f97316" fill="url(#oilGrad)" strokeWidth={2} />
                  <Area yAxisId="right" type="monotone" dataKey="netCashflowUsd" name="Net Cash Flow ($)" stroke="#10b981" fill="url(#cashGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-500 mt-2">Steam chamber: parabolic (sqrt-time) per Butler 1985 | SOR: {result.steamToOilRatio} | NPV10: ${(result.npv10Usd / 1e6).toFixed(1)}M</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const EOR_METHOD_LABELS: Record<string, string> = {
  PRIMARY_DEPLETION: "Primary Depletion",
  WATER_FLOOD: "Water Flood",
  POLYMER_FLOOD: "Polymer Flood",
  STEAM_FLOOD: "Steam Flood",
  CYCLIC_STEAM_STIMULATION: "CSS",
  SAGD: "SAGD",
  IN_SITU_COMBUSTION: "In-Situ Combustion",
  SOLVENT_INJECTION: "Solvent Injection",
};

const EOR_COLORS: Record<string, string> = {
  SAGD: "#f97316",
  CYCLIC_STEAM_STIMULATION: "#f59e0b",
  STEAM_FLOOD: "#ef4444",
  IN_SITU_COMBUSTION: "#dc2626",
  PRIMARY_DEPLETION: "#06b6d4",
  POLYMER_FLOOD: "#8b5cf6",
  WATER_FLOOD: "#3b82f6",
  SOLVENT_INJECTION: "#10b981",
};

function SummaryCards() {
  const { data } = trpc.heavyOil.summary.useQuery();
  if (!data) return null;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-slate-800/60 border-slate-700">
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-white">{data.totalWells}</div>
          <div className="text-xs text-slate-400 mt-1">Heavy Oil Wells</div>
        </CardContent>
      </Card>
      <Card className="bg-orange-900/20 border-orange-700/40">
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-orange-400">{data.sagdCandidates}</div>
          <div className="text-xs text-slate-400 mt-1">SAGD Candidates</div>
        </CardContent>
      </Card>
      <Card className="bg-amber-900/20 border-amber-700/40">
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-amber-400">{data.cssCandidates}</div>
          <div className="text-xs text-slate-400 mt-1">CSS Candidates</div>
        </CardContent>
      </Card>
      <Card className="bg-emerald-900/20 border-emerald-700/40">
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-emerald-400">
            ${((data.totalNetBenefitUsdPerYear ?? 0) / 1e6).toFixed(1)}M
          </div>
          <div className="text-xs text-slate-400 mt-1">Net Benefit/yr</div>
        </CardContent>
      </Card>
    </div>
  );
}

function HeavyOilAnalysisForm() {
  const wellsQuery = trpc.wells.list.useQuery({ limit: 200 });
  const wells = wellsQuery.data && 'wells' in wellsQuery.data ? wellsQuery.data.wells : [];

  const [form, setForm] = useState({
    wellId: "",
    apiGravity: 12,
    reservoirTempF: 180,
    currentRateBpd: 200,
    waterCut: 0.3,
    steamInjectionCweBpd: 500,
    steamQuality: 0.7,
    gorScfPerBbl: 50,
    netPayFt: 80,
    porosityFraction: 0.32,
    eorMethod: "SAGD" as const,
    steamCostUsdPerBblCwe: 8.0,
  });
  const [result, setResult] = useState<any>(null);
  const [viscCurve, setViscCurve] = useState<{ temp: number; viscosity: number }[]>([]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const analyzeMutation = trpc.heavyOil.analyze.useMutation({
    onSuccess: (data: any) => {
      setResult(data);
      // Build viscosity-temperature curve using Beggs-Robinson approximation
      const curve: { temp: number; viscosity: number }[] = [];
      const visc0 = data.currentViscosityCp ?? 1000;
      for (let t = 50; t <= 600; t += 25) {
        const viscAtT = visc0 * Math.exp(-0.03 * (t - form.reservoirTempF));
        curve.push({ temp: t, viscosity: Math.max(0.5, viscAtT) });
      }
      setViscCurve(curve);
      toast.success("Heavy Oil Analysis Complete", {
        description: `Recommended EOR: ${EOR_METHOD_LABELS[data.recommendedEorMethod] ?? data.recommendedEorMethod} | Uplift: ${(data.projectedRateUpliftPct ?? 0).toFixed(0)}%`,
      });
    },
    onError: (e: any) => toast.error("Analysis failed", { description: e.message }),
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Thermometer className="w-5 h-5 text-orange-400" />
              Heavy Oil EOR Optimizer
            </CardTitle>
            <CardDescription className="text-slate-400">
              Beggs-Robinson viscosity model · Butler SAGD · CSS · Steam-oil ratio optimization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-slate-300">Well</Label>
              <select className="w-full mt-1 bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                value={form.wellId} onChange={(e) => set("wellId", e.target.value)}>
                <option value="">Select well...</option>
                {wells.map((w: any) => <option key={w.wellId} value={w.wellId}>{w.wellName}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300">API Gravity (°API)</Label>
                <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" step="0.1"
                  value={form.apiGravity} onChange={(e) => set("apiGravity", +e.target.value)} />
              </div>
              <div>
                <Label className="text-slate-300">Reservoir Temp (°F)</Label>
                <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number"
                  value={form.reservoirTempF} onChange={(e) => set("reservoirTempF", +e.target.value)} />
              </div>
              <div>
                <Label className="text-slate-300">Current Rate (bpd)</Label>
                <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number"
                  value={form.currentRateBpd} onChange={(e) => set("currentRateBpd", +e.target.value)} />
              </div>
              <div>
                <Label className="text-slate-300">Water Cut</Label>
                <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" step="0.01" min="0" max="1"
                  value={form.waterCut} onChange={(e) => set("waterCut", +e.target.value)} />
              </div>
              <div>
                <Label className="text-slate-300">Steam Injection (bpd CWE)</Label>
                <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number"
                  value={form.steamInjectionCweBpd} onChange={(e) => set("steamInjectionCweBpd", +e.target.value)} />
              </div>
              <div>
                <Label className="text-slate-300">Steam Quality (0-1)</Label>
                <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" step="0.05" min="0" max="1"
                  value={form.steamQuality} onChange={(e) => set("steamQuality", +e.target.value)} />
              </div>
              <div>
                <Label className="text-slate-300">Net Pay (ft)</Label>
                <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number"
                  value={form.netPayFt} onChange={(e) => set("netPayFt", +e.target.value)} />
              </div>
              <div>
                <Label className="text-slate-300">Porosity</Label>
                <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" step="0.01"
                  value={form.porosityFraction} onChange={(e) => set("porosityFraction", +e.target.value)} />
              </div>
              <div>
                <Label className="text-slate-300">Steam Cost ($/bbl CWE)</Label>
                <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" step="0.5"
                  value={form.steamCostUsdPerBblCwe} onChange={(e) => set("steamCostUsdPerBblCwe", +e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-slate-300">EOR Method</Label>
              <select className="w-full mt-1 bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                value={form.eorMethod} onChange={(e) => set("eorMethod", e.target.value)}>
                {Object.entries(EOR_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <Button className="w-full bg-orange-600 hover:bg-orange-700 text-white"
              disabled={!form.wellId || analyzeMutation.isPending}
              onClick={() => analyzeMutation.mutate({ ...form, wellId: form.wellId })}>
              {analyzeMutation.isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Analyzing...</> : "Run EOR Analysis"}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <div className="space-y-4">
            <Card className="bg-slate-800/60 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-orange-400" />
                  EOR Analysis Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-orange-500/10 text-orange-400 border-orange-500/30">
                  <Flame className="w-5 h-5" />
                  <div>
                    <div className="font-semibold">Recommended: {EOR_METHOD_LABELS[result.recommendedEorMethod] ?? result.recommendedEorMethod}</div>
                    <div className="text-xs opacity-80">Projected uplift: {(result.projectedRateUpliftPct ?? 0).toFixed(0)}%</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-slate-700/50 rounded p-2">
                    <div className="text-slate-400">Reservoir Viscosity</div>
                    <div className="text-white font-bold">{(result.currentViscosityCp ?? 0).toLocaleString()} cP</div>
                  </div>
                  <div className="bg-slate-700/50 rounded p-2">
                    <div className="text-slate-400">Steam-Oil Ratio</div>
                    <div className="text-orange-400 font-bold">{(result.steamToOilRatio ?? 0).toFixed(2)}</div>
                  </div>
                  <div className="bg-slate-700/50 rounded p-2">
                    <div className="text-slate-400">Thermal Efficiency</div>
                    <div className="text-amber-400 font-bold">{(result.thermalEfficiencyPct ?? 0).toFixed(1)}%</div>
                  </div>
                  <div className="bg-slate-700/50 rounded p-2">
                    <div className="text-slate-400">Net Benefit/yr</div>
                    <div className="text-emerald-400 font-bold">${((result.netBenefitUsdPerYear ?? 0) / 1e6).toFixed(2)}M</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {viscCurve.length > 0 && (
              <Card className="bg-slate-800/60 border-slate-700">
                <CardHeader><CardTitle className="text-white text-sm">Viscosity vs Temperature (Beggs-Robinson)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={viscCurve}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="temp" tick={{ fill: "#94a3b8", fontSize: 10 }} unit="°F" />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} scale="log" domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                        formatter={(v: any) => [`${(+v).toFixed(1)} cP`]} />
                      <ReferenceLine x={form.reservoirTempF} stroke="#f59e0b" strokeDasharray="4 4"
                        label={{ value: "Res T", fill: "#f59e0b", fontSize: 9 }} />
                      <Line type="monotone" dataKey="viscosity" stroke="#f97316" strokeWidth={2} dot={false} name="Viscosity (cP)" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function HeavyOilWellsTab() {
  const { data: params, refetch } = trpc.heavyOil.list.useQuery({ wellId: undefined });
  const paramsArr = params ?? [];

  const methodDist = paramsArr.reduce((acc: Record<string, number>, p: any) => {
    const m = p.recommendedEorMethod ?? p.eorMethod ?? "PRIMARY_DEPLETION";
    acc[m] = (acc[m] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const barData = Object.entries(methodDist).map(([method, count]) => ({
    method: EOR_METHOD_LABELS[method] ?? method,
    count,
    fill: EOR_COLORS[method] ?? "#64748b",
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="border-slate-600 text-slate-300" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />Refresh
        </Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader><CardTitle className="text-white text-sm">EOR Method Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="method" tick={{ fill: "#94a3b8", fontSize: 9 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {barData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader><CardTitle className="text-white text-sm">Net Benefit per Well</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={paramsArr.slice(0, 10).map((p: any) => ({
                well: (p.wellId ?? "").slice(-6),
                benefit: +((p.netBenefitUsdPerYear ?? 0) / 1e6).toFixed(2),
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="well" tick={{ fill: "#94a3b8", fontSize: 9 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} unit="M$" />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                  formatter={(v: any) => [`$${v}M`]} />
                <Bar dataKey="benefit" fill="#f97316" radius={[4, 4, 0, 0]} name="Net Benefit" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <Card className="bg-slate-800/60 border-slate-700">
        <CardHeader><CardTitle className="text-white text-sm">Heavy Oil Well Parameters</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="text-left py-2 px-3">Well</th>
                  <th className="text-right py-2 px-3">API °</th>
                  <th className="text-right py-2 px-3">Viscosity (cP)</th>
                  <th className="text-left py-2 px-3">Recommended EOR</th>
                  <th className="text-right py-2 px-3">Uplift %</th>
                  <th className="text-right py-2 px-3">SOR</th>
                  <th className="text-right py-2 px-3">Net Benefit/yr</th>
                </tr>
              </thead>
              <tbody>
                {paramsArr.slice(0, 15).map((p: any) => (
                  <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-2 px-3 text-white font-mono text-xs">{p.wellId}</td>
                    <td className="py-2 px-3 text-right text-slate-300">{(p.apiGravity ?? 0).toFixed(1)}°</td>
                    <td className="py-2 px-3 text-right text-orange-400">{(p.currentViscosityCp ?? 0).toLocaleString()}</td>
                    <td className="py-2 px-3 text-slate-300 text-xs">{EOR_METHOD_LABELS[p.recommendedEorMethod] ?? p.recommendedEorMethod ?? "—"}</td>
                    <td className="py-2 px-3 text-right text-emerald-400">{(p.projectedRateUpliftPct ?? 0).toFixed(0)}%</td>
                    <td className="py-2 px-3 text-right text-slate-300">{p.steamToOilRatio != null ? p.steamToOilRatio.toFixed(2) : "—"}</td>
                    <td className="py-2 px-3 text-right text-emerald-400">${((p.netBenefitUsdPerYear ?? 0) / 1e6).toFixed(2)}M</td>
                  </tr>
                ))}
                {paramsArr.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-500">No heavy oil wells analyzed yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function HeavyOilOptimizationPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Flame className="w-7 h-7 text-orange-400" />
            Heavy Oil Optimization
          </h1>
          <p className="text-slate-400 mt-1">Beggs-Robinson viscosity · SAGD · CSS · Steam flood · EOR method recommendation</p>
        </div>
        <Badge variant="outline" className="border-orange-500/40 text-orange-400 bg-orange-500/10">
          Thermal EOR
        </Badge>
      </div>
      <SummaryCards />
      <Tabs defaultValue="analyze">
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="analyze" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white">EOR Analysis</TabsTrigger>
          <TabsTrigger value="wells" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white">Well Parameters</TabsTrigger>
          <TabsTrigger value="sagd" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white">SAGD Simulation</TabsTrigger>
        </TabsList>
        <TabsContent value="analyze" className="mt-4"><HeavyOilAnalysisForm /></TabsContent>
        <TabsContent value="wells" className="mt-4"><HeavyOilWellsTab /></TabsContent>
        <TabsContent value="sagd" className="mt-4"><SAGDSimulationTab /></TabsContent>
      </Tabs>
    </div>
  );
}
