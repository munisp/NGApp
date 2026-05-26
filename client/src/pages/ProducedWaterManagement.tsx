/**
 * ProducedWaterManagement.tsx
 * Daily water balance, quality compliance (EPA/BSEE), recycling rate tracking,
 * and environmental risk monitoring for produced water.
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
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";
import { toast } from "sonner";
import { Droplets, AlertTriangle, CheckCircle2, RefreshCw, Plus, Recycle } from "lucide-react";

const QUALITY_CONFIG = {
  COMPLIANT: { color: "#10b981", bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", label: "Compliant" },
  MARGINAL: { color: "#f59e0b", bg: "bg-amber-500/10 text-amber-400 border-amber-500/30", label: "Marginal" },
  NON_COMPLIANT: { color: "#ef4444", bg: "bg-red-500/10 text-red-400 border-red-500/30", label: "Non-Compliant" },
};

function SummaryCards() {
  const { data } = trpc.producedWater.summary.useQuery();
  if (!data) return null;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-slate-800/60 border-slate-700">
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-blue-400">{(data.totalProducedBbl ?? 0).toLocaleString()}</div>
          <div className="text-xs text-slate-400 mt-1">Produced (bbl/30d)</div>
        </CardContent>
      </Card>
      <Card className="bg-slate-800/60 border-slate-700">
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-cyan-400">{(data.injectionEfficiencyPct ?? 0).toFixed(1)}%</div>
          <div className="text-xs text-slate-400 mt-1">Injection Efficiency</div>
        </CardContent>
      </Card>
      <Card className="bg-emerald-900/20 border-emerald-700/40">
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-emerald-400">{(data.avgRecyclingRatePct ?? 0).toFixed(1)}%</div>
          <div className="text-xs text-slate-400 mt-1">Avg Recycling Rate</div>
        </CardContent>
      </Card>
      <Card className={data.nonCompliantDays > 0 ? "bg-red-900/20 border-red-700/40" : "bg-slate-800/60 border-slate-700"}>
        <CardContent className="pt-4">
          <div className={`text-2xl font-bold ${data.nonCompliantDays > 0 ? "text-red-400" : "text-white"}`}>{data.nonCompliantDays}</div>
          <div className="text-xs text-slate-400 mt-1">Non-Compliant Days</div>
        </CardContent>
      </Card>
    </div>
  );
}

function RecordWaterForm() {
  const [form, setForm] = useState({
    fieldId: "FIELD-001",
    producedWaterBbl: 5000,
    injectedWaterBbl: 3000,
    disposedWaterBbl: 1000,
    recycledWaterBbl: 500,
    evaporatedWaterBbl: 200,
    oilInWaterMgL: 12,
    tssMgL: 50,
    phValue: 7.2,
    chlorideMgL: 15000,
    treatmentCostUsd: 8500,
  });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const recordMutation = trpc.producedWater.record.useMutation({
    onSuccess: (data) => {
      const q = QUALITY_CONFIG[data.waterQualityStatus as keyof typeof QUALITY_CONFIG];
      toast.success(`Water Balance Recorded: ${q?.label}`, {
        description: `Balance: ${(data.waterBalanceBbl ?? 0).toFixed(0)} bbl | Recycling: ${(data.recyclingRatePct ?? 0).toFixed(1)}%`,
      });
    },
    onError: (e) => toast.error("Failed", { description: e.message }),
  });

  return (
    <Card className="bg-slate-800/60 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Plus className="w-5 h-5 text-blue-400" />
          Record Daily Water Balance
        </CardTitle>
        <CardDescription className="text-slate-400">
          EPA/BSEE compliance: Oil-in-water limit 29 mg/L (offshore) · 15 mg/L (monthly avg)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label className="text-slate-300">Field ID</Label>
            <Input className="bg-slate-700 border-slate-600 text-white mt-1" value={form.fieldId} onChange={(e) => set("fieldId", e.target.value)} />
          </div>
          <div>
            <Label className="text-slate-300">Produced Water (bbl)</Label>
            <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" value={form.producedWaterBbl} onChange={(e) => set("producedWaterBbl", +e.target.value)} />
          </div>
          <div>
            <Label className="text-slate-300">Injected (bbl)</Label>
            <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" value={form.injectedWaterBbl} onChange={(e) => set("injectedWaterBbl", +e.target.value)} />
          </div>
          <div>
            <Label className="text-slate-300">Disposed (bbl)</Label>
            <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" value={form.disposedWaterBbl} onChange={(e) => set("disposedWaterBbl", +e.target.value)} />
          </div>
          <div>
            <Label className="text-slate-300">Recycled (bbl)</Label>
            <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" value={form.recycledWaterBbl} onChange={(e) => set("recycledWaterBbl", +e.target.value)} />
          </div>
          <div>
            <Label className="text-slate-300">Evaporated (bbl)</Label>
            <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" value={form.evaporatedWaterBbl} onChange={(e) => set("evaporatedWaterBbl", +e.target.value)} />
          </div>
          <div>
            <Label className="text-slate-300">Oil-in-Water (mg/L)</Label>
            <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" step="0.1" value={form.oilInWaterMgL} onChange={(e) => set("oilInWaterMgL", +e.target.value)} />
          </div>
          <div>
            <Label className="text-slate-300">TSS (mg/L)</Label>
            <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" value={form.tssMgL} onChange={(e) => set("tssMgL", +e.target.value)} />
          </div>
          <div>
            <Label className="text-slate-300">pH</Label>
            <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" step="0.1" value={form.phValue} onChange={(e) => set("phValue", +e.target.value)} />
          </div>
          <div>
            <Label className="text-slate-300">Chloride (mg/L)</Label>
            <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" value={form.chlorideMgL} onChange={(e) => set("chlorideMgL", +e.target.value)} />
          </div>
          <div>
            <Label className="text-slate-300">Treatment Cost (USD)</Label>
            <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" value={form.treatmentCostUsd} onChange={(e) => set("treatmentCostUsd", +e.target.value)} />
          </div>
        </div>
        <Button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white" disabled={recordMutation.isPending}
          onClick={() => recordMutation.mutate(form)}>
          {recordMutation.isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Recording...</> : "Record Water Balance"}
        </Button>
      </CardContent>
    </Card>
  );
}

function WaterTrendsTab() {
  const { data: records, refetch } = trpc.producedWater.list.useQuery({ days: 30 });
  const recordsArr = (records ?? []).slice().reverse();

  const trendData = recordsArr.map((r: any, i: number) => ({
    day: `D${i + 1}`,
    produced: r.producedWaterBbl ?? 0,
    injected: r.injectedWaterBbl ?? 0,
    recycled: r.recycledWaterBbl ?? 0,
    disposed: r.disposedWaterBbl ?? 0,
    oilInWater: r.oilInWaterMgL ?? 0,
  }));

  const qualityData = (records ?? []).reduce((acc: Record<string, number>, r: any) => {
    acc[r.waterQualityStatus] = (acc[r.waterQualityStatus] ?? 0) + 1;
    return acc;
  }, {});
  const qualityBarData = Object.entries(qualityData).map(([status, count]) => ({
    status: QUALITY_CONFIG[status as keyof typeof QUALITY_CONFIG]?.label ?? status,
    count,
    fill: QUALITY_CONFIG[status as keyof typeof QUALITY_CONFIG]?.color ?? "#64748b",
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
          <CardHeader><CardTitle className="text-white text-sm">Water Volume Trend (30d)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
                <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 11 }} />
                <Area type="monotone" dataKey="produced" stackId="1" stroke="#3b82f6" fill="#3b82f620" name="Produced" />
                <Area type="monotone" dataKey="injected" stackId="2" stroke="#06b6d4" fill="#06b6d420" name="Injected" />
                <Area type="monotone" dataKey="recycled" stackId="3" stroke="#10b981" fill="#10b98120" name="Recycled" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader><CardTitle className="text-white text-sm">Quality Compliance</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={qualityBarData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="status" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {qualityBarData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
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
                  <th className="text-left py-2 px-3">Date</th>
                  <th className="text-left py-2 px-3">Quality</th>
                  <th className="text-right py-2 px-3">Produced</th>
                  <th className="text-right py-2 px-3">Injected</th>
                  <th className="text-right py-2 px-3">Recycled</th>
                  <th className="text-right py-2 px-3">OiW (mg/L)</th>
                  <th className="text-right py-2 px-3">Recycling %</th>
                </tr>
              </thead>
              <tbody>
                {(records ?? []).slice(0, 15).map((r: any) => {
                  const q = QUALITY_CONFIG[r.waterQualityStatus as keyof typeof QUALITY_CONFIG];
                  return (
                    <tr key={r.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-2 px-3 text-slate-300 text-xs">{new Date(r.recordDate).toLocaleDateString()}</td>
                      <td className="py-2 px-3"><Badge variant="outline" className={`text-xs ${q?.bg}`}>{q?.label ?? r.waterQualityStatus}</Badge></td>
                      <td className="py-2 px-3 text-right text-white">{(r.producedWaterBbl ?? 0).toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-slate-300">{(r.injectedWaterBbl ?? 0).toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-slate-300">{(r.recycledWaterBbl ?? 0).toLocaleString()}</td>
                      <td className="py-2 px-3 text-right" style={{ color: (r.oilInWaterMgL ?? 0) > 29 ? "#ef4444" : "#94a3b8" }}>{r.oilInWaterMgL ?? "—"}</td>
                      <td className="py-2 px-3 text-right text-slate-300">{(r.recyclingRatePct ?? 0).toFixed(1)}%</td>
                    </tr>
                  );
                })}
                {(records ?? []).length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-500">No records yet. Record a water balance above.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProducedWaterManagementPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Droplets className="w-7 h-7 text-blue-400" />
            Produced Water Management
          </h1>
          <p className="text-slate-400 mt-1">Water balance · EPA/BSEE compliance · Recycling rate · Treatment cost tracking</p>
        </div>
        <Badge variant="outline" className="border-blue-500/40 text-blue-400 bg-blue-500/10">
          EPA/BSEE Compliant
        </Badge>
      </div>
      <SummaryCards />
      <Tabs defaultValue="record">
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="record" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Record Balance</TabsTrigger>
          <TabsTrigger value="trends" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Trends & Compliance</TabsTrigger>
        </TabsList>
        <TabsContent value="record" className="mt-4"><RecordWaterForm /></TabsContent>
        <TabsContent value="trends" className="mt-4"><WaterTrendsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
