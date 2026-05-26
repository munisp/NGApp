/**
 * GasWellLiquidLoading.tsx
 * Turner critical velocity model for liquid loading detection in gas wells.
 * Provides real-time loading status, remediation recommendations, and trend analysis.
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
  RadialBarChart, RadialBar, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
  BarChart, Bar, Cell,
} from "recharts";
import { toast } from "sonner";
import { Wind, AlertTriangle, CheckCircle2, TrendingDown, Wrench, Activity, RefreshCw, Gauge, Layers, Cpu } from "lucide-react";

// ── Rust Physics Engine: Turner Loading Panel ─────────────────────────────────
function RustTurnerPanel() {
  const wellsQuery = trpc.wells.list.useQuery({ limit: 200 });
  const wellsList = wellsQuery.data && 'wells' in wellsQuery.data ? (wellsQuery.data as any).wells : [];
  const [wellId, setWellId] = useState("");
  const [tubingId, setTubingId] = useState(2.441);
  const [whPressure, setWhPressure] = useState(800);
  const [whTemp, setWhTemp] = useState(120);
  const [resPressure, setResPressure] = useState(2800);
  const [currentRate, setCurrentRate] = useState(1200);
  const turnerMutation = trpc.physicsEngine.turnerLoading.useMutation({
    onError: (e) => toast.error(`Rust engine error: ${e.message}`),
  });
  const result = turnerMutation.data as any;
  const riskColor = result?.loading_status === "LOADING" || result?.loading_status === "SEVERE_LOADING" ? "red" : result?.loading_status === "AT_RISK" ? "yellow" : "green";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Cpu className="w-5 h-5 text-orange-400" />
        <span className="text-white font-semibold">Rust Physics Engine — Turner &amp; Coleman Critical Velocity</span>
        <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/40 text-xs">:4001 live</Badge>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-slate-300 text-xs">Well</Label>
          <select value={wellId} onChange={e => setWellId(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-md px-2 py-1.5 text-sm mt-1">
            <option value="">Select well...</option>
            {wellsList.map((w: any) => <option key={w.wellId} value={w.wellId}>{w.name}</option>)}
          </select>
        </div>
        <div><Label className="text-slate-300 text-xs">Tubing ID (in)</Label>
          <Input type="number" step="0.001" value={tubingId} onChange={e => setTubingId(+e.target.value)} className="bg-slate-700 border-slate-600 text-white mt-1" /></div>
        <div><Label className="text-slate-300 text-xs">WH Pressure (psia)</Label>
          <Input type="number" value={whPressure} onChange={e => setWhPressure(+e.target.value)} className="bg-slate-700 border-slate-600 text-white mt-1" /></div>
        <div><Label className="text-slate-300 text-xs">WH Temp (°F)</Label>
          <Input type="number" value={whTemp} onChange={e => setWhTemp(+e.target.value)} className="bg-slate-700 border-slate-600 text-white mt-1" /></div>
        <div><Label className="text-slate-300 text-xs">Reservoir Pressure (psia)</Label>
          <Input type="number" value={resPressure} onChange={e => setResPressure(+e.target.value)} className="bg-slate-700 border-slate-600 text-white mt-1" /></div>
        <div><Label className="text-slate-300 text-xs">Current Rate (Mscf/d)</Label>
          <Input type="number" value={currentRate} onChange={e => setCurrentRate(+e.target.value)} className="bg-slate-700 border-slate-600 text-white mt-1" /></div>
      </div>
      <Button onClick={() => turnerMutation.mutate({ wellId: wellId || "RUST-TEST", tubingIdIn: tubingId, wellheadPressurePsia: whPressure, wellheadTempF: whTemp, gasRateMscfd: currentRate, gasSpecificGravity: 0.65, surfaceTensionDynesCm: 60, liquidDensityLbFt3: 67 })}
        disabled={turnerMutation.isPending} className="bg-orange-600 hover:bg-orange-700 text-white">
        {turnerMutation.isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Computing...</> : <><Cpu className="w-4 h-4 mr-2" />Run Rust Turner Analysis</>}
      </Button>
      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {label: "Critical Velocity (Turner)", value: `${result.critical_velocity_turner_fps?.toFixed(2) ?? "—"} ft/s`, color: "cyan"},
              {label: "Actual Velocity", value: `${result.actual_velocity_fps?.toFixed(2) ?? "—"} ft/s`, color: "blue"},
              {label: "Loading Status", value: result.loading_status?.replace(/_/g, " ") ?? "—", color: riskColor},
              {label: "Velocity Ratio", value: result.velocity_ratio ? `${result.velocity_ratio.toFixed(2)}×` : "N/A", color: "purple"},
            ].map(item => (
              <Card key={item.label} className="bg-slate-800/60 border-slate-700">
                <CardContent className="pt-3 pb-3">
                  <p className="text-slate-400 text-xs">{item.label}</p>
                  <p className={`text-lg font-bold text-${item.color}-400`}>{item.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          {result.remediation && (
            <div className="bg-slate-800/40 border border-orange-700/40 rounded p-3">
              <p className="text-orange-300 text-xs font-medium mb-1">Rust Engine Recommendation</p>
              <p className="text-white text-sm">{result.remediation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Plunger Lift Sizing Tab ───────────────────────────────────────────────────
function PlungerLiftTab() {
  const wellsQuery = trpc.wells.list.useQuery({ limit: 200 });
  const wells = wellsQuery.data && 'wells' in wellsQuery.data ? wellsQuery.data.wells : [];
  const [form, setForm] = useState({
    wellId: "", casingPressurePsia: 800, tubingPressurePsia: 200, tubingIdIn: 2.441,
    wellDepthFt: 8000, liquidColumnHeightFt: 500, gasRateMscfd: 150, liquidRateBpd: 20, plungerWeightLbs: 0.5,
  });
  const [result, setResult] = useState<any>(null);
  const sizeMutation = trpc.liquidLoading.plungerLiftSizing.useMutation({
    onSuccess: (d) => { setResult(d); toast.success(d.isFeasible ? "Plunger lift feasible" : "Insufficient pressure"); },
    onError: (e) => toast.error("Sizing failed", { description: e.message }),
  });
  const set = (k: string, v: number | string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="bg-slate-800/60 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2"><Gauge className="w-5 h-5 text-cyan-400" />Plunger Lift Sizing</CardTitle>
          <CardDescription className="text-slate-400">Foss &amp; Gaul (1965) model — minimum casing pressure and cycle design</CardDescription>
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
            {([
              ["Casing Pressure (psia)", "casingPressurePsia"],
              ["Tubing Pressure (psia)", "tubingPressurePsia"],
              ["Tubing ID (in)", "tubingIdIn"],
              ["Well Depth (ft)", "wellDepthFt"],
              ["Liquid Column Height (ft)", "liquidColumnHeightFt"],
              ["Gas Rate (Mscfd)", "gasRateMscfd"],
              ["Liquid Rate (BPD)", "liquidRateBpd"],
              ["Plunger Weight (lbs)", "plungerWeightLbs"],
            ] as [string, string][]).map(([label, key]) => (
              <div key={key}>
                <Label className="text-slate-300">{label}</Label>
                <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" step="0.001"
                  value={(form as any)[key]} onChange={(e) => set(key, +e.target.value)} />
              </div>
            ))}
          </div>
          <Button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
            disabled={!form.wellId || sizeMutation.isPending}
            onClick={() => sizeMutation.mutate({ ...form, wellId: form.wellId })}>
            {sizeMutation.isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Sizing...</> : "Size Plunger Lift"}
          </Button>
        </CardContent>
      </Card>
      {result && (
        <Card className={`border ${result.isFeasible ? "bg-emerald-900/20 border-emerald-700/40" : "bg-red-900/20 border-red-700/40"}`}>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              {result.isFeasible ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-red-400" />}
              {result.isFeasible ? "Feasible" : "Not Feasible"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 bg-slate-700/50 rounded text-sm text-slate-200">{result.recommendation}</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {([
                ["Min Casing Pressure", `${result.minCasingPressurePsia} psia`],
                ["Available Differential", `${result.availableDifferentialPsia} psia`],
                ["Rise Velocity", `${result.riseVelocityFtMin} ft/min`],
                ["Cycle Time", `${result.cycleTimeMins} min`],
                ["Cycles/Day", result.cyclesPerDay],
                ["Liquid/Cycle", `${result.liquidPerCycleBbl} bbl`],
                ["Plunger Type", result.recommendedPlungerType],
                ["Model", result.model],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="bg-slate-700/50 rounded p-2">
                  <div className="text-slate-400">{k}</div>
                  <div className="text-white font-medium">{v}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Velocity String Design Tab ────────────────────────────────────────────────
function VelocityStringTab() {
  const wellsQuery = trpc.wells.list.useQuery({ limit: 200 });
  const wells = wellsQuery.data && 'wells' in wellsQuery.data ? wellsQuery.data.wells : [];
  const [form, setForm] = useState({
    wellId: "", currentTubingIdIn: 2.441, gasRateMscfd: 150, wellheadPressurePsia: 500,
    wellheadTempF: 100, wellDepthFt: 8000,
  });
  const [enabled, setEnabled] = useState(false);
  const { data: result } = trpc.liquidLoading.velocityStringDesign.useQuery(
    { ...form, wellId: form.wellId || "DEMO" },
    { enabled: enabled && !!form.wellId }
  );
  const set = (k: string, v: number | string) => setForm((f) => ({ ...f, [k]: v }));
  const STATUS_COLORS: Record<string, string> = { UNLOADED: "#10b981", AT_RISK: "#f59e0b", LOADING: "#ef4444" };
  return (
    <div className="space-y-6">
      <Card className="bg-slate-800/60 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2"><Layers className="w-5 h-5 text-cyan-400" />Velocity String Design</CardTitle>
          <CardDescription className="text-slate-400">Turner (1969) — compare tubing sizes to find optimal velocity string ID</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            <div>
              <Label className="text-slate-300">Well</Label>
              <select className="w-full mt-1 bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                value={form.wellId} onChange={(e) => set("wellId", e.target.value)}>
                <option value="">Select well...</option>
                {wells.map((w: any) => <option key={w.wellId} value={w.wellId}>{w.wellName}</option>)}
              </select>
            </div>
            {([
              ["Current Tubing ID (in)", "currentTubingIdIn"],
              ["Gas Rate (Mscfd)", "gasRateMscfd"],
              ["Wellhead Pressure (psia)", "wellheadPressurePsia"],
              ["Wellhead Temp (°F)", "wellheadTempF"],
              ["Well Depth (ft)", "wellDepthFt"],
            ] as [string, string][]).map(([label, key]) => (
              <div key={key}>
                <Label className="text-slate-300">{label}</Label>
                <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" step="0.001"
                  value={(form as any)[key]} onChange={(e) => set(key, +e.target.value)} />
              </div>
            ))}
          </div>
          <Button className="bg-cyan-600 hover:bg-cyan-700 text-white" disabled={!form.wellId}
            onClick={() => setEnabled(true)}>Compute Velocity String Options</Button>
        </CardContent>
      </Card>
      {result && (
        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Tubing Size Comparison</CardTitle>
            <CardDescription className="text-slate-400">
              Recommended: <span className="text-cyan-400 font-semibold">{result.recommendedSize}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-blue-900/20 border border-blue-700/40 rounded text-sm text-blue-200">{result.installationNote}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-slate-400 border-b border-slate-700">
                  {["Tubing Size","Crit. Vel (ft/s)","Crit. Rate (Mscfd)","Velocity Ratio","Status","ΔP (psi)"].map(h => (
                    <th key={h} className="text-left py-2 pr-4">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {result.tubingSizeComparison.map((row: any) => (
                    <tr key={row.tubingSize} className={`border-b border-slate-700/50 ${row.idIn === result.recommendedIdIn ? "bg-cyan-900/20" : ""}`}>
                      <td className="py-2 pr-4 text-white font-medium">{row.tubingSize}</td>
                      <td className="py-2 pr-4 text-slate-300">{row.criticalVelocityFps}</td>
                      <td className="py-2 pr-4 text-slate-300">{row.criticalRateMscfd}</td>
                      <td className="py-2 pr-4 text-slate-300">{row.velocityRatio}</td>
                      <td className="py-2 pr-4">
                        <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ color: STATUS_COLORS[row.status], backgroundColor: STATUS_COLORS[row.status] + "22" }}>{row.status}</span>
                      </td>
                      <td className="py-2 pr-4 text-slate-300">{row.pressureDropPsi}</td>
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

const STATUS_CONFIG = {
  UNLOADED: { color: "#10b981", bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", label: "Unloaded", icon: CheckCircle2 },
  AT_RISK: { color: "#f59e0b", bg: "bg-amber-500/10 text-amber-400 border-amber-500/30", label: "At Risk", icon: AlertTriangle },
  LOADING: { color: "#f97316", bg: "bg-orange-500/10 text-orange-400 border-orange-500/30", label: "Loading", icon: TrendingDown },
  SEVERE_LOADING: { color: "#ef4444", bg: "bg-red-500/10 text-red-400 border-red-500/30", label: "Severe Loading", icon: AlertTriangle },
};

const REMEDIATION_LABELS: Record<string, string> = {
  PLUNGER_LIFT: "Plunger Lift",
  VELOCITY_STRING: "Velocity String",
  FOAM_INJECTION: "Foam Injection",
  GAS_LIFT: "Gas Lift",
  COMPRESSION: "Compression",
  WELLBORE_CLEANOUT: "Wellbore Cleanout",
};

function SummaryCards() {
  const { data } = trpc.liquidLoading.summary.useQuery();
  if (!data) return null;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-slate-800/60 border-slate-700">
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-white">{data.totalWellsMonitored}</div>
          <div className="text-xs text-slate-400 mt-1">Wells Monitored</div>
        </CardContent>
      </Card>
      <Card className="bg-red-900/20 border-red-700/40">
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-red-400">{data.severeLoading}</div>
          <div className="text-xs text-slate-400 mt-1">Severe Loading</div>
        </CardContent>
      </Card>
      <Card className="bg-orange-900/20 border-orange-700/40">
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-orange-400">{data.loading}</div>
          <div className="text-xs text-slate-400 mt-1">Loading</div>
        </CardContent>
      </Card>
      <Card className="bg-amber-900/20 border-amber-700/40">
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-amber-400">{data.atRisk}</div>
          <div className="text-xs text-slate-400 mt-1">At Risk</div>
        </CardContent>
      </Card>
    </div>
  );
}

function TurnerAnalysisForm() {
  const wellsQuery = trpc.wells.list.useQuery({ limit: 200 });
  const wells = wellsQuery.data && 'wells' in wellsQuery.data ? wellsQuery.data.wells : [];

  const [form, setForm] = useState({
    wellId: "",
    wellheadPressurePsia: 500,
    wellheadTempF: 100,
    gasRateMscfd: 200,
    tubingIdIn: 2.441,
    declineRateMscfdPerDay: 0.5,
  });
  const [result, setResult] = useState<any>(null);

  const analyzeMutation = trpc.liquidLoading.analyze.useMutation({
    onSuccess: (data) => {
      setResult(data);
      const cfg = STATUS_CONFIG[data.loadingStatus as keyof typeof STATUS_CONFIG];
      toast.success(`Turner Analysis: ${cfg?.label ?? data.loadingStatus}`, {
        description: `Velocity ratio: ${(data.velocityRatio ?? 0).toFixed(3)} | Critical rate: ${(data.criticalRateMscfd ?? 0).toFixed(1)} Mscfd`,
      });
    },
    onError: (err) => toast.error("Analysis failed", { description: err.message }),
  });

  const set = (k: string, v: number | string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Form */}
      <Card className="bg-slate-800/60 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Wind className="w-5 h-5 text-cyan-400" />
            Turner Critical Velocity Analysis
          </CardTitle>
          <CardDescription className="text-slate-400">
            Turner et al. (1969) model — determines minimum gas velocity to lift liquids
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-slate-300">Well</Label>
            <select
              className="w-full mt-1 bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
              value={form.wellId}
              onChange={(e) => set("wellId", e.target.value)}
            >
              <option value="">Select well...</option>
              {wells.map((w: any) => (
                <option key={w.wellId} value={w.wellId}>{w.wellName}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-300">Wellhead Pressure (psia)</Label>
              <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number"
                value={form.wellheadPressurePsia} onChange={(e) => set("wellheadPressurePsia", +e.target.value)} />
            </div>
            <div>
              <Label className="text-slate-300">Wellhead Temp (°F)</Label>
              <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number"
                value={form.wellheadTempF} onChange={(e) => set("wellheadTempF", +e.target.value)} />
            </div>
            <div>
              <Label className="text-slate-300">Gas Rate (Mscfd)</Label>
              <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number"
                value={form.gasRateMscfd} onChange={(e) => set("gasRateMscfd", +e.target.value)} />
            </div>
            <div>
              <Label className="text-slate-300">Tubing ID (in)</Label>
              <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" step="0.001"
                value={form.tubingIdIn} onChange={(e) => set("tubingIdIn", +e.target.value)} />
            </div>
            <div>
              <Label className="text-slate-300">Decline Rate (Mscfd/day)</Label>
              <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" step="0.1"
                value={form.declineRateMscfdPerDay} onChange={(e) => set("declineRateMscfdPerDay", +e.target.value)} />
            </div>
          </div>
          <Button
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
            disabled={!form.wellId || analyzeMutation.isPending}
            onClick={() => analyzeMutation.mutate({ ...form, wellId: form.wellId })}
          >
            {analyzeMutation.isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</> : "Run Turner Analysis"}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (() => {
        const cfg = STATUS_CONFIG[result.loadingStatus as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.AT_RISK;
        const Icon = cfg.icon;
        const velocityPct = Math.min(100, (result.velocityRatio ?? 0) * 100);
        return (
          <Card className="bg-slate-800/60 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                Analysis Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`flex items-center gap-3 p-3 rounded-lg border ${cfg.bg}`}>
                <Icon className="w-6 h-6" />
                <div>
                  <div className="font-semibold">{cfg.label}</div>
                  <div className="text-xs opacity-80">Urgency: {result.urgency}</div>
                </div>
              </div>

              {/* Velocity gauge */}
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart cx="50%" cy="80%" innerRadius="60%" outerRadius="90%"
                    startAngle={180} endAngle={0} data={[{ value: velocityPct, fill: cfg.color }]}>
                    <RadialBar dataKey="value" cornerRadius={4} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="text-center -mt-8">
                  <div className="text-2xl font-bold text-white">{(result.velocityRatio ?? 0).toFixed(3)}</div>
                  <div className="text-xs text-slate-400">v_actual / v_critical</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-700/50 rounded p-2">
                  <div className="text-slate-400">Critical Velocity</div>
                  <div className="text-white font-medium">{(result.criticalVelocityFps ?? 0).toFixed(2)} ft/s</div>
                </div>
                <div className="bg-slate-700/50 rounded p-2">
                  <div className="text-slate-400">Actual Velocity</div>
                  <div className="text-white font-medium">{(result.actualVelocityFps ?? 0).toFixed(2)} ft/s</div>
                </div>
                <div className="bg-slate-700/50 rounded p-2">
                  <div className="text-slate-400">Critical Rate</div>
                  <div className="text-white font-medium">{(result.criticalRateMscfd ?? 0).toFixed(1)} Mscfd</div>
                </div>
                <div className="bg-slate-700/50 rounded p-2">
                  <div className="text-slate-400">Days to Loading</div>
                  <div className="text-white font-medium">
                    {result.daysToLoading != null ? `${result.daysToLoading.toFixed(0)} days` : "N/A"}
                  </div>
                </div>
              </div>

              {result.remediationMethod && (
                <div className="flex items-center gap-2 p-3 bg-blue-900/20 border border-blue-700/40 rounded-lg">
                  <Wrench className="w-4 h-4 text-blue-400" />
                  <div>
                    <div className="text-blue-300 text-sm font-medium">Recommended Remediation</div>
                    <div className="text-white font-semibold">{REMEDIATION_LABELS[result.remediationMethod] ?? result.remediationMethod}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}

function LoadingHistoryTab() {
  const { data: events, refetch } = trpc.liquidLoading.list.useQuery({});
  const eventsArr = events ?? [];

  const chartData = eventsArr.slice(0, 20).reverse().map((e: any, i: number) => ({
    name: `Event ${i + 1}`,
    velocityRatio: +(e.velocityRatio ?? 0).toFixed(3),
    criticalRate: +(e.criticalRateMscfd ?? 0).toFixed(1),
    actualRate: +(e.gasRateMscfd ?? 0).toFixed(1),
    status: e.loadingStatus,
  }));

  const statusCounts = eventsArr.reduce((acc: Record<string, number>, e: any) => {
    acc[e.loadingStatus] = (acc[e.loadingStatus] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const barData = Object.entries(statusCounts).map(([status, count]) => ({
    status: STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.label ?? status,
    count,
    fill: STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.color ?? "#64748b",
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="border-slate-600 text-slate-300" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader><CardTitle className="text-white text-sm">Velocity Ratio Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
                <ReferenceLine y={1} stroke="#10b981" strokeDasharray="4 4" label={{ value: "Critical", fill: "#10b981", fontSize: 10 }} />
                <Line type="monotone" dataKey="velocityRatio" stroke="#06b6d4" strokeWidth={2} dot={false} name="v/v_c" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader><CardTitle className="text-white text-sm">Status Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="status" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-800/60 border-slate-700">
        <CardHeader><CardTitle className="text-white text-sm">Recent Events</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="text-left py-2 px-3">Well</th>
                  <th className="text-left py-2 px-3">Status</th>
                  <th className="text-right py-2 px-3">v/v_c</th>
                  <th className="text-right py-2 px-3">Gas Rate</th>
                  <th className="text-right py-2 px-3">Critical Rate</th>
                  <th className="text-left py-2 px-3">Remediation</th>
                  <th className="text-left py-2 px-3">Detected</th>
                </tr>
              </thead>
              <tbody>
                {eventsArr.slice(0, 15).map((e: any) => {
                  const cfg = STATUS_CONFIG[e.loadingStatus as keyof typeof STATUS_CONFIG];
                  return (
                    <tr key={e.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-2 px-3 text-white font-mono text-xs">{e.wellId}</td>
                      <td className="py-2 px-3">
                        <Badge variant="outline" className={`text-xs ${cfg?.bg}`}>{cfg?.label ?? e.loadingStatus}</Badge>
                      </td>
                      <td className="py-2 px-3 text-right text-white">{(e.velocityRatio ?? 0).toFixed(3)}</td>
                      <td className="py-2 px-3 text-right text-slate-300">{(e.gasRateMscfd ?? 0).toFixed(1)}</td>
                      <td className="py-2 px-3 text-right text-slate-300">{(e.criticalRateMscfd ?? 0).toFixed(1)}</td>
                      <td className="py-2 px-3 text-slate-300 text-xs">{e.remediationMethod ? REMEDIATION_LABELS[e.remediationMethod] ?? e.remediationMethod : "—"}</td>
                      <td className="py-2 px-3 text-slate-400 text-xs">{new Date(e.detectedAt).toLocaleString()}</td>
                    </tr>
                  );
                })}
                {eventsArr.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-500">No events recorded yet. Run a Turner analysis above.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function GasWellLiquidLoadingPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wind className="w-7 h-7 text-cyan-400" />
            Gas Well Liquid Loading
          </h1>
          <p className="text-slate-400 mt-1">Turner critical velocity model · Plunger lift · Velocity string · Foam injection</p>
        </div>
        <Badge variant="outline" className="border-cyan-500/40 text-cyan-400 bg-cyan-500/10">
          Turner (1969) Model
        </Badge>
      </div>

      <SummaryCards />

      <Tabs defaultValue="analyze">
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="analyze" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">Turner Analysis</TabsTrigger>
          <TabsTrigger value="plunger" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">Plunger Lift</TabsTrigger>
          <TabsTrigger value="velocity" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">Velocity String</TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">Event History</TabsTrigger>
          <TabsTrigger value="rust" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white flex items-center gap-1"><Cpu className="w-3 h-3" />Rust Engine</TabsTrigger>
        </TabsList>
        <TabsContent value="analyze" className="mt-4"><TurnerAnalysisForm /></TabsContent>
        <TabsContent value="plunger" className="mt-4"><PlungerLiftTab /></TabsContent>
        <TabsContent value="velocity" className="mt-4"><VelocityStringTab /></TabsContent>
        <TabsContent value="history" className="mt-4"><LoadingHistoryTab /></TabsContent>
        <TabsContent value="rust" className="mt-4"><RustTurnerPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
