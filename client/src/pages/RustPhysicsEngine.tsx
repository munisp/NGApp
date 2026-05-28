/**
 * RustPhysicsEngine.tsx — Live showcase of the OG Physics Engine v2.0 (Rust)
 *
 * 5 interactive calculators, each calling the Rust service via tRPC:
 *   1. Nodal Analysis (IPR/VLP) — Vogel + Beggs-Brill
 *   2. Arps Decline Curve — EUR forecasting
 *   3. Turner Liquid Loading — gas well critical rate
 *   4. Wellbore Geomechanics — 1D MEM (Zoback-Eaton)
 *   5. Sand Onset — critical drawdown (Morita-Willson)
 *
 * Plus a SAGD/Heavy Oil tab and a Tornado Sensitivity chart.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Atom, Activity, TrendingDown, Wind, Mountain, AlertTriangle, Flame, RefreshCw, Play, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine, AreaChart, Area,
} from "recharts";

// ─── Colour helpers ──────────────────────────────────────────────────────────
const RISK_COLOR: Record<string, string> = {
  SAFE: "#22c55e",
  LOW: "#84cc16",
  MODERATE: "#f59e0b",
  HIGH: "#f97316",
  CRITICAL: "#ef4444",
};
const STATUS_COLOR: Record<string, string> = {
  LOADED: "#ef4444",
  NEAR_CRITICAL: "#f97316",
  UNLOADED: "#22c55e",
  BELOW_COLLAPSE: "#ef4444",
  WITHIN_WINDOW: "#22c55e",
  ABOVE_FRACTURE: "#f97316",
};

// ─── Nodal Analysis Tab ───────────────────────────────────────────────────────
function NodalTab() {
  const [params, setParams] = useState({
    wellId: "WELL-001",
    reservoirPressure: 3200,
    qMax: 1500,
    skinFactor: 2,
    espFrequencyHz: 55,
    wellheadPressure: 150,
    tvdFt: 7500,
    fluidGradient: 0.38,
    waterCut: 0.25,
    gorScfPerBbl: 450,
  });
  const [result, setResult] = useState<any>(null);
  const mutation = trpc.physicsEngine.nodal.useMutation({
    onSuccess: (data) => { setResult(data); toast.success("Nodal analysis complete"); },
    onError: (e) => toast.error(`Physics error: ${e.message}`),
  });

  const iprData = result?.ipr_curve?.map((p: any) => ({ q: Math.round(p.q), pwf: Math.round(p.pwf) })) ?? [];
  const vlpData = result?.vlp_curve?.map((p: any) => ({ q: Math.round(p.q), pwf: Math.round(p.pwf) })) ?? [];
  const chartData = iprData.map((pt: any, i: number) => ({
    q: pt.q,
    ipr: pt.pwf,
    vlp: vlpData[i]?.pwf,
  }));
  const op = result?.operating_point;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Inputs */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" /> IPR/VLP Nodal Analysis
          </CardTitle>
          <p className="text-zinc-500 text-xs">Vogel IPR + Beggs-Brill VLP intersection → ESP operating point</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "reservoirPressure", label: "Reservoir Pressure (psi)", min: 500, max: 10000, step: 50 },
              { key: "qMax", label: "AOF / q_max (BPD)", min: 100, max: 10000, step: 50 },
              { key: "skinFactor", label: "Skin Factor", min: -5, max: 30, step: 0.5 },
              { key: "espFrequencyHz", label: "ESP Frequency (Hz)", min: 30, max: 70, step: 1 },
              { key: "wellheadPressure", label: "Wellhead Pressure (psi)", min: 50, max: 1000, step: 10 },
              { key: "tvdFt", label: "TVD (ft)", min: 2000, max: 20000, step: 100 },
              { key: "fluidGradient", label: "Fluid Gradient (psi/ft)", min: 0.25, max: 0.55, step: 0.005 },
              { key: "waterCut", label: "Water Cut (fraction)", min: 0, max: 0.99, step: 0.01 },
              { key: "gorScfPerBbl", label: "GOR (scf/bbl)", min: 0, max: 3000, step: 50 },
            ].map(({ key, label, min, max, step }) => (
              <div key={key}>
                <Label className="text-zinc-400 text-xs">{label}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Slider
                    min={min} max={max} step={step}
                    value={[params[key as keyof typeof params] as number]}
                    onValueChange={([v]) => setParams(p => ({ ...p, [key]: v }))}
                    className="flex-1"
                  />
                  <span className="text-white text-xs font-mono w-14 text-right">{params[key as keyof typeof params]}</span>
                </div>
              </div>
            ))}
          </div>
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={() => mutation.mutate(params)}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Computing...</> : <><Play className="w-4 h-4 mr-2" /> Run Nodal Analysis</>}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="space-y-4">
        {op && (
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-4 text-center">
                <div className="text-zinc-400 text-xs mb-1">Operating Rate</div>
                <div className="text-2xl font-bold text-blue-400">{Math.round(op.q)}</div>
                <div className="text-zinc-500 text-xs">BPD</div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-4 text-center">
                <div className="text-zinc-400 text-xs mb-1">BHFP</div>
                <div className="text-2xl font-bold text-amber-400">{Math.round(op.pwf)}</div>
                <div className="text-zinc-500 text-xs">psi</div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-4 text-center">
                <div className="text-zinc-400 text-xs mb-1">Drawdown</div>
                <div className="text-2xl font-bold text-green-400">{Math.round(params.reservoirPressure - op.pwf)}</div>
                <div className="text-zinc-500 text-xs">psi</div>
              </CardContent>
            </Card>
          </div>
        )}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm">IPR / VLP Curves</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-zinc-500 text-sm">Run analysis to see curves</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="q" stroke="#71717a" tick={{ fontSize: 11 }} label={{ value: "Rate (BPD)", position: "insideBottom", offset: -5, fill: "#71717a", fontSize: 11 }} />
                  <YAxis stroke="#71717a" tick={{ fontSize: 11 }} label={{ value: "BHFP (psi)", angle: -90, position: "insideLeft", fill: "#71717a", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 6 }} labelStyle={{ color: "#e4e4e7" }} formatter={(v: any) => [`${Math.round(v)} psi`]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="ipr" stroke="#60a5fa" strokeWidth={2} dot={false} name="IPR (Vogel)" />
                  <Line type="monotone" dataKey="vlp" stroke="#f59e0b" strokeWidth={2} dot={false} name="VLP (Beggs-Brill)" />
                  {op && <ReferenceLine x={Math.round(op.q)} stroke="#22c55e" strokeDasharray="4 4" label={{ value: `OP: ${Math.round(op.q)} BPD`, fill: "#22c55e", fontSize: 11 }} />}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Decline Curve Tab ────────────────────────────────────────────────────────
function DeclineTab() {
  const [params, setParams] = useState({ wellId: "WELL-001", qi: 1200, di: 0.08, b: 0.5, months: 60 });
  const [result, setResult] = useState<any>(null);
  const mutation = trpc.physicsEngine.decline.useMutation({
    onSuccess: (data) => { setResult(data); toast.success("Decline curve computed"); },
    onError: (e) => toast.error(`Physics error: ${e.message}`),
  });

  const chartData = result?.points?.map((p: any) => ({
    month: p.month,
    rate: Math.round(p.rate_bpd),
    cumulative: Math.round(p.cumulative_mbbl * 1000),
  })) ?? [];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-amber-400" /> Arps Decline Curve
          </CardTitle>
          <p className="text-zinc-500 text-xs">Exponential / Hyperbolic / Harmonic — EUR forecasting</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "qi", label: "Initial Rate qi (BPD)", min: 100, max: 10000, step: 50 },
            { key: "di", label: "Initial Decline Di (fraction/month)", min: 0.005, max: 0.3, step: 0.005 },
            { key: "b", label: "Arps b-factor (0=exp, 1=harmonic)", min: 0, max: 1, step: 0.05 },
            { key: "months", label: "Forecast Horizon (months)", min: 12, max: 240, step: 6 },
          ].map(({ key, label, min, max, step }) => (
            <div key={key}>
              <Label className="text-zinc-400 text-xs">{label}</Label>
              <div className="flex items-center gap-2 mt-1">
                <Slider min={min} max={max} step={step}
                  value={[params[key as keyof typeof params] as number]}
                  onValueChange={([v]) => setParams(p => ({ ...p, [key]: v }))}
                  className="flex-1"
                />
                <span className="text-white text-xs font-mono w-14 text-right">{params[key as keyof typeof params]}</span>
              </div>
            </div>
          ))}
          <Button className="w-full bg-amber-600 hover:bg-amber-700" onClick={() => mutation.mutate(params)} disabled={mutation.isPending}>
            {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Computing...</> : <><Play className="w-4 h-4 mr-2" /> Compute EUR</>}
          </Button>
          {result && (
            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="bg-zinc-800 rounded p-3 text-center">
                <div className="text-zinc-400 text-xs">EUR</div>
                <div className="text-lg font-bold text-amber-400">{result.eur_mbbl?.toFixed(0)}</div>
                <div className="text-zinc-500 text-xs">MBbl</div>
              </div>
              <div className="bg-zinc-800 rounded p-3 text-center">
                <div className="text-zinc-400 text-xs">12-mo EUR</div>
                <div className="text-lg font-bold text-blue-400">{result.eur_12mo?.toFixed(0)}</div>
                <div className="text-zinc-500 text-xs">MBbl</div>
              </div>
              <div className="bg-zinc-800 rounded p-3 text-center">
                <div className="text-zinc-400 text-xs">Final Rate</div>
                <div className="text-lg font-bold text-green-400">{Math.round(result.points?.at(-1)?.rate_bpd ?? 0)}</div>
                <div className="text-zinc-500 text-xs">BPD</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-sm">Production Rate & Cumulative</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="h-80 flex items-center justify-center text-zinc-500 text-sm">Run decline curve to see forecast</div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="month" stroke="#71717a" tick={{ fontSize: 11 }} label={{ value: "Month", position: "insideBottom", offset: -5, fill: "#71717a", fontSize: 11 }} />
                <YAxis yAxisId="rate" stroke="#f59e0b" tick={{ fontSize: 11 }} label={{ value: "Rate (BPD)", angle: -90, position: "insideLeft", fill: "#f59e0b", fontSize: 11 }} />
                <YAxis yAxisId="cum" orientation="right" stroke="#60a5fa" tick={{ fontSize: 11 }} label={{ value: "Cumulative (Bbl)", angle: 90, position: "insideRight", fill: "#60a5fa", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 6 }} labelStyle={{ color: "#e4e4e7" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area yAxisId="rate" type="monotone" dataKey="rate" stroke="#f59e0b" fill="#f59e0b20" strokeWidth={2} name="Rate (BPD)" />
                <Area yAxisId="cum" type="monotone" dataKey="cumulative" stroke="#60a5fa" fill="#60a5fa10" strokeWidth={2} name="Cumulative (Bbl)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Turner Liquid Loading Tab ────────────────────────────────────────────────
function TurnerTab() {
  const [params, setParams] = useState({
    wellId: "GAS-001",
    tubingIdIn: 2.441,
    wellheadPressurePsia: 800,
    wellheadTempF: 120,
    gasRateMscfd: 1200,
    gasSpecificGravity: 0.65,
    surfaceTensionDynesCm: 60,
    liquidDensityLbFt3: 67,
  });
  const [result, setResult] = useState<any>(null);
  const mutation = trpc.physicsEngine.turnerLoading.useMutation({
    onSuccess: (data) => { setResult(data); toast.success("Turner analysis complete"); },
    onError: (e) => toast.error(`Physics error: ${e.message}`),
  });

  const status = result?.loading_status as string | undefined;
  const statusColor = STATUS_COLOR[status ?? ""] ?? "#71717a";

  const barData = result ? [
    { name: "Turner Critical", rate: result.critical_rate_turner_mscfd?.toFixed(1), fill: "#ef4444" },
    { name: "Coleman Critical", rate: result.critical_rate_coleman_mscfd?.toFixed(1), fill: "#f97316" },
    { name: "Current Rate", rate: params.gasRateMscfd?.toFixed(1), fill: "#60a5fa" },
  ] : [];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Wind className="w-4 h-4 text-cyan-400" /> Turner Liquid Loading
          </CardTitle>
          <p className="text-zinc-500 text-xs">Turner (1969) + Coleman (1991) critical velocity models for gas well liquid loading</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "tubingIdIn",           label: "Tubing ID (inches)",           min: 1.0,  max: 5.0,   step: 0.1 },
            { key: "wellheadPressurePsia",  label: "Wellhead Pressure (psia)",    min: 100,  max: 3000,  step: 25 },
            { key: "wellheadTempF",         label: "Wellhead Temperature (°F)",   min: 60,   max: 250,   step: 5 },
            { key: "gasRateMscfd",          label: "Gas Rate (Mscf/d)",           min: 100,  max: 20000, step: 100 },
            { key: "gasSpecificGravity",    label: "Gas Specific Gravity",        min: 0.55, max: 0.95,  step: 0.01 },
            { key: "surfaceTensionDynesCm", label: "Surface Tension (dynes/cm)",  min: 10,   max: 80,    step: 1 },
            { key: "liquidDensityLbFt3",    label: "Liquid Density (lb/ft³)",     min: 30,   max: 80,    step: 1 },
          ].map(({ key, label, min, max, step }) => (
            <div key={key}>
              <Label className="text-zinc-400 text-xs">{label}</Label>
              <div className="flex items-center gap-2 mt-1">
                <Slider min={min} max={max} step={step}
                  value={[params[key as keyof typeof params] as number]}
                  onValueChange={([v]) => setParams(p => ({ ...p, [key]: v }))}
                  className="flex-1"
                />
                <span className="text-white text-xs font-mono w-14 text-right">{(params[key as keyof typeof params] as number).toFixed(3)}</span>
              </div>
            </div>
          ))}
          <Button className="w-full bg-cyan-700 hover:bg-cyan-800" onClick={() => mutation.mutate(params)} disabled={mutation.isPending}>
            {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Computing...</> : <><Play className="w-4 h-4 mr-2" /> Analyse Loading Risk</>}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {result && (
          <>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-zinc-400 text-xs mb-1">Loading Status</div>
                    <div className="text-xl font-bold" style={{ color: statusColor }}>{status?.replace(/_/g, " ")}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-zinc-400 text-xs mb-1">Velocity Ratio</div>
                    <div className="text-xl font-bold text-white">{result.velocity_ratio?.toFixed(2)}</div>
                    <div className="text-zinc-500 text-xs">v_gas / v_critical</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-800 rounded p-3">
                    <div className="text-zinc-400 text-xs">Turner Critical Rate</div>
                    <div className="text-lg font-bold text-red-400">{result.critical_rate_turner_mscfd?.toFixed(1)} Mscf/d</div>
                  </div>
                  <div className="bg-zinc-800 rounded p-3">
                    <div className="text-zinc-400 text-xs">Coleman Critical Rate</div>
                    <div className="text-lg font-bold text-orange-400">{result.critical_rate_coleman_mscfd?.toFixed(1)} Mscf/d</div>
                  </div>
                </div>
                {result.recommendations?.length > 0 && (
                  <div className="mt-3 p-3 bg-zinc-800/60 rounded border border-zinc-700">
                    <div className="text-zinc-400 text-xs font-semibold mb-1">Recommendations</div>
                    {result.recommendations.map((r: string, i: number) => (
                      <p key={i} className="text-zinc-300 text-xs mt-1">{r}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2"><CardTitle className="text-white text-sm">Rate Comparison</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={barData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis type="number" stroke="#71717a" tick={{ fontSize: 11 }} label={{ value: "Mscf/d", position: "insideBottom", offset: -5, fill: "#71717a", fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" stroke="#71717a" tick={{ fontSize: 11 }} width={120} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 6 }} />
                    <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                      {barData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}
        {!result && (
          <div className="h-64 flex items-center justify-center text-zinc-500 text-sm border border-zinc-800 rounded-lg">
            Run analysis to see loading risk assessment
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Geomechanics Tab ─────────────────────────────────────────────────────────
function GeomechanicsTab() {
  const [params, setParams] = useState({
    wellId: "WELL-001",
    tvdFt: 10000,
    avgBulkDensityGcc: 2.35,
    porePressurePpg: 9.2 as number | undefined,
    lotPressurePpg: 14.5 as number | undefined,
    ucsPsi: 4000,
    frictionAngleDeg: 32,
    biotCoefficient: 0.8,
    poissonRatio: 0.25,
    inclinationDeg: 0,
    azimuthDeg: 0,
    currentMudWeightPpg: 10.5,
  });
  const [result, setResult] = useState<any>(null);
  const mutation = trpc.physicsEngine.geomechanics.useMutation({
    onSuccess: (data) => { setResult(data); toast.success("Geomechanics model computed"); },
    onError: (e) => toast.error(`Physics error: ${e.message}`),
  });

  const mwWindowData = result ? [
    { name: "Pore Pressure", value: result.pore_pressure_gradient_ppg, fill: "#60a5fa" },
    { name: "Collapse Gradient", value: result.collapse_gradient_ppg, fill: "#f97316" },
    { name: "MW Lower Bound", value: result.mw_lower_ppg, fill: "#f59e0b" },
    { name: "Recommended MW", value: result.recommended_mw_ppg, fill: "#22c55e" },
    { name: "Current MW", value: params.currentMudWeightPpg, fill: "#a78bfa" },
    { name: "MW Upper Bound", value: result.mw_upper_ppg, fill: "#f59e0b" },
    { name: "Fracture Gradient", value: result.fracture_gradient_ppg, fill: "#ef4444" },
  ] : [];

  const statusColor = STATUS_COLOR[result?.mud_weight_status ?? ""] ?? "#71717a";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Mountain className="w-4 h-4 text-stone-400" /> 1D Mechanical Earth Model
          </CardTitle>
          <p className="text-zinc-500 text-xs">Zoback-Eaton overburden + Mohr-Coulomb failure criterion → mud weight window</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: "tvdFt", label: "TVD (ft)", min: 1000, max: 25000, step: 500 },
            { key: "avgBulkDensityGcc", label: "Avg Bulk Density (g/cc)", min: 1.9, max: 2.8, step: 0.01 },
            { key: "porePressurePpg", label: "Pore Pressure (ppg)", min: 7, max: 18, step: 0.1 },
            { key: "lotPressurePpg", label: "LOT Pressure (ppg)", min: 9, max: 22, step: 0.1 },
            { key: "ucsPsi", label: "UCS (psi)", min: 500, max: 20000, step: 250 },
            { key: "frictionAngleDeg", label: "Friction Angle (°)", min: 15, max: 50, step: 1 },
            { key: "currentMudWeightPpg", label: "Current Mud Weight (ppg)", min: 7, max: 20, step: 0.1 },
            { key: "inclinationDeg", label: "Well Inclination (°)", min: 0, max: 90, step: 1 },
          ].map(({ key, label, min, max, step }) => (
            <div key={key}>
              <Label className="text-zinc-400 text-xs">{label}</Label>
              <div className="flex items-center gap-2 mt-1">
                <Slider min={min} max={max} step={step}
                  value={[params[key as keyof typeof params] as number ?? min]}
                  onValueChange={([v]) => setParams(p => ({ ...p, [key]: v }))}
                  className="flex-1"
                />
                <span className="text-white text-xs font-mono w-14 text-right">{(params[key as keyof typeof params] as number ?? 0).toFixed(2)}</span>
              </div>
            </div>
          ))}
          <Button className="w-full bg-stone-700 hover:bg-stone-800 mt-2" onClick={() => mutation.mutate(params)} disabled={mutation.isPending}>
            {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Computing...</> : <><Play className="w-4 h-4 mr-2" /> Run 1D MEM</>}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {result && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4">
                  <div className="text-zinc-400 text-xs mb-1">Stability Risk</div>
                  <div className="text-xl font-bold" style={{ color: RISK_COLOR[result.stability_risk] ?? "#71717a" }}>{result.stability_risk}</div>
                </CardContent>
              </Card>
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4">
                  <div className="text-zinc-400 text-xs mb-1">MW Status</div>
                  <div className="text-sm font-bold" style={{ color: statusColor }}>{result.mud_weight_status?.replace(/_/g, " ")}</div>
                </CardContent>
              </Card>
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4">
                  <div className="text-zinc-400 text-xs mb-1">MW Window</div>
                  <div className="text-lg font-bold text-green-400">{result.mw_lower_ppg?.toFixed(2)} – {result.mw_upper_ppg?.toFixed(2)}</div>
                  <div className="text-zinc-500 text-xs">ppg</div>
                </CardContent>
              </Card>
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4">
                  <div className="text-zinc-400 text-xs mb-1">Recommended MW</div>
                  <div className="text-lg font-bold text-amber-400">{result.recommended_mw_ppg?.toFixed(2)}</div>
                  <div className="text-zinc-500 text-xs">ppg</div>
                </CardContent>
              </Card>
            </div>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2"><CardTitle className="text-white text-sm">Mud Weight Window (ppg)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={mwWindowData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis type="number" domain={[6, 22]} stroke="#71717a" tick={{ fontSize: 10 }} label={{ value: "ppg", position: "insideBottom", offset: -5, fill: "#71717a", fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" stroke="#71717a" tick={{ fontSize: 10 }} width={130} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 6 }} formatter={(v: any) => [`${Number(v).toFixed(2)} ppg`]} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {mwWindowData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            {result.stability_issues?.length > 0 && (
              <Card className="bg-red-950/20 border-red-900/50">
                <CardContent className="p-3">
                  {result.stability_issues.map((s: string, i: number) => (
                    <p key={i} className="text-red-300 text-xs">{s}</p>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
        {!result && (
          <div className="h-64 flex items-center justify-center text-zinc-500 text-sm border border-zinc-800 rounded-lg">
            Run 1D MEM to see mud weight window
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sand Onset Tab ───────────────────────────────────────────────────────────
function SandOnsetTab() {
  const [params, setParams] = useState({
    wellId: "WELL-002",
    tvdFt: 8500,
    reservoirPressurePsia: 3000,
    bhfpPsia: 2200,
    ucsPsi: 2500,
    frictionAngleDeg: 30,
    biotCoefficient: 0.8,
    poissonRatio: 0.25,
    bulkDensityGcc: 2.3,
    perforationLengthFt: 20,
    perforationDiameterIn: 0.5,
    waterCut: 0,
    currentRateBpd: 800,
    completionType: "CASED_PERFORATED" as "OPEN_HOLE" | "CASED_PERFORATED" | "GRAVEL_PACK" | "FRAC_PACK" | "EXPANDABLE_SAND_SCREEN" | "STANDALONE_SCREEN",
  });
  const [result, setResult] = useState<any>(null);
  const mutation = trpc.physicsEngine.sandOnset.useMutation({
    onSuccess: (data) => { setResult(data); toast.success("Sand onset analysis complete"); },
    onError: (e) => toast.error(`Physics error: ${e.message}`),
  });

  const riskColor = RISK_COLOR[result?.sand_risk ?? ""] ?? "#71717a";

  const drawdownData = result ? [
    { name: "Critical Drawdown", value: result.critical_drawdown_psi, fill: "#22c55e" },
    { name: "Current Drawdown", value: result.current_drawdown_psi, fill: result.sand_risk === "CRITICAL" ? "#ef4444" : result.sand_risk === "HIGH" ? "#f97316" : "#f59e0b" },
    { name: "Max Safe Rate DD", value: result.max_safe_rate_bpd ? Math.round(result.max_safe_rate_bpd * 0.4) : 0, fill: "#60a5fa" },
  ] : [];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" /> Sand Onset (Morita-Willson)
          </CardTitle>
          <p className="text-zinc-500 text-xs">Critical drawdown pressure + sanding index for perforation stability</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "tvdFt", label: "TVD (ft)", min: 1000, max: 20000, step: 250 },
              { key: "reservoirPressurePsia", label: "Reservoir Pressure (psia)", min: 500, max: 12000, step: 100 },
              { key: "bhfpPsia", label: "BHFP (psia)", min: 200, max: 10000, step: 100 },
              { key: "ucsPsi", label: "UCS (psi)", min: 300, max: 15000, step: 250 },
              { key: "frictionAngleDeg", label: "Friction Angle (°)", min: 15, max: 50, step: 1 },
              { key: "currentRateBpd", label: "Current Rate (BPD)", min: 50, max: 20000, step: 50 },
              { key: "perforationLengthFt", label: "Perforation Length (ft)", min: 2, max: 100, step: 1 },
              { key: "waterCut", label: "Water Cut (fraction)", min: 0, max: 0.99, step: 0.01 },
            ].map(({ key, label, min, max, step }) => (
              <div key={key}>
                <Label className="text-zinc-400 text-xs">{label}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Slider min={min} max={max} step={step}
                    value={[params[key as keyof typeof params] as number]}
                    onValueChange={([v]) => setParams(p => ({ ...p, [key]: v }))}
                    className="flex-1"
                  />
                  <span className="text-white text-xs font-mono w-14 text-right">{params[key as keyof typeof params]}</span>
                </div>
              </div>
            ))}
          </div>
          <div>
            <Label className="text-zinc-400 text-xs">Completion Type</Label>
            <Select value={params.completionType} onValueChange={(v: any) => setParams(p => ({ ...p, completionType: v }))}>
              <SelectTrigger className="mt-1 bg-zinc-800 border-zinc-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                {[
                ["OPEN_HOLE", "Open Hole"],
                ["CASED_PERFORATED", "Cased Perforated"],
                ["GRAVEL_PACK", "Gravel Pack"],
                ["FRAC_PACK", "Frac Pack"],
                ["EXPANDABLE_SAND_SCREEN", "Expandable Sand Screen"],
                ["STANDALONE_SCREEN", "Standalone Screen"],
              ].map(([val, label]) => (
                  <SelectItem key={val} value={val} className="text-white">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full bg-yellow-700 hover:bg-yellow-800" onClick={() => mutation.mutate(params)} disabled={mutation.isPending}>
            {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Computing...</> : <><Play className="w-4 h-4 mr-2" /> Analyse Sand Risk</>}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {result && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4 text-center">
                  <div className="text-zinc-400 text-xs mb-1">Sand Risk</div>
                  <div className="text-2xl font-bold" style={{ color: riskColor }}>{result.sand_risk}</div>
                </CardContent>
              </Card>
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4 text-center">
                  <div className="text-zinc-400 text-xs mb-1">Sanding Index</div>
                  <div className="text-2xl font-bold text-white">{result.sanding_index?.toFixed(2)}</div>
                  <div className="text-zinc-500 text-xs">&gt;1 = sanding</div>
                </CardContent>
              </Card>
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4 text-center">
                  <div className="text-zinc-400 text-xs mb-1">Critical Drawdown</div>
                  <div className="text-xl font-bold text-green-400">{Math.round(result.critical_drawdown_psi)}</div>
                  <div className="text-zinc-500 text-xs">psi</div>
                </CardContent>
              </Card>
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4 text-center">
                  <div className="text-zinc-400 text-xs mb-1">Max Safe Rate</div>
                  <div className="text-xl font-bold text-blue-400">{Math.round(result.max_safe_rate_bpd ?? 0)}</div>
                  <div className="text-zinc-500 text-xs">BPD</div>
                </CardContent>
              </Card>
            </div>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2"><CardTitle className="text-white text-sm">Drawdown Analysis (psi)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={drawdownData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis type="number" stroke="#71717a" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" stroke="#71717a" tick={{ fontSize: 10 }} width={140} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 6 }} formatter={(v: any) => [`${Math.round(v)} psi`]} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {drawdownData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            {result.recommendations?.length > 0 && (
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-3 space-y-1">
                  <div className="text-zinc-400 text-xs font-semibold">Sand Control Recommendation: <span className="text-amber-400">{result.sand_control_recommendation?.replace(/_/g, " ")}</span></div>
                  {result.recommendations.map((r: string, i: number) => (
                    <p key={i} className="text-zinc-300 text-xs">{r}</p>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
        {!result && (
          <div className="h-64 flex items-center justify-center text-zinc-500 text-sm border border-zinc-800 rounded-lg">
            Run analysis to see sand onset assessment
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Heavy Oil (SAGD) Tab ─────────────────────────────────────────────────────
function HeavyOilTab() {
  const [params, setParams] = useState({
    wellId: "SAGD-001",
    reservoirThicknessFt: 80,
    steamTempF: 480,
    reservoirTempF: 55,
    oilViscosityCp: 50000,
    steamInjectionRateBpd: 400,
    steamQuality: 0.8,
    horizontalWellLengthFt: 2500,
    reservoirPorosityFrac: 0.33,
    oilSaturationFrac: 0.75,
    operatingMode: "SAGD" as "SAGD" | "CSS" | "HYBRID",
  });
  const [result, setResult] = useState<any>(null);
  const mutation = trpc.physicsEngine.heavyOil.useMutation({
    onSuccess: (data) => { setResult(data); toast.success("SAGD model computed"); },
    onError: (e) => toast.error(`Physics error: ${e.message}`),
  });

  const chamberData = result?.steam_chamber_growth?.map((p: any) => ({
    time: p.time_days,
    height: p.chamber_height_ft?.toFixed(1),
    width: p.chamber_width_ft?.toFixed(1),
    oilRate: p.oil_rate_bpd?.toFixed(0),
  })) ?? [];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" /> SAGD / CSS Steam Chamber Model
          </CardTitle>
          <p className="text-zinc-500 text-xs">Butler steam chamber growth + SOR + oil rate forecast for heavy oil / oil sands</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "reservoirThicknessFt", label: "Reservoir Thickness (ft)", min: 10, max: 300, step: 5 },
              { key: "steamTempF", label: "Steam Temperature (°F)", min: 300, max: 650, step: 10 },
              { key: "reservoirTempF", label: "Reservoir Temperature (°F)", min: 40, max: 180, step: 5 },
              { key: "steamInjectionRateBpd", label: "Steam Injection Rate (BPD)", min: 50, max: 3000, step: 50 },
              { key: "steamQuality", label: "Steam Quality (fraction)", min: 0.5, max: 1.0, step: 0.05 },
              { key: "horizontalWellLengthFt", label: "Horizontal Well Length (ft)", min: 500, max: 4000, step: 100 },
              { key: "reservoirPorosityFrac", label: "Porosity (fraction)", min: 0.15, max: 0.45, step: 0.01 },
              { key: "oilSaturationFrac", label: "Oil Saturation (fraction)", min: 0.4, max: 0.9, step: 0.01 },
            ].map(({ key, label, min, max, step }) => (
              <div key={key}>
                <Label className="text-zinc-400 text-xs">{label}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Slider min={min} max={max} step={step}
                    value={[params[key as keyof typeof params] as number]}
                    onValueChange={([v]) => setParams(p => ({ ...p, [key]: v }))}
                    className="flex-1"
                  />
                  <span className="text-white text-xs font-mono w-14 text-right">{params[key as keyof typeof params]}</span>
                </div>
              </div>
            ))}
          </div>
          <div>
            <Label className="text-zinc-400 text-xs">Operating Mode</Label>
            <Select value={params.operatingMode} onValueChange={(v: any) => setParams(p => ({ ...p, operatingMode: v }))}>
              <SelectTrigger className="mt-1 bg-zinc-800 border-zinc-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                {["SAGD", "CSS", "HYBRID"].map(m => (
                  <SelectItem key={m} value={m} className="text-white">{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full bg-orange-700 hover:bg-orange-800" onClick={() => mutation.mutate(params)} disabled={mutation.isPending}>
            {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Computing...</> : <><Play className="w-4 h-4 mr-2" /> Run SAGD Model</>}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {result && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4 text-center">
                  <div className="text-zinc-400 text-xs mb-1">Peak Oil Rate</div>
                  <div className="text-xl font-bold text-orange-400">{Math.round(result.peak_oil_rate_bpd ?? 0)}</div>
                  <div className="text-zinc-500 text-xs">BPD</div>
                </CardContent>
              </Card>
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4 text-center">
                  <div className="text-zinc-400 text-xs mb-1">SOR</div>
                  <div className="text-xl font-bold text-blue-400">{result.sor?.toFixed(2)}</div>
                  <div className="text-zinc-500 text-xs">bbl steam/bbl oil</div>
                </CardContent>
              </Card>
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4 text-center">
                  <div className="text-zinc-400 text-xs mb-1">Recovery Factor</div>
                  <div className="text-xl font-bold text-green-400">{((result.recovery_factor_fraction ?? 0) * 100).toFixed(1)}%</div>
                </CardContent>
              </Card>
            </div>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2"><CardTitle className="text-white text-sm">Steam Chamber Growth</CardTitle></CardHeader>
              <CardContent>
                {chamberData.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-zinc-500 text-sm">No chamber growth data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={chamberData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="time" stroke="#71717a" tick={{ fontSize: 11 }} label={{ value: "Days", position: "insideBottom", offset: -5, fill: "#71717a", fontSize: 11 }} />
                      <YAxis yAxisId="dim" stroke="#f59e0b" tick={{ fontSize: 11 }} label={{ value: "ft", angle: -90, position: "insideLeft", fill: "#f59e0b", fontSize: 11 }} />
                      <YAxis yAxisId="rate" orientation="right" stroke="#f97316" tick={{ fontSize: 11 }} label={{ value: "BPD", angle: 90, position: "insideRight", fill: "#f97316", fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 6 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line yAxisId="dim" type="monotone" dataKey="height" stroke="#f59e0b" strokeWidth={2} dot={false} name="Chamber Height (ft)" />
                      <Line yAxisId="dim" type="monotone" dataKey="width" stroke="#60a5fa" strokeWidth={2} dot={false} name="Chamber Width (ft)" />
                      <Line yAxisId="rate" type="monotone" dataKey="oilRate" stroke="#f97316" strokeWidth={2} dot={false} name="Oil Rate (BPD)" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </>
        )}
        {!result && (
          <div className="h-64 flex items-center justify-center text-zinc-500 text-sm border border-zinc-800 rounded-lg">
            Run SAGD model to see steam chamber growth
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RustPhysicsEnginePage() {
  const { data: health, refetch: refetchHealth } = trpc.physicsEngine.health.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const isOnline = health?.status === "ok";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Atom className="w-7 h-7 text-amber-400" />
            Rust Physics Engine
            <Badge variant="outline" className="text-xs font-mono text-zinc-400 border-zinc-700 ml-1">
              {health?.model_version ?? "og-physics-1.0.0"}
            </Badge>
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Live petroleum engineering calculations — compiled Rust service at <code className="text-amber-400 text-xs">:4001</code>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${isOnline ? "text-green-400 border-green-700 bg-green-950/30" : "text-red-400 border-red-700 bg-red-950/30"}`}>
            {isOnline ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            {isOnline ? `Online — uptime ${Math.round((health?.uptime_secs ?? 0) / 60)}m` : "Offline"}
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchHealth()}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Engine info banner */}
      <Card className="bg-zinc-900/60 border-zinc-800">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {[
              { label: "Language", value: "Rust", sub: "Zero-cost abstractions" },
              { label: "Framework", value: "Axum", sub: "Async HTTP/JSON" },
              { label: "Models", value: "7", sub: "Physics endpoints" },
              { label: "Latency", value: "<5ms", sub: "Per computation" },
            ].map(({ label, value, sub }) => (
              <div key={label}>
                <div className="text-zinc-500 text-xs">{label}</div>
                <div className="text-white font-bold text-lg">{value}</div>
                <div className="text-zinc-600 text-xs">{sub}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Calculators */}
      <Tabs defaultValue="nodal" className="space-y-4">
        <TabsList className="bg-zinc-900 border border-zinc-800 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="nodal" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-zinc-400 text-xs">
            <Activity className="w-3.5 h-3.5 mr-1" /> Nodal Analysis
          </TabsTrigger>
          <TabsTrigger value="decline" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white text-zinc-400 text-xs">
            <TrendingDown className="w-3.5 h-3.5 mr-1" /> Decline Curve
          </TabsTrigger>
          <TabsTrigger value="turner" className="data-[state=active]:bg-cyan-700 data-[state=active]:text-white text-zinc-400 text-xs">
            <Wind className="w-3.5 h-3.5 mr-1" /> Turner Loading
          </TabsTrigger>
          <TabsTrigger value="geomechanics" className="data-[state=active]:bg-stone-700 data-[state=active]:text-white text-zinc-400 text-xs">
            <Mountain className="w-3.5 h-3.5 mr-1" /> Geomechanics
          </TabsTrigger>
          <TabsTrigger value="sand" className="data-[state=active]:bg-yellow-700 data-[state=active]:text-white text-zinc-400 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Sand Onset
          </TabsTrigger>
          <TabsTrigger value="heavyoil" className="data-[state=active]:bg-orange-700 data-[state=active]:text-white text-zinc-400 text-xs">
            <Flame className="w-3.5 h-3.5 mr-1" /> SAGD / Heavy Oil
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nodal"><NodalTab /></TabsContent>
        <TabsContent value="decline"><DeclineTab /></TabsContent>
        <TabsContent value="turner"><TurnerTab /></TabsContent>
        <TabsContent value="geomechanics"><GeomechanicsTab /></TabsContent>
        <TabsContent value="sand"><SandOnsetTab /></TabsContent>
        <TabsContent value="heavyoil"><HeavyOilTab /></TabsContent>
      </Tabs>
    </div>
  );
}
