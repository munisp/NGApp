/**
 * SandManagement.tsx
 * Sand production risk assessment using Mohr-Coulomb critical drawdown model.
 * Covers sand onset prediction, control method tracking, and risk monitoring.
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
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Legend,
} from "recharts";
import { toast } from "sonner";
import { Zap, AlertTriangle, Shield, RefreshCw, Activity, Cpu } from "lucide-react";

// ── Rust Physics Engine: Sand Onset Panel ─────────────────────────────────
function RustSandOnsetPanel() {
  const wellsQuery = trpc.wells.list.useQuery({ limit: 200 });
  const wellsList = wellsQuery.data && 'wells' in wellsQuery.data ? (wellsQuery.data as any).wells : [];
  const [wellId, setWellId] = useState("");
  const [tvd, setTvd] = useState(8500);
  const [resPressure, setResPressure] = useState(3200);
  const [bhfp, setBhfp] = useState(2400);
  const [ucs, setUcs] = useState(3000);
  const [currentRate, setCurrentRate] = useState(800);
  const [completionType, setCompletionType] = useState<"OPEN_HOLE"|"CASED_PERFORATED"|"GRAVEL_PACK"|"FRAC_PACK"|"EXPANDABLE_SAND_SCREEN"|"STANDALONE_SCREEN">("CASED_PERFORATED");
  const sandMutation = trpc.physicsEngine.sandOnset.useMutation({
    onError: (e) => toast.error(`Rust engine error: ${e.message}`),
  });
  const result = sandMutation.data as any;
  const riskColor = result?.sanding_index > 1.0 ? "red" : result?.sanding_index > 0.7 ? "yellow" : "green";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Cpu className="w-5 h-5 text-orange-400" />
        <span className="text-white font-semibold">Rust Physics Engine — Mohr-Coulomb Sand Onset</span>
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
        <div><Label className="text-slate-300 text-xs">TVD (ft)</Label>
          <Input type="number" value={tvd} onChange={e => setTvd(+e.target.value)} className="bg-slate-700 border-slate-600 text-white mt-1" /></div>
        <div><Label className="text-slate-300 text-xs">Reservoir Pressure (psia)</Label>
          <Input type="number" value={resPressure} onChange={e => setResPressure(+e.target.value)} className="bg-slate-700 border-slate-600 text-white mt-1" /></div>
        <div><Label className="text-slate-300 text-xs">BHFP (psia)</Label>
          <Input type="number" value={bhfp} onChange={e => setBhfp(+e.target.value)} className="bg-slate-700 border-slate-600 text-white mt-1" /></div>
        <div><Label className="text-slate-300 text-xs">UCS (psi)</Label>
          <Input type="number" value={ucs} onChange={e => setUcs(+e.target.value)} className="bg-slate-700 border-slate-600 text-white mt-1" /></div>
        <div><Label className="text-slate-300 text-xs">Current Rate (BPD)</Label>
          <Input type="number" value={currentRate} onChange={e => setCurrentRate(+e.target.value)} className="bg-slate-700 border-slate-600 text-white mt-1" /></div>
        <div>
          <Label className="text-slate-300 text-xs">Completion Type</Label>
          <select value={completionType} onChange={e => setCompletionType(e.target.value as any)}
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-md px-2 py-1.5 text-sm mt-1">
            {[["OPEN_HOLE","Open Hole"],["CASED_PERFORATED","Cased Perforated"],["GRAVEL_PACK","Gravel Pack"],["FRAC_PACK","Frac Pack"],["EXPANDABLE_SAND_SCREEN","Expandable Sand Screen"],["STANDALONE_SCREEN","Standalone Screen"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <Button onClick={() => sandMutation.mutate({ wellId: wellId || "RUST-TEST", tvdFt: tvd, reservoirPressurePsia: resPressure, bhfpPsia: bhfp, ucsPsi: ucs, currentRateBpd: currentRate, completionType })}
        disabled={sandMutation.isPending} className="bg-orange-600 hover:bg-orange-700 text-white">
        {sandMutation.isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Computing...</> : <><Cpu className="w-4 h-4 mr-2" />Run Rust Sand Onset Analysis</>}
      </Button>
      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {label: "Critical Drawdown", value: `${result.critical_drawdown_psi?.toFixed(0) ?? "—"} psi`, color: "cyan"},
              {label: "Current Drawdown", value: `${result.current_drawdown_psi?.toFixed(0) ?? "—"} psi`, color: "blue"},
              {label: "Sanding Index", value: result.sanding_index?.toFixed(3) ?? "—", color: riskColor},
              {label: "Sand Risk", value: result.sand_risk ?? "—", color: riskColor},
            ].map(item => (
              <Card key={item.label} className="bg-slate-800/60 border-slate-700">
                <CardContent className="pt-3 pb-3">
                  <p className="text-slate-400 text-xs">{item.label}</p>
                  <p className={`text-lg font-bold text-${item.color}-400`}>{item.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          {result.recommendations?.length > 0 && (
            <div className="bg-slate-800/40 border border-orange-700/40 rounded p-3">
              <p className="text-orange-300 text-xs font-medium mb-1">Rust Engine Recommendations</p>
              {result.recommendations.map((r: string, i: number) => <p key={i} className="text-white text-sm mt-1">{r}</p>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const RISK_CONFIG = {
  LOW: { color: "#10b981", bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", label: "Low" },
  MODERATE: { color: "#f59e0b", bg: "bg-amber-500/10 text-amber-400 border-amber-500/30", label: "Moderate" },
  HIGH: { color: "#f97316", bg: "bg-orange-500/10 text-orange-400 border-orange-500/30", label: "High" },
  CRITICAL: { color: "#ef4444", bg: "bg-red-500/10 text-red-400 border-red-500/30", label: "Critical" },
};

const CONTROL_METHODS: Record<string, string> = {
  NONE: "None",
  CHOKEBACK: "Chokeback",
  GRAVEL_PACK: "Gravel Pack",
  FRAC_PACK: "Frac Pack",
  EXPANDABLE_SAND_SCREEN: "Expandable Screen",
  STANDALONE_SCREEN: "Standalone Screen",
  CHEMICAL_CONSOLIDATION: "Chemical Consolidation",
};

function SummaryCards() {
  const { data } = trpc.sandManagement.summary.useQuery();
  if (!data) return null;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-slate-800/60 border-slate-700">
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-white">{data.totalRecords}</div>
          <div className="text-xs text-slate-400 mt-1">Total Analyses</div>
        </CardContent>
      </Card>
      <Card className="bg-red-900/20 border-red-700/40">
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-red-400">{data.criticalWells}</div>
          <div className="text-xs text-slate-400 mt-1">Critical Risk Wells</div>
        </CardContent>
      </Card>
      <Card className="bg-orange-900/20 border-orange-700/40">
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-orange-400">{data.highRiskWells}</div>
          <div className="text-xs text-slate-400 mt-1">High Risk Wells</div>
        </CardContent>
      </Card>
      <Card className="bg-slate-800/60 border-slate-700">
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-yellow-400">{(data.avgSandRateMgL ?? 0).toFixed(1)}</div>
          <div className="text-xs text-slate-400 mt-1">Avg Sand Rate (mg/L)</div>
        </CardContent>
      </Card>
    </div>
  );
}

function SandAnalysisForm() {
  const wellsQuery = trpc.wells.list.useQuery({ limit: 200 });
  const wells = wellsQuery.data && 'wells' in wellsQuery.data ? wellsQuery.data.wells : [];
  const [form, setForm] = useState({
    wellId: "",
    drawdownPsi: 500,
    flowRateBpd: 1000,
    waterCut: 0.2,
    sandRateMgL: 50,
    ucsPsi: 2500,
    frictionAngleDeg: 28,
    porosityFraction: 0.22,
    sandControlMethod: "NONE" as any,
    completionType: "CASED_PERFORATED" as any,
  });
  const [result, setResult] = useState<any>(null);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const analyzeMutation = trpc.sandManagement.analyze.useMutation({
    onSuccess: (data) => {
      setResult(data);
      const risk = RISK_CONFIG[data.sandRisk as keyof typeof RISK_CONFIG];
      toast.success(`Sand Risk: ${risk?.label}`, {
        description: `Critical drawdown: ${(data.criticalDrawdownPsi ?? 0).toFixed(0)} psi | Safety margin: ${(data.safetyMarginPsi ?? 0).toFixed(0)} psi`,
      });
    },
    onError: (e) => toast.error("Analysis failed", { description: e.message }),
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="bg-slate-800/60 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Sand Onset Analysis
          </CardTitle>
          <CardDescription className="text-slate-400">
            Mohr-Coulomb critical drawdown model for sand production onset prediction
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
              <Label className="text-slate-300">Drawdown (psi)</Label>
              <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number"
                value={form.drawdownPsi} onChange={(e) => set("drawdownPsi", +e.target.value)} />
            </div>
            <div>
              <Label className="text-slate-300">Flow Rate (bpd)</Label>
              <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number"
                value={form.flowRateBpd} onChange={(e) => set("flowRateBpd", +e.target.value)} />
            </div>
            <div>
              <Label className="text-slate-300">Water Cut</Label>
              <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" step="0.01" min="0" max="1"
                value={form.waterCut} onChange={(e) => set("waterCut", +e.target.value)} />
            </div>
            <div>
              <Label className="text-slate-300">Sand Rate (mg/L)</Label>
              <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number"
                value={form.sandRateMgL} onChange={(e) => set("sandRateMgL", +e.target.value)} />
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
              <Label className="text-slate-300">Porosity</Label>
              <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" step="0.01"
                value={form.porosityFraction} onChange={(e) => set("porosityFraction", +e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-slate-300">Sand Control Method</Label>
            <select className="w-full mt-1 bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
              value={form.sandControlMethod} onChange={(e) => set("sandControlMethod", e.target.value)}>
              {Object.entries(CONTROL_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <Button className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
            disabled={!form.wellId || analyzeMutation.isPending}
            onClick={() => analyzeMutation.mutate({ ...form, wellId: form.wellId })}>
            {analyzeMutation.isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Analyzing...</> : "Run Sand Analysis"}
          </Button>
        </CardContent>
      </Card>

      {result && (() => {
        const risk = RISK_CONFIG[result.sandRisk as keyof typeof RISK_CONFIG] ?? RISK_CONFIG.MODERATE;
        const safetyPct = result.criticalDrawdownPsi > 0
          ? Math.max(0, Math.min(100, (result.safetyMarginPsi / result.criticalDrawdownPsi) * 100))
          : 0;
        return (
          <Card className="bg-slate-800/60 border-slate-700">
            <CardHeader><CardTitle className="text-white flex items-center gap-2"><Shield className="w-5 h-5 text-yellow-400" />Analysis Results</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className={`flex items-center gap-3 p-3 rounded-lg border ${risk.bg}`}>
                <AlertTriangle className="w-5 h-5" />
                <div>
                  <div className="font-semibold">Sand Risk: {risk.label}</div>
                  <div className="text-xs opacity-80">Safety margin: {(result.safetyMarginPsi ?? 0).toFixed(0)} psi</div>
                </div>
              </div>

              {/* Safety margin bar */}
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Safety Margin</span>
                  <span>{safetyPct.toFixed(0)}%</span>
                </div>
                <div className="bg-slate-700 rounded-full h-3">
                  <div className="h-3 rounded-full transition-all" style={{ width: `${safetyPct}%`, background: risk.color }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-700/50 rounded p-2">
                  <div className="text-slate-400">Critical Drawdown</div>
                  <div className="text-white font-medium">{(result.criticalDrawdownPsi ?? 0).toFixed(0)} psi</div>
                </div>
                <div className="bg-slate-700/50 rounded p-2">
                  <div className="text-slate-400">Actual Drawdown</div>
                  <div className="text-white font-medium">{(result.drawdownPsi ?? 0).toFixed(0)} psi</div>
                </div>
                <div className="bg-slate-700/50 rounded p-2">
                  <div className="text-slate-400">Sand Rate</div>
                  <div className="text-white font-medium">{(result.sandRateMgL ?? 0).toFixed(1)} mg/L</div>
                </div>
                <div className="bg-slate-700/50 rounded p-2">
                  <div className="text-slate-400">Control Method</div>
                  <div className="text-white font-medium text-xs">{CONTROL_METHODS[result.sandControlMethod] ?? result.sandControlMethod}</div>
                </div>
              </div>

              {result.sandRisk === "CRITICAL" && (
                <div className="p-3 bg-red-900/20 border border-red-700/40 rounded-lg text-sm text-red-300">
                  <strong>Immediate action required:</strong> Reduce drawdown below {(result.criticalDrawdownPsi ?? 0).toFixed(0)} psi or implement sand control.
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}

function SandHistoryTab() {
  const { data: records, refetch } = trpc.sandManagement.list.useQuery({});
  const recordsArr = records ?? [];

  const riskDist = recordsArr.reduce((acc: Record<string, number>, r: any) => {
    acc[r.sandRisk] = (acc[r.sandRisk] ?? 0) + 1;
    return acc;
  }, {});
  const barData = Object.entries(riskDist).map(([risk, count]) => ({
    risk: RISK_CONFIG[risk as keyof typeof RISK_CONFIG]?.label ?? risk,
    count,
    fill: RISK_CONFIG[risk as keyof typeof RISK_CONFIG]?.color ?? "#64748b",
  }));

  const scatterData = recordsArr.slice(0, 50).map((r: any) => ({
    drawdown: r.drawdownPsi,
    sandRate: r.sandRateMgL ?? 0,
    risk: r.sandRisk,
    fill: RISK_CONFIG[r.sandRisk as keyof typeof RISK_CONFIG]?.color ?? "#64748b",
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
          <CardHeader><CardTitle className="text-white text-sm">Risk Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="risk" tick={{ fill: "#94a3b8", fontSize: 10 }} />
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
          <CardHeader><CardTitle className="text-white text-sm">Drawdown vs Sand Rate</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="drawdown" name="Drawdown" unit=" psi" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis dataKey="sandRate" name="Sand Rate" unit=" mg/L" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} cursor={{ strokeDasharray: "3 3" }} />
                <Scatter data={scatterData} fill="#f59e0b">
                  {scatterData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-800/60 border-slate-700">
        <CardHeader><CardTitle className="text-white text-sm">Recent Records</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="text-left py-2 px-3">Well</th>
                  <th className="text-left py-2 px-3">Risk</th>
                  <th className="text-right py-2 px-3">Drawdown</th>
                  <th className="text-right py-2 px-3">Critical DD</th>
                  <th className="text-right py-2 px-3">Sand Rate</th>
                  <th className="text-left py-2 px-3">Control</th>
                  <th className="text-left py-2 px-3">Recorded</th>
                </tr>
              </thead>
              <tbody>
                {recordsArr.slice(0, 15).map((r: any) => {
                  const cfg = RISK_CONFIG[r.sandRisk as keyof typeof RISK_CONFIG];
                  return (
                    <tr key={r.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-2 px-3 text-white font-mono text-xs">{r.wellId}</td>
                      <td className="py-2 px-3"><Badge variant="outline" className={`text-xs ${cfg?.bg}`}>{cfg?.label ?? r.sandRisk}</Badge></td>
                      <td className="py-2 px-3 text-right text-slate-300">{(r.drawdownPsi ?? 0).toFixed(0)} psi</td>
                      <td className="py-2 px-3 text-right text-slate-300">{(r.criticalDrawdownPsi ?? 0).toFixed(0)} psi</td>
                      <td className="py-2 px-3 text-right text-slate-300">{r.sandRateMgL != null ? `${r.sandRateMgL.toFixed(1)} mg/L` : "—"}</td>
                      <td className="py-2 px-3 text-slate-300 text-xs">{CONTROL_METHODS[r.sandControlMethod] ?? r.sandControlMethod}</td>
                      <td className="py-2 px-3 text-slate-400 text-xs">{new Date(r.recordedAt).toLocaleString()}</td>
                    </tr>
                  );
                })}
                {recordsArr.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-500">No records yet. Run an analysis above.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SandManagementPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="w-7 h-7 text-yellow-400" />
            Sand Production Management
          </h1>
          <p className="text-slate-400 mt-1">Mohr-Coulomb onset model · Gravel pack · Frac pack · Sand screen · Chemical consolidation</p>
        </div>
        <Badge variant="outline" className="border-yellow-500/40 text-yellow-400 bg-yellow-500/10">
          Mohr-Coulomb Model
        </Badge>
      </div>
      <SummaryCards />
      <Tabs defaultValue="analyze">
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="analyze" className="data-[state=active]:bg-yellow-600 data-[state=active]:text-white">Sand Analysis</TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-yellow-600 data-[state=active]:text-white">History</TabsTrigger>
          <TabsTrigger value="rust" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white flex items-center gap-1"><Cpu className="w-3 h-3" />Rust Engine</TabsTrigger>
        </TabsList>
        <TabsContent value="analyze" className="mt-4"><SandAnalysisForm /></TabsContent>
        <TabsContent value="history" className="mt-4"><SandHistoryTab /></TabsContent>
        <TabsContent value="rust" className="mt-4"><RustSandOnsetPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
