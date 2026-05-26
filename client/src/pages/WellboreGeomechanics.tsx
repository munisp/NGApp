/**
 * WellboreGeomechanics.tsx
 * 1D Mechanical Earth Model (MEM), mud weight window calculator,
 * pore pressure prediction, and wellbore stability risk assessment.
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
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine,
} from "recharts";
import { toast } from "sonner";
import { Layers, AlertTriangle, CheckCircle2, RefreshCw, Calculator, TrendingUp, Upload, FileText, Cpu } from "lucide-react";

// ── Rust Physics Engine: 1D MEM Geomechanics Panel ───────────────────────────
function RustGeomechanicsPanel() {
  const wellsQuery = trpc.wells.list.useQuery({ limit: 200 });
  const wellsList = wellsQuery.data && 'wells' in wellsQuery.data ? (wellsQuery.data as any).wells : [];
  const [wellId, setWellId] = useState("");
  const [tvd, setTvd] = useState(9000);
  const [obGrad, setObGrad] = useState(1.0);
  const [ppGrad, setPpGrad] = useState(0.433);
  const [ucs, setUcs] = useState(4000);
  const [frictionAngle, setFrictionAngle] = useState(30);
  const [biotCoeff, setBiotCoeff] = useState(0.8);
  const [poissonRatio, setPoissonRatio] = useState(0.25);
  const geoMutation = trpc.physicsEngine.geomechanics.useMutation({
    onError: (e) => toast.error(`Rust engine error: ${e.message}`),
  });
  const result = geoMutation.data as any;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Cpu className="w-5 h-5 text-orange-400" />
        <span className="text-white font-semibold">Rust Physics Engine — 1D MEM &amp; Mud Weight Window</span>
        <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/40 text-xs">:4001 live</Badge>
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
        <div><Label className="text-slate-300 text-xs">TVD (ft)</Label>
          <Input type="number" value={tvd} onChange={e => setTvd(+e.target.value)} className="bg-slate-700 border-slate-600 text-white mt-1" /></div>
        <div><Label className="text-slate-300 text-xs">Overburden Gradient (psi/ft)</Label>
          <Input type="number" step="0.001" value={obGrad} onChange={e => setObGrad(+e.target.value)} className="bg-slate-700 border-slate-600 text-white mt-1" /></div>
        <div><Label className="text-slate-300 text-xs">Pore Pressure Gradient (psi/ft)</Label>
          <Input type="number" step="0.001" value={ppGrad} onChange={e => setPpGrad(+e.target.value)} className="bg-slate-700 border-slate-600 text-white mt-1" /></div>
        <div><Label className="text-slate-300 text-xs">UCS (psi)</Label>
          <Input type="number" value={ucs} onChange={e => setUcs(+e.target.value)} className="bg-slate-700 border-slate-600 text-white mt-1" /></div>
        <div><Label className="text-slate-300 text-xs">Friction Angle (°)</Label>
          <Input type="number" value={frictionAngle} onChange={e => setFrictionAngle(+e.target.value)} className="bg-slate-700 border-slate-600 text-white mt-1" /></div>
        <div><Label className="text-slate-300 text-xs">Biot Coefficient</Label>
          <Input type="number" step="0.01" value={biotCoeff} onChange={e => setBiotCoeff(+e.target.value)} className="bg-slate-700 border-slate-600 text-white mt-1" /></div>
        <div><Label className="text-slate-300 text-xs">Poisson Ratio</Label>
          <Input type="number" step="0.01" value={poissonRatio} onChange={e => setPoissonRatio(+e.target.value)} className="bg-slate-700 border-slate-600 text-white mt-1" /></div>
      </div>
      <Button onClick={() => geoMutation.mutate({ wellId: wellId || "RUST-TEST", tvdFt: tvd, avgBulkDensityGcc: 2.35, porePressurePpg: ppGrad * 19.25, ucsPsi: ucs, frictionAngleDeg: frictionAngle, biotCoefficient: biotCoeff, poissonRatio, currentMudWeightPpg: 10.5 })}
        disabled={geoMutation.isPending} className="bg-orange-600 hover:bg-orange-700 text-white">
        {geoMutation.isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Computing...</> : <><Cpu className="w-4 h-4 mr-2" />Run Rust 1D MEM</>}
      </Button>
      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {label: "Overburden Stress", value: `${result.overburden_stress_psi?.toFixed(0) ?? "—"} psi`, color: "slate"},
              {label: "Pore Pressure", value: `${result.pore_pressure_psi?.toFixed(0) ?? "—"} psi`, color: "blue"},
              {label: "Min Horiz Stress", value: `${result.min_horizontal_stress_psi?.toFixed(0) ?? "—"} psi`, color: "cyan"},
              {label: "Fracture Gradient", value: `${result.fracture_gradient_psi_per_ft?.toFixed(3) ?? "—"} psi/ft`, color: "red"},
              {label: "MW Min (ppg)", value: result.mud_weight_window_ppg?.minimum?.toFixed(2) ?? "—", color: "yellow"},
              {label: "MW Max (ppg)", value: result.mud_weight_window_ppg?.maximum?.toFixed(2) ?? "—", color: "green"},
              {label: "MW Window (ppg)", value: result.mud_weight_window_ppg ? (result.mud_weight_window_ppg.maximum - result.mud_weight_window_ppg.minimum).toFixed(2) : "—", color: "purple"},
              {label: "Stability Risk", value: result.wellbore_stability_risk ?? "—", color: result.wellbore_stability_risk === "HIGH" ? "red" : result.wellbore_stability_risk === "MEDIUM" ? "yellow" : "green"},
            ].map(item => (
              <Card key={item.label} className="bg-slate-800/60 border-slate-700">
                <CardContent className="pt-3 pb-3">
                  <p className="text-slate-400 text-xs">{item.label}</p>
                  <p className={`text-base font-bold text-${item.color}-400`}>{item.value}</p>
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

const RISK_CONFIG = {
  LOW: { color: "#10b981", bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", label: "Low Risk" },
  MEDIUM: { color: "#f59e0b", bg: "bg-amber-500/10 text-amber-400 border-amber-500/30", label: "Medium Risk" },
  HIGH: { color: "#f97316", bg: "bg-orange-500/10 text-orange-400 border-orange-500/30", label: "High Risk" },
  CRITICAL: { color: "#ef4444", bg: "bg-red-500/10 text-red-400 border-red-500/30", label: "Critical Risk" },
};

const MW_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  OPTIMAL: { label: "Optimal", color: "#10b981" },
  NEAR_COLLAPSE_LIMIT: { label: "Near Collapse", color: "#f97316" },
  NEAR_FRACTURE_LIMIT: { label: "Near Fracture", color: "#f97316" },
  BELOW_COLLAPSE: { label: "Below Collapse", color: "#ef4444" },
  ABOVE_FRACTURE: { label: "Above Fracture", color: "#ef4444" },
};

function SummaryCards() {
  const { data } = trpc.geomechanics.summary.useQuery();
  if (!data) return null;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-slate-800/60 border-slate-700">
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-white">{data.total}</div>
          <div className="text-xs text-slate-400 mt-1">MEM Models</div>
        </CardContent>
      </Card>
      <Card className="bg-red-900/20 border-red-700/40">
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-red-400">{data.critical}</div>
          <div className="text-xs text-slate-400 mt-1">Critical Stability</div>
        </CardContent>
      </Card>
      <Card className="bg-orange-900/20 border-orange-700/40">
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-orange-400">{data.high}</div>
          <div className="text-xs text-slate-400 mt-1">High Risk</div>
        </CardContent>
      </Card>
      <Card className="bg-slate-800/60 border-slate-700">
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-cyan-400">{(data.avgWindowWidthPpg ?? 0).toFixed(2)}</div>
          <div className="text-xs text-slate-400 mt-1">Avg MW Window (ppg)</div>
        </CardContent>
      </Card>
    </div>
  );
}

function MEMComputeForm() {
  const wellsQuery = trpc.wells.list.useQuery({ limit: 200 });
  const wells = wellsQuery.data && 'wells' in wellsQuery.data ? wellsQuery.data.wells : [];

  const [form, setForm] = useState({
    wellId: "",
    tvdFt: 8000,
    avgBulkDensityGcc: 2.3,
    normalPpGradientPpg: 8.6,
    eatonExponent: 3.0,
    ucsPsi: 3000,
    frictionAngleDeg: 30,
    biotCoefficient: 0.8,
    poissonRatio: 0.25,
    currentMudWeightPpg: 9.5,
    stressRegime: "NORMAL_FAULTING" as const,
  });
  const [result, setResult] = useState<any>(null);

  const computeMutation = trpc.geomechanics.compute.useMutation({
    onSuccess: (data) => {
      setResult(data);
      const risk = RISK_CONFIG[data.stabilityRisk as keyof typeof RISK_CONFIG];
      toast.success(`MEM Computed: ${risk?.label}`, {
        description: `MW Window: ${(data.mwLowerPpg ?? 0).toFixed(2)} – ${(data.mwUpperPpg ?? 0).toFixed(2)} ppg`,
      });
    },
    onError: (err) => toast.error("Computation failed", { description: err.message }),
  });

  const set = (k: string, v: number | string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="bg-slate-800/60 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Calculator className="w-5 h-5 text-purple-400" />
            1D MEM Calculator
          </CardTitle>
          <CardDescription className="text-slate-400">
            Eaton pore pressure · Poroelastic Shmin · Mohr-Coulomb collapse · Fracture gradient
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
              <Label className="text-slate-300">TVD (ft)</Label>
              <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number"
                value={form.tvdFt} onChange={(e) => set("tvdFt", +e.target.value)} />
            </div>
            <div>
              <Label className="text-slate-300">Bulk Density (g/cc)</Label>
              <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" step="0.01"
                value={form.avgBulkDensityGcc} onChange={(e) => set("avgBulkDensityGcc", +e.target.value)} />
            </div>
            <div>
              <Label className="text-slate-300">Normal PP Gradient (ppg)</Label>
              <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" step="0.1"
                value={form.normalPpGradientPpg} onChange={(e) => set("normalPpGradientPpg", +e.target.value)} />
            </div>
            <div>
              <Label className="text-slate-300">UCS (psi)</Label>
              <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number"
                value={form.ucsPsi} onChange={(e) => set("ucsPsi", +e.target.value)} />
            </div>
            <div>
              <Label className="text-slate-300">Friction Angle (°)</Label>
              <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number"
                value={form.frictionAngleDeg} onChange={(e) => set("frictionAngleDeg", +e.target.value)} />
            </div>
            <div>
              <Label className="text-slate-300">Poisson's Ratio</Label>
              <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" step="0.01"
                value={form.poissonRatio} onChange={(e) => set("poissonRatio", +e.target.value)} />
            </div>
            <div>
              <Label className="text-slate-300">Biot Coefficient</Label>
              <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" step="0.01"
                value={form.biotCoefficient} onChange={(e) => set("biotCoefficient", +e.target.value)} />
            </div>
            <div>
              <Label className="text-slate-300">Current MW (ppg)</Label>
              <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" step="0.1"
                value={form.currentMudWeightPpg} onChange={(e) => set("currentMudWeightPpg", +e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-slate-300">Stress Regime</Label>
            <select className="w-full mt-1 bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
              value={form.stressRegime} onChange={(e) => set("stressRegime", e.target.value)}>
              <option value="NORMAL_FAULTING">Normal Faulting</option>
              <option value="STRIKE_SLIP">Strike-Slip</option>
              <option value="THRUST_FAULTING">Thrust Faulting</option>
            </select>
          </div>
          <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            disabled={!form.wellId || computeMutation.isPending}
            onClick={() => computeMutation.mutate({ ...form, wellId: form.wellId })}>
            {computeMutation.isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Computing...</> : "Compute 1D MEM"}
          </Button>
        </CardContent>
      </Card>

      {result && (() => {
        const risk = RISK_CONFIG[result.stabilityRisk as keyof typeof RISK_CONFIG] ?? RISK_CONFIG.MEDIUM;
        const mwStatus = MW_STATUS_CONFIG[result.mudWeightStatus] ?? { label: result.mudWeightStatus, color: "#94a3b8" };
        const windowData = [
          { name: "Collapse", value: result.collapseGradientPpg, fill: "#ef4444" },
          { name: "MW Lower", value: result.mwLowerPpg, fill: "#f97316" },
          { name: "Current MW", value: result.currentMudWeightPpg, fill: "#06b6d4" },
          { name: "Recommended", value: result.recommendedMwPpg, fill: "#10b981" },
          { name: "MW Upper", value: result.mwUpperPpg, fill: "#f59e0b" },
          { name: "Fracture", value: result.fractureGradientPpg, fill: "#8b5cf6" },
        ];
        return (
          <Card className="bg-slate-800/60 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-400" />
                MEM Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`flex items-center gap-3 p-3 rounded-lg border ${risk.bg}`}>
                <AlertTriangle className="w-5 h-5" />
                <div>
                  <div className="font-semibold">{risk.label}</div>
                  <div className="text-xs opacity-80">MW Status: <span style={{ color: mwStatus.color }}>{mwStatus.label}</span></div>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={windowData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" domain={[7, 18]} tick={{ fill: "#94a3b8", fontSize: 10 }} unit=" ppg" />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} width={80} />
                  <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                    formatter={(v: any) => [`${(+v).toFixed(2)} ppg`]} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {windowData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-slate-700/50 rounded p-2">
                  <div className="text-slate-400">OBG</div>
                  <div className="text-white font-medium">{(result.overburdenGradientPpg ?? 0).toFixed(2)} ppg</div>
                </div>
                <div className="bg-slate-700/50 rounded p-2">
                  <div className="text-slate-400">Shmin</div>
                  <div className="text-white font-medium">{(result.shminGradientPpg ?? 0).toFixed(2)} ppg</div>
                </div>
                <div className="bg-slate-700/50 rounded p-2">
                  <div className="text-slate-400">Window Width</div>
                  <div className="text-white font-medium">{(result.mwWindowWidthPpg ?? 0).toFixed(2)} ppg</div>
                </div>
                <div className="bg-slate-700/50 rounded p-2">
                  <div className="text-slate-400">Recommended MW</div>
                  <div className="text-cyan-400 font-bold">{(result.recommendedMwPpg ?? 0).toFixed(2)} ppg</div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}

function StressProfileTab() {
  const wellsQuery = trpc.wells.list.useQuery({ limit: 200 });
  const wells = wellsQuery.data && 'wells' in wellsQuery.data ? wellsQuery.data.wells : [];
  const [selectedWell, setSelectedWell] = useState("");
  const profileQuery = trpc.geomechanics.stressProfile.useQuery(
    { wellId: selectedWell },
    { enabled: !!selectedWell }
  );
  const profileData = profileQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <Label className="text-slate-300">Select Well</Label>
          <select className="w-full mt-1 bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
            value={selectedWell} onChange={(e) => setSelectedWell(e.target.value)}>
            <option value="">Select well...</option>
            {wells.map((w: any) => <option key={w.wellId} value={w.wellId}>{w.wellName}</option>)}
          </select>
        </div>
      </div>
      {profileData.length > 0 && (
        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader><CardTitle className="text-white text-sm">Depth-Based Stress Profile</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={profileData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" domain={[7, 20]} tick={{ fill: "#94a3b8", fontSize: 10 }} unit=" ppg" />
                <YAxis type="number" dataKey="depthFt" reversed tick={{ fill: "#94a3b8", fontSize: 10 }} unit=" ft" width={60} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                  formatter={(v: any) => [`${(+v).toFixed(2)} ppg`]} />
                <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 11 }} />
                <Line type="monotone" dataKey="overburdenPpg" stroke="#8b5cf6" strokeWidth={2} dot={false} name="OBG" />
                <Line type="monotone" dataKey="porePressurePpg" stroke="#06b6d4" strokeWidth={2} dot={false} name="Pore Pressure" />
                <Line type="monotone" dataKey="shminPpg" stroke="#f59e0b" strokeWidth={2} dot={false} name="Shmin" />
                <Line type="monotone" dataKey="fractureGradientPpg" stroke="#ef4444" strokeWidth={2} dot={false} name="Fracture Gradient" />
                <Line type="monotone" dataKey="collapseGradientPpg" stroke="#10b981" strokeWidth={2} dot={false} name="Collapse Gradient" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── LAS File Import Tab ───────────────────────────────────────────────────────
function LASImportTab() {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const wellsQuery = trpc.wells.list.useQuery({ limit: 200 });
  const wells = wellsQuery.data && 'wells' in wellsQuery.data ? wellsQuery.data.wells : [];
  const [selectedWell, setSelectedWell] = useState("");

  const parseLAS = (text: string) => {
    const lines = text.split(/\r?\n/);
    let currentSection = "";
    const data: number[][] = [];
    const mnemonics: string[] = [];
    let inData = false;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      if (line.startsWith("~")) {
        const sectionChar = line[1].toUpperCase();
        currentSection = sectionChar;
        inData = sectionChar === "A";
        continue;
      }
      if (inData) {
        const vals = line.split(/\s+/).map(Number).filter((v) => !isNaN(v));
        if (vals.length > 0) data.push(vals);
      } else if (currentSection === "C" && line.includes(".")) {
        const mnem = line.split(".")[0].trim();
        if (mnem) mnemonics.push(mnem);
      }
    }
    const columns: Record<string, number[]> = {};
    mnemonics.forEach((m, i) => { columns[m] = data.map((row) => row[i] ?? NaN); });
    const depthKey = mnemonics.find((m) => m.startsWith("DEPT")) ?? mnemonics[0];
    return { mnemonics, columns, depthKey, rowCount: data.length };
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setParsed(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const result = parseLAS(ev.target?.result as string);
        setParsed(result);
        toast.success(`LAS parsed: ${result.mnemonics.length} curves, ${result.rowCount} depth points`);
      } catch (err) { toast.error("LAS parse failed", { description: String(err) }); }
    };
    reader.readAsText(f);
  };

  const buildInputs = () => {
    if (!parsed || !selectedWell) return null;
    const depths = parsed.columns[parsed.depthKey] ?? [];
    const tvdFt = depths.length > 0 ? depths[Math.floor(depths.length / 2)] : 5000;
    const rhobKey = parsed.mnemonics.find((m: string) => m.includes("RHOB") || m.includes("DEN"));
    const dtKey = parsed.mnemonics.find((m: string) => m.includes("DT") || m.includes("DTCO"));
    const avgRhob = rhobKey && parsed.columns[rhobKey]
      ? parsed.columns[rhobKey].filter((v: number) => v > 1 && v < 3.5).reduce((a: number, b: number) => a + b, 0) / parsed.columns[rhobKey].length
      : 2.3;
    const avgDt = dtKey && parsed.columns[dtKey]
      ? parsed.columns[dtKey].filter((v: number) => v > 40 && v < 200).reduce((a: number, b: number) => a + b, 0) / parsed.columns[dtKey].length
      : 80;
    const vpFtS = 1e6 / Math.max(avgDt, 1);
    const ucsPsi = Math.max(500, Math.min(15000, 0.0045 * vpFtS - 1200));
    return { wellId: selectedWell, tvdFt, avgBulkDensityGcc: +avgRhob.toFixed(3), ucsPsi: Math.round(ucsPsi), currentMudWeightPpg: 9.0 };
  };

  const computeMutation = trpc.geomechanics.compute.useMutation({
    onSuccess: () => toast.success("Geomechanics model computed from LAS data"),
    onError: (e) => toast.error("Compute failed", { description: e.message }),
  });

  const handleImport = () => {
    const inputs = buildInputs();
    if (!inputs) { toast.error("Select a well and parse a LAS file first"); return; }
    setImporting(true);
    computeMutation.mutate(inputs, { onSettled: () => setImporting(false) });
  };

  const GEOMECH_CURVES = ["RHOB", "DEN", "DT", "DTCO", "GR", "NPHI", "RT", "CALI"];

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800/60 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2"><Upload className="w-5 h-5 text-purple-400" />LWD / Wireline LAS Import</CardTitle>
          <CardDescription className="text-slate-400">Upload a LAS 2.0 file. Curves are auto-mapped to geomechanics model inputs (RHOB → bulk density, DT → UCS via Militzer &amp; Stoll 1973).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Well</Label>
              <select className="w-full mt-1 bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                value={selectedWell} onChange={(e) => setSelectedWell(e.target.value)}>
                <option value="">Select well...</option>
                {wells.map((w: any) => <option key={w.wellId} value={w.wellId}>{w.wellName}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-slate-300">LAS File (.las)</Label>
              <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="file" accept=".las,.LAS" onChange={handleFile} />
            </div>
          </div>
          {file && <div className="flex items-center gap-2 text-sm text-slate-300"><FileText className="w-4 h-4 text-purple-400" />{file.name} ({(file.size / 1024).toFixed(1)} KB)</div>}
          {parsed && (
            <Button className="bg-purple-600 hover:bg-purple-700 text-white" disabled={!selectedWell || importing} onClick={handleImport}>
              {importing ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Computing...</> : "Compute Geomechanics Model from LAS"}
            </Button>
          )}
        </CardContent>
      </Card>
      {parsed && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-slate-800/60 border-slate-700">
            <CardHeader><CardTitle className="text-white text-sm">Detected Curves ({parsed.mnemonics.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {parsed.mnemonics.map((m: string) => (
                  <Badge key={m} variant="outline"
                    className={`text-xs ${GEOMECH_CURVES.some((g) => m.includes(g)) ? "border-purple-500/50 text-purple-300 bg-purple-500/10" : "border-slate-600 text-slate-400"}`}>
                    {m}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-3">Purple = auto-mapped to geomechanics model</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/60 border-slate-700">
            <CardHeader><CardTitle className="text-white text-sm">Derived Geomechanics Inputs</CardTitle></CardHeader>
            <CardContent>
              {(() => {
                const inputs = buildInputs();
                if (!inputs) return <p className="text-slate-400 text-sm">Select a well to preview</p>;
                return (
                  <div className="space-y-2 text-sm">
                    {([
                      ["TVD (median depth)", `${inputs.tvdFt.toFixed(0)} ft`],
                      ["Avg Bulk Density (RHOB)", `${inputs.avgBulkDensityGcc} g/cc`],
                      ["UCS (Militzer & Stoll 1973)", `${inputs.ucsPsi} psi`],
                      ["Starting Mud Weight", `${inputs.currentMudWeightPpg} ppg`],
                    ] as [string, string][]).map(([k, v]) => (
                      <div key={k} className="flex justify-between bg-slate-700/50 rounded px-3 py-1.5">
                        <span className="text-slate-400">{k}</span>
                        <span className="text-white font-medium">{v}</span>
                      </div>
                    ))}
                    <p className="text-xs text-slate-500 pt-1">Poisson ratio, Biot coefficient, and friction angle use defaults. Override in MEM Calculator.</p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
          {parsed.columns[parsed.depthKey] && (() => {
            const depths = parsed.columns[parsed.depthKey].slice(0, 100);
            const rhobKey = parsed.mnemonics.find((m: string) => m.includes("RHOB") || m.includes("DEN"));
            const dtKey = parsed.mnemonics.find((m: string) => m.includes("DT") || m.includes("DTCO"));
            const chartData = depths.map((d: number, i: number) => ({
              depth: d,
              rhob: rhobKey ? +(parsed.columns[rhobKey][i] ?? 0).toFixed(3) : undefined,
              dt: dtKey ? +(parsed.columns[dtKey][i] ?? 0).toFixed(1) : undefined,
            }));
            return (
              <Card className="bg-slate-800/60 border-slate-700 lg:col-span-2">
                <CardHeader><CardTitle className="text-white text-sm">Log Preview (first 100 depth points)</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="depth" stroke="#94a3b8" tick={{ fontSize: 11 }} label={{ value: "Depth (ft)", position: "insideBottom", offset: -2, fill: "#94a3b8", fontSize: 11 }} />
                        <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 6 }} labelStyle={{ color: "#e2e8f0" }} />
                        <Legend />
                        {rhobKey && <Line type="monotone" dataKey="rhob" name="RHOB (g/cc)" stroke="#a78bfa" dot={false} strokeWidth={1.5} />}
                        {dtKey && <Line type="monotone" dataKey="dt" name="DT (μs/ft)" stroke="#22d3ee" dot={false} strokeWidth={1.5} />}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Depth range: {Math.min(...depths).toFixed(0)} – {Math.max(...depths).toFixed(0)} ft | {parsed.rowCount} total rows</p>
                </CardContent>
              </Card>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export default function WellboreGeomechanicsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Layers className="w-7 h-7 text-purple-400" />
            Wellbore Geomechanics
          </h1>
          <p className="text-slate-400 mt-1">1D MEM · Mud weight window · Pore pressure prediction · Wellbore stability</p>
        </div>
        <Badge variant="outline" className="border-purple-500/40 text-purple-400 bg-purple-500/10">
          Eaton / Mohr-Coulomb
        </Badge>
      </div>

      <SummaryCards />

      <Tabs defaultValue="compute">
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="compute" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">MEM Calculator</TabsTrigger>
          <TabsTrigger value="profile" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">Stress Profile</TabsTrigger>
          <TabsTrigger value="las" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">LAS Import</TabsTrigger>
          <TabsTrigger value="rust" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white flex items-center gap-1"><Cpu className="w-3 h-3" />Rust Engine</TabsTrigger>
        </TabsList>
        <TabsContent value="compute" className="mt-4"><MEMComputeForm /></TabsContent>
        <TabsContent value="profile" className="mt-4"><StressProfileTab /></TabsContent>
        <TabsContent value="las" className="mt-4"><LASImportTab /></TabsContent>
        <TabsContent value="rust" className="mt-4"><RustGeomechanicsPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
