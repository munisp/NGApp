/**
 * Safety Instrumented Systems (SIS) Integration Panel
 * Design: Dark Amber — OG-RMM Platform
 *
 * Gap Closure: G-09 — SIS Integration + G-10 — Multi-Tenant Isolation
 * Features:
 *   - SIF (Safety Instrumented Function) status per well/facility — live from sil.listFunctions
 *   - SIL verification status (SIL-1 to SIL-4) — live from sil.getSummary
 *   - Proof test scheduling and compliance — live from sil.getOverdueFunctions
 *   - ESD trip log — live from sil.listTestRecords
 *   - IEC 61511 compliance summary — live from silCertification.summary
 *   - Multi-tenant organization isolation view
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend
} from "recharts";
import {
  ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2,
  Clock, Zap, Lock, Users, Building2, RefreshCw,
  Activity, FileText, Eye, Plus, PlusCircle
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type SIFStatus = "design" | "operational" | "bypassed" | "maintenance" | "decommissioned";

// ── Helpers ───────────────────────────────────────────────────────────────────

function silStatusConfig(status: string) {
  const map: Record<string, { color: string; bg: string; label: string; dot: string }> = {
    operational: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-700/30", label: "Operational", dot: "bg-emerald-400" },
    bypassed:    { color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-700/30",     label: "Bypassed",    dot: "bg-amber-400" },
    design:      { color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-700/30",       label: "Design",      dot: "bg-blue-400" },
    maintenance: { color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-700/30",   label: "Maintenance", dot: "bg-orange-400" },
    decommissioned: { color: "text-slate-400", bg: "bg-slate-500/10 border-slate-700/30",    label: "Decommissioned", dot: "bg-slate-400" },
  };
  return map[status] ?? map["design"];
}

function silColor(achieved: number | null, required: number) {
  if (!achieved) return "text-slate-400";
  if (achieved >= required) return "text-emerald-400";
  if (achieved === required - 1) return "text-amber-400";
  return "text-red-400";
}

function pfdStatus(nextTestDue: Date | null): { color: string; label: string } {
  if (!nextTestDue) return { color: "text-slate-400", label: "No schedule" };
  const now = new Date();
  const due = new Date(nextTestDue);
  const daysLeft = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { color: "text-red-400", label: `Overdue ${Math.abs(daysLeft)}d` };
  if (daysLeft < 30) return { color: "text-amber-400", label: `Due in ${daysLeft}d` };
  return { color: "text-emerald-400", label: `Due ${due.toLocaleDateString()}` };
}

// ── Multi-tenant static data (SaaS isolation model) ───────────────────────────

const TENANTS = [
  { tenant_id: "T-001", name: "WT Petrotech USA", tier: "ENTERPRISE", wells: 142, users: 48, data_isolation: "CLUSTER", region: "us-east-1", status: "ACTIVE", storage_gb: 2840 },
  { tenant_id: "T-002", name: "Permian Basin Ops LLC", tier: "PROFESSIONAL", wells: 38, users: 12, data_isolation: "DATABASE", region: "us-west-2", status: "ACTIVE", storage_gb: 420 },
  { tenant_id: "T-003", name: "Eagle Ford Energy Co.", tier: "PROFESSIONAL", wells: 24, users: 8, data_isolation: "DATABASE", region: "us-east-1", status: "ACTIVE", storage_gb: 280 },
  { tenant_id: "T-004", name: "Bakken Resources Inc.", tier: "STARTER", wells: 12, users: 4, data_isolation: "SCHEMA", region: "us-central-1", status: "ACTIVE", storage_gb: 95 },
  { tenant_id: "T-005", name: "Offshore Gulf LLC", tier: "ENTERPRISE", wells: 18, users: 22, data_isolation: "CLUSTER", region: "us-south-1", status: "SUSPENDED", storage_gb: 1120 },
];

function tierColor(tier: string) {
  const map: Record<string, string> = { ENTERPRISE: "text-amber-400", PROFESSIONAL: "text-blue-400", STARTER: "text-muted-foreground" };
  return map[tier] ?? "text-muted-foreground";
}

// ── Create SIF Dialog ─────────────────────────────────────────────────────────

function CreateSIFDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    functionId: "",
    name: "",
    description: "",
    processHazard: "",
    targetSil: "2",
    status: "design",
  });

  const createMutation = trpc.sil.createFunction.useMutation({
    onSuccess: () => {
      toast.success("SIF created", { description: `${form.name} added to the SIL register` });
      utils.sil.listFunctions.invalidate();
      utils.sil.getSummary.invalidate();
      onClose();
    },
    onError: (e) => toast.error("Failed to create SIF", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-[Syne] font-bold">New Safety Instrumented Function</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Function ID</Label>
              <Input className="h-8 text-xs mt-1" placeholder="SIF-006" value={form.functionId} onChange={e => setForm(f => ({ ...f, functionId: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Target SIL</Label>
              <Select value={form.targetSil} onValueChange={v => setForm(f => ({ ...f, targetSil: v }))}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">SIL-1</SelectItem>
                  <SelectItem value="2">SIL-2</SelectItem>
                  <SelectItem value="3">SIL-3</SelectItem>
                  <SelectItem value="4">SIL-4</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Function Name</Label>
            <Input className="h-8 text-xs mt-1" placeholder="HIPPS — Wellhead Train A" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Process Hazard</Label>
            <Input className="h-8 text-xs mt-1" placeholder="Overpressure — wellhead header" value={form.processHazard} onChange={e => setForm(f => ({ ...f, processHazard: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Input className="h-8 text-xs mt-1" placeholder="Brief description of safeguard" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="design">Design</SelectItem>
                <SelectItem value="operational">Operational</SelectItem>
                <SelectItem value="bypassed">Bypassed</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
            disabled={createMutation.isPending || !form.functionId || !form.name}
            onClick={() => createMutation.mutate({
              functionId: form.functionId,
              name: form.name,
              description: form.description || undefined,
              processHazard: form.processHazard || undefined,
              targetSil: parseInt(form.targetSil),
              status: form.status,
            })}
          >
            {createMutation.isPending ? "Creating…" : "Create SIF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SISPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedSifId, setSelectedSifId] = useState<number | null>(null);

  // Live data from sil router
  const { data: silFunctions = [], isLoading: sifsLoading, refetch: refetchSifs } = trpc.sil.listFunctions.useQuery();
  const { data: silSummary, refetch: refetchSummary } = trpc.sil.getSummary.useQuery();
  const { data: overdueFunctions = [] } = trpc.sil.getOverdueFunctions.useQuery();

  // IEC 61511 compliance from silCertification router
  const { data: certSummary } = trpc.silCertification.summary.useQuery();
  const { data: wellAssessments = [] } = trpc.silCertification.listWellAssessments.useQuery();

  // Test records for selected SIF
  const { data: testRecords = [] } = trpc.sil.listTestRecords.useQuery(
    { silFunctionId: selectedSifId! },
    { enabled: !!selectedSifId }
  );

  const utils = trpc.useUtils();
  const updateMutation = trpc.sil.updateFunction.useMutation({
    onSuccess: () => {
      toast.success("SIF updated");
      utils.sil.listFunctions.invalidate();
      utils.sil.getSummary.invalidate();
    },
    onError: (e) => toast.error("Update failed", { description: e.message }),
  });

  const handleRefresh = () => {
    refetchSifs();
    refetchSummary();
    toast.success("Safety system status refreshed");
  };

  // Derived stats from live data
  const degradedSIFs = silFunctions.filter(s => s.achievedSil !== null && s.achievedSil < s.targetSil).length;
  const bypassedSIFs = silFunctions.filter(s => s.status === "bypassed").length;
  const overdueTests = overdueFunctions.length;
  const totalFunctions = silFunctions.length;

  // Build SIL distribution chart data
  const silDistribution = [1, 2, 3, 4].map(level => ({
    name: `SIL-${level}`,
    count: silFunctions.filter(f => f.targetSil === level).length,
    fill: level === 4 ? "#ef4444" : level === 3 ? "#f59e0b" : level === 2 ? "#3b82f6" : "#10b981",
  })).filter(d => d.count > 0);

  // Build status distribution for pie chart
  const statusDistribution = Object.entries(
    silFunctions.reduce<Record<string, number>>((acc, f) => {
      acc[f.status] = (acc[f.status] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <CreateSIFDialog open={showCreate} onClose={() => setShowCreate(false)} />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-[Syne] font-black text-2xl text-foreground tracking-tight">
            Safety Instrumented Systems
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            IEC 61511 SIF register · SIL verification · Proof test scheduling · ESD trip log
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-border/50 text-xs h-8"
            onClick={handleRefresh}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </Button>
          <Button
            size="sm"
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs h-8"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New SIF
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {(degradedSIFs > 0 || overdueTests > 0) && (
        <div className="space-y-2">
          {degradedSIFs > 0 && (
            <div className="rounded-lg border border-red-700/40 bg-red-950/10 p-3 flex items-center gap-3">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-sm text-red-400 font-bold">{degradedSIFs} SIF{degradedSIFs > 1 ? "s" : ""} below required SIL level.</span>
              <span className="text-sm text-muted-foreground">Immediate corrective action required per IEC 61511 Clause 11.</span>
            </div>
          )}
          {overdueTests > 0 && (
            <div className="rounded-lg border border-amber-700/40 bg-amber-950/10 p-3 flex items-center gap-3">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-sm text-amber-400 font-bold">{overdueTests} proof test{overdueTests > 1 ? "s" : ""} overdue.</span>
              <span className="text-sm text-muted-foreground">PFD_avg may exceed SIL target. Schedule tests immediately.</span>
            </div>
          )}
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total SIFs", value: totalFunctions, icon: ShieldCheck, color: "text-foreground" },
          { label: "SIFs Below SIL", value: degradedSIFs, icon: ShieldAlert, color: degradedSIFs > 0 ? "text-red-400" : "text-emerald-400" },
          { label: "Bypassed SIFs", value: bypassedSIFs, icon: AlertTriangle, color: bypassedSIFs > 0 ? "text-amber-400" : "text-emerald-400" },
          { label: "Overdue Proof Tests", value: overdueTests, icon: Clock, color: overdueTests > 0 ? "text-red-400" : "text-emerald-400" },
          { label: "IEC 61511 Compliance", value: certSummary ? `${certSummary.complianceRate}%` : "—", icon: Activity, color: certSummary && certSummary.complianceRate >= 80 ? "text-emerald-400" : "text-amber-400" },
        ].map(kpi => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-3.5 h-3.5 ${kpi.color}`} />
                  <span className="text-xs text-muted-foreground">{kpi.label}</span>
                </div>
                {sifsLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <div className={`font-[Syne] font-black text-2xl ${kpi.color}`}>{kpi.value}</div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* IEC 61511 DB Summary Banner */}
      {certSummary && (
        <div className="rounded-lg border border-blue-700/30 bg-blue-950/10 p-3 flex items-center gap-4 flex-wrap">
          <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="text-sm text-blue-400 font-medium">IEC 61511 Assessment:</span>
          <span className="text-xs text-muted-foreground">{certSummary.assessmentCount} assessment{certSummary.assessmentCount !== 1 ? "s" : ""}</span>
          <span className="text-xs text-muted-foreground">{certSummary.compliantControls}/{certSummary.totalControls} controls compliant</span>
          <span className="text-xs text-amber-400">{certSummary.openGaps} open gaps</span>
          {certSummary.criticalGaps > 0 && <span className="text-xs text-red-400 font-bold">{certSummary.criticalGaps} critical gaps</span>}
          {wellAssessments.length > 0 && <span className="text-xs text-muted-foreground">{wellAssessments.length} well-level SIL assessment{wellAssessments.length !== 1 ? "s" : ""}</span>}
        </div>
      )}

      <Tabs defaultValue="sifs">
        <TabsList className="bg-muted/50 h-8">
          <TabsTrigger value="sifs" className="text-xs h-7">SIF Register ({totalFunctions})</TabsTrigger>
          <TabsTrigger value="analysis" className="text-xs h-7">SIL Analysis</TabsTrigger>
          <TabsTrigger value="tests" className="text-xs h-7">Test Records</TabsTrigger>
          <TabsTrigger value="tenants" className="text-xs h-7">Multi-Tenant</TabsTrigger>
        </TabsList>

        {/* SIF Register tab — live data */}
        <TabsContent value="sifs" className="mt-4 space-y-3">
          {sifsLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
          ) : silFunctions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No SIFs in register yet.</p>
              <Button size="sm" className="mt-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold" onClick={() => setShowCreate(true)}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add First SIF
              </Button>
            </div>
          ) : (
            silFunctions.map(sif => {
              const sc = silStatusConfig(sif.status);
              const ptc = pfdStatus(sif.nextTestDue);
              const slc = silColor(sif.achievedSil, sif.targetSil);
              const isSelected = selectedSifId === sif.id;
              return (
                <div
                  key={sif.id}
                  className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                    sif.status === "bypassed" ? "border-amber-700/30 bg-amber-950/10" :
                    sif.achievedSil !== null && sif.achievedSil < sif.targetSil ? "border-red-700/30 bg-red-950/10" :
                    isSelected ? "border-amber-500/40 bg-amber-950/5" :
                    "border-border/50 bg-card hover:border-border"
                  }`}
                  onClick={() => setSelectedSifId(isSelected ? null : sif.id)}
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <div className={`w-2 h-2 rounded-full ${sc.dot}`} />
                        <span className="font-[Syne] font-bold text-sm text-foreground">{sif.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${sc.bg} ${sc.color}`}>{sc.label}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{sif.functionId}</span>
                        {sif.lopaRef && <span className="text-[10px] text-muted-foreground">LOPA: {sif.lopaRef}</span>}
                      </div>
                      {sif.description && <div className="text-xs text-muted-foreground">{sif.description}</div>}
                      {sif.processHazard && <div className="text-xs text-muted-foreground mt-0.5">Hazard: {sif.processHazard}</div>}
                      <div className="flex items-center gap-4 mt-2 text-xs flex-wrap">
                        {sif.pfdAvg && <span className="text-muted-foreground">PFD_avg: <span className="font-mono text-foreground">{sif.pfdAvg.toFixed(4)}</span></span>}
                        {sif.rrf && <span className="text-muted-foreground">RRF: <span className="font-mono text-foreground">{sif.rrf.toFixed(0)}</span></span>}
                        <span className={ptc.color}>Proof test: {ptc.label}</span>
                        {sif.lastVerifiedAt && <span className="text-muted-foreground">Last verified: {new Date(sif.lastVerifiedAt).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <div className="text-[10px] text-muted-foreground">Target SIL</div>
                        <div className="font-mono font-bold text-foreground">SIL-{sif.targetSil}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-muted-foreground">Achieved SIL</div>
                        <div className={`font-mono font-bold ${slc}`}>
                          {sif.achievedSil ? `SIL-${sif.achievedSil}` : "—"}
                        </div>
                      </div>
                      {sif.status === "operational" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-700/40 text-amber-400 hover:bg-amber-950/20 text-xs h-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateMutation.mutate({ id: sif.id, status: "bypassed" });
                          }}
                        >
                          Request Bypass
                        </Button>
                      )}
                      {sif.status === "bypassed" && (
                        <Button
                          size="sm"
                          className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs h-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateMutation.mutate({ id: sif.id, status: "operational" });
                          }}
                        >
                          Reinstate
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Expanded test records */}
                  {isSelected && testRecords.length > 0 && (
                    <div className="mt-4 border-t border-border/30 pt-3 space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground mb-2">Proof Test History</div>
                      {testRecords.slice(0, 5).map(tr => (
                        <div key={tr.id} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{new Date(tr.testDate).toLocaleDateString()}</span>
                          <span className="text-foreground">{tr.testType}</span>
                          <Badge variant="outline" className={`text-[10px] ${tr.testResult === "PASS" ? "text-emerald-400 border-emerald-700/30" : "text-red-400 border-red-700/30"}`}>
                            {tr.testResult}
                          </Badge>
                          {tr.responseTimeSec && <span className="font-mono text-muted-foreground">{tr.responseTimeSec.toFixed(1)}s</span>}
                          {tr.testedBy && <span className="text-muted-foreground">{tr.testedBy}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </TabsContent>

        {/* SIL Analysis tab */}
        <TabsContent value="analysis" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="font-[Syne] text-sm font-bold">SIL Level Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {silDistribution.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No data — seed the database first</div>
                ) : (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={silDistribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "oklch(0.552 0.016 285.938)" }} />
                        <YAxis tick={{ fontSize: 10, fill: "oklch(0.552 0.016 285.938)" }} allowDecimals={false} />
                        <Tooltip contentStyle={{ background: "oklch(0.21 0.006 285.885)", border: "none", borderRadius: "4px", fontSize: "10px" }} />
                        <Bar dataKey="count" name="Functions" radius={[3, 3, 0, 0]}>
                          {silDistribution.map((d, i) => <Cell key={i} fill={d.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="font-[Syne] text-sm font-bold">Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {statusDistribution.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No data</div>
                ) : (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                          labelLine={false}
                        >
                          {statusDistribution.map((_, i) => (
                            <Cell key={i} fill={["#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#6b7280"][i % 5]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: "oklch(0.21 0.006 285.885)", border: "none", borderRadius: "4px", fontSize: "10px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary stats */}
            {silSummary && (
              <Card className="border-border/50 lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="font-[Syne] text-sm font-bold">SIL Register Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-foreground">{silSummary.total}</div>
                      <div className="text-xs text-muted-foreground">Total SIFs</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-400">{silSummary.overdueTests}</div>
                      <div className="text-xs text-muted-foreground">Overdue Tests</div>
                    </div>
                    {Object.entries(silSummary.bySil).map(([sil, count]) => (
                      <div key={sil} className="text-center">
                        <div className="text-2xl font-bold text-amber-400">{count as number}</div>
                        <div className="text-xs text-muted-foreground">SIL-{sil} Functions</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Test Records tab */}
        <TabsContent value="tests" className="mt-4 space-y-3">
          {selectedSifId ? (
            <>
              <div className="text-xs text-muted-foreground mb-2">
                Showing test records for SIF ID {selectedSifId}. Click a SIF in the register to change selection.
              </div>
              {testRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No test records for this SIF yet.</div>
              ) : (
                testRecords.map(tr => (
                  <div key={tr.id} className="rounded-lg border border-border/50 bg-card p-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono text-muted-foreground">{new Date(tr.testDate).toLocaleDateString()}</span>
                          <Badge variant="outline" className={`text-[10px] ${tr.testResult === "PASS" ? "text-emerald-400 border-emerald-700/30" : "text-red-400 border-red-700/30"}`}>
                            {tr.testResult}
                          </Badge>
                          <span className="text-xs text-foreground">{tr.testType}</span>
                        </div>
                        {tr.deviations && <div className="text-xs text-amber-400">Deviations: {tr.deviations}</div>}
                        {tr.correctiveActions && <div className="text-xs text-muted-foreground">Actions: {tr.correctiveActions}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        {tr.responseTimeSec && <div className="font-mono text-sm text-foreground">{tr.responseTimeSec.toFixed(2)}s response</div>}
                        {tr.testedBy && <div className="text-xs text-muted-foreground">By: {tr.testedBy}</div>}
                        {tr.witnessedBy && <div className="text-xs text-muted-foreground">Witnessed: {tr.witnessedBy}</div>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a SIF from the register to view its test records.</p>
            </div>
          )}
        </TabsContent>

        {/* Multi-Tenant tab */}
        <TabsContent value="tenants" className="mt-4 space-y-3">
          <div className="rounded-lg border border-blue-700/30 bg-blue-950/10 p-3 flex items-center gap-3 mb-4">
            <Lock className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="text-sm text-blue-400 font-medium">Multi-tenant isolation is enforced at the PostgreSQL row-level security (RLS) layer.</span>
            <span className="text-sm text-muted-foreground">Each tenant's data is cryptographically isolated. Cross-tenant queries are blocked at the database level.</span>
          </div>
          {TENANTS.map(tenant => (
            <div key={tenant.tenant_id} className={`rounded-lg border p-4 ${tenant.status === "SUSPENDED" ? "border-red-700/30 bg-red-950/10 opacity-60" : "border-border/50 bg-card"}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-[Syne] font-bold text-sm text-foreground">{tenant.name}</span>
                    <span className={`text-[10px] font-bold ${tierColor(tenant.tier)}`}>{tenant.tier}</span>
                    {tenant.status === "SUSPENDED" && <span className="text-[10px] text-red-400 font-bold">SUSPENDED</span>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <span><Users className="w-3 h-3 inline mr-1" />{tenant.users} users</span>
                    <span>{tenant.wells} wells</span>
                    <span>Region: {tenant.region}</span>
                    <span>Storage: {tenant.storage_gb.toLocaleString()} GB</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground">Isolation</div>
                    <div className={`text-xs font-mono font-bold ${tenant.data_isolation === "CLUSTER" ? "text-amber-400" : tenant.data_isolation === "DATABASE" ? "text-blue-400" : "text-muted-foreground"}`}>
                      {tenant.data_isolation}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-border/50 text-xs h-7"
                    onClick={() => toast.info(`${tenant.name} details`, { description: `${tenant.wells} wells · ${tenant.users} users · ${tenant.storage_gb} GB` })}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    View
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
