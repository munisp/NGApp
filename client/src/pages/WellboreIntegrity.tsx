/**
 * WellboreIntegrity.tsx
 * Casing inspection log, pressure test records, corrosion monitoring, integrity score
 * References: ISO 16530-1:2017, API RP 90, NORSOK D-010
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert, ShieldX, Plus, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

const WELL_OPTIONS = [
  { id: "W-001", name: "Al-Burgan-01" },
  { id: "W-002", name: "Al-Burgan-02" },
  { id: "W-003", name: "Raudhatain-01" },
  { id: "W-004", name: "Sabriyah-01" },
];

function IntegrityGauge({ score }: { score: number }) {
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : score >= 40 ? "#f97316" : "#ef4444";
  const data = [{ name: "score", value: score, fill: color }];
  return (
    <div className="relative w-40 h-40 mx-auto">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="60%" outerRadius="90%" data={data} startAngle={225} endAngle={-45}>
          <RadialBar dataKey="value" cornerRadius={6} background={{ fill: "#1e293b" }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color }}>{score}</span>
        <span className="text-xs text-slate-400">/100</span>
      </div>
    </div>
  );
}

export default function WellboreIntegrity() {
  const [wellId, setWellId] = useState("W-001");
  const [showInspectionDialog, setShowInspectionDialog] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);

  // Form states
  const [inspForm, setInspForm] = useState({
    inspectionDate: new Date().toISOString().split("T")[0],
    inspectionType: "MLIT" as const,
    casingString: "PRODUCTION" as const,
    topDepthFt: 0,
    bottomDepthFt: 5000,
    wallThicknessIn: 0.35,
    corrosionPct: 5,
    ovalityPct: 1,
    anomaliesFound: 0,
    passedTest: true,
    notes: "",
    inspectedBy: "",
  });

  const [testForm, setTestForm] = useState({
    testDate: new Date().toISOString().split("T")[0],
    testType: "MAASP" as const,
    testPressurePsi: 3000,
    holdTimeMins: 30,
    pressureDropPsi: 0,
    acceptanceCriteriaPsi: 50,
    passed: true,
    testFluid: "water",
    notes: "",
    testedBy: "",
  });

  const summaryQuery = trpc.wellboreIntegrity.summary.useQuery({ wellId });
  const inspectionsQuery = trpc.wellboreIntegrity.listInspections.useQuery({ wellId });
  const testsQuery = trpc.wellboreIntegrity.listPressureTests.useQuery({ wellId });
  const historyQuery = trpc.wellboreIntegrity.scoreHistory.useQuery({ wellId });
  const utils = trpc.useUtils();

  const addInspectionMutation = trpc.wellboreIntegrity.addInspection.useMutation({
    onSuccess: () => {
      toast.success("Inspection record added");
      setShowInspectionDialog(false);
      utils.wellboreIntegrity.summary.invalidate({ wellId });
      utils.wellboreIntegrity.listInspections.invalidate({ wellId });
      utils.wellboreIntegrity.scoreHistory.invalidate({ wellId });
    },
    onError: (err) => toast.error(err.message),
  });

  const addTestMutation = trpc.wellboreIntegrity.addPressureTest.useMutation({
    onSuccess: () => {
      toast.success("Pressure test record added");
      setShowTestDialog(false);
      utils.wellboreIntegrity.summary.invalidate({ wellId });
      utils.wellboreIntegrity.listPressureTests.invalidate({ wellId });
    },
    onError: (err) => toast.error(err.message),
  });

  const summary = summaryQuery.data;
  const riskColors: Record<string, string> = {
    LOW: "text-emerald-400 border-emerald-500/40",
    MEDIUM: "text-amber-400 border-amber-500/40",
    HIGH: "text-orange-400 border-orange-500/40",
    CRITICAL: "text-red-400 border-red-500/40",
  };

  return (
    <div className="p-6 space-y-6 bg-slate-950 min-h-screen text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-400" />
            Wellbore Integrity
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Casing inspection · Pressure testing · Corrosion monitoring · ISO 16530-1:2017
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showInspectionDialog} onOpenChange={setShowInspectionDialog}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="w-4 h-4 mr-2" /> Add Inspection
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
              <DialogHeader>
                <DialogTitle>New Casing Inspection Record</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div>
                  <Label className="text-slate-300 text-xs">Inspection Date</Label>
                  <Input type="date" value={inspForm.inspectionDate}
                    onChange={e => setInspForm(f => ({ ...f, inspectionDate: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white mt-1" />
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">Inspection Type</Label>
                  <Select value={inspForm.inspectionType} onValueChange={(v: any) => setInspForm(f => ({ ...f, inspectionType: v }))}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-white mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      {["MLIT", "ELTF", "CAST", "USIT", "VISUAL"].map(t => (
                        <SelectItem key={t} value={t} className="text-white">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">Casing String</Label>
                  <Select value={inspForm.casingString} onValueChange={(v: any) => setInspForm(f => ({ ...f, casingString: v }))}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-white mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      {["SURFACE", "INTERMEDIATE", "PRODUCTION", "LINER"].map(t => (
                        <SelectItem key={t} value={t} className="text-white">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">Corrosion (%)</Label>
                  <Input type="number" value={inspForm.corrosionPct}
                    onChange={e => setInspForm(f => ({ ...f, corrosionPct: +e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white mt-1" />
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">Top Depth (ft)</Label>
                  <Input type="number" value={inspForm.topDepthFt}
                    onChange={e => setInspForm(f => ({ ...f, topDepthFt: +e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white mt-1" />
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">Bottom Depth (ft)</Label>
                  <Input type="number" value={inspForm.bottomDepthFt}
                    onChange={e => setInspForm(f => ({ ...f, bottomDepthFt: +e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white mt-1" />
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">Wall Thickness (in)</Label>
                  <Input type="number" step="0.001" value={inspForm.wallThicknessIn}
                    onChange={e => setInspForm(f => ({ ...f, wallThicknessIn: +e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white mt-1" />
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">Anomalies Found</Label>
                  <Input type="number" value={inspForm.anomaliesFound}
                    onChange={e => setInspForm(f => ({ ...f, anomaliesFound: +e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white mt-1" />
                </div>
                <div className="col-span-2">
                  <Label className="text-slate-300 text-xs">Notes</Label>
                  <Textarea value={inspForm.notes}
                    onChange={e => setInspForm(f => ({ ...f, notes: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white mt-1" rows={2} />
                </div>
              </div>
              <Button
                onClick={() => addInspectionMutation.mutate({ wellId, ...inspForm })}
                disabled={addInspectionMutation.isPending}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-700"
              >
                Save Inspection Record
              </Button>
            </DialogContent>
          </Dialog>

          <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
                <Plus className="w-4 h-4 mr-2" /> Add Pressure Test
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
              <DialogHeader>
                <DialogTitle>New Pressure Test Record</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div>
                  <Label className="text-slate-300 text-xs">Test Date</Label>
                  <Input type="date" value={testForm.testDate}
                    onChange={e => setTestForm(f => ({ ...f, testDate: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white mt-1" />
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">Test Type</Label>
                  <Select value={testForm.testType} onValueChange={(v: any) => setTestForm(f => ({ ...f, testType: v }))}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-white mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      {["MAASP", "MASP", "SITP", "CITHP", "INFLOW", "LEAKOFF", "FIT"].map(t => (
                        <SelectItem key={t} value={t} className="text-white">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">Test Pressure (psi)</Label>
                  <Input type="number" value={testForm.testPressurePsi}
                    onChange={e => setTestForm(f => ({ ...f, testPressurePsi: +e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white mt-1" />
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">Hold Time (min)</Label>
                  <Input type="number" value={testForm.holdTimeMins}
                    onChange={e => setTestForm(f => ({ ...f, holdTimeMins: +e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white mt-1" />
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">Pressure Drop (psi)</Label>
                  <Input type="number" value={testForm.pressureDropPsi}
                    onChange={e => setTestForm(f => ({ ...f, pressureDropPsi: +e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white mt-1" />
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">Acceptance Criteria (psi)</Label>
                  <Input type="number" value={testForm.acceptanceCriteriaPsi}
                    onChange={e => setTestForm(f => ({ ...f, acceptanceCriteriaPsi: +e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white mt-1" />
                </div>
                <div className="col-span-2">
                  <Label className="text-slate-300 text-xs">Notes</Label>
                  <Textarea value={testForm.notes}
                    onChange={e => setTestForm(f => ({ ...f, notes: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white mt-1" rows={2} />
                </div>
              </div>
              <Button
                onClick={() => addTestMutation.mutate({ wellId, ...testForm })}
                disabled={addTestMutation.isPending}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-700"
              >
                Save Pressure Test Record
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Well selector */}
      <div className="flex items-center gap-3">
        <Label className="text-slate-300 text-sm">Well:</Label>
        <Select value={wellId} onValueChange={setWellId}>
          <SelectTrigger className="bg-slate-800 border-slate-600 text-white w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-600">
            {WELL_OPTIONS.map(w => (
              <SelectItem key={w.id} value={w.id} className="text-white">{w.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Integrity Summary */}
      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-900/60 border-slate-700 flex flex-col items-center justify-center py-4">
            <IntegrityGauge score={summary.overallScore} />
            <Badge variant="outline" className={`mt-2 ${riskColors[summary.riskLevel]}`}>
              {summary.riskLevel} RISK
            </Badge>
          </Card>
          <Card className="bg-slate-900/60 border-slate-700 lg:col-span-3">
            <CardContent className="pt-4">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{summary.inspectionCount}</div>
                  <div className="text-xs text-slate-400">Inspections</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{summary.pressureTestCount}</div>
                  <div className="text-xs text-slate-400">Pressure Tests</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-slate-300">
                    {summary.casingStrings.join(", ") || "—"}
                  </div>
                  <div className="text-xs text-slate-400">Casing Strings</div>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700">
                <div className="flex items-start gap-2">
                  {summary.riskLevel === "LOW" ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> :
                   summary.riskLevel === "CRITICAL" ? <ShieldX className="w-4 h-4 text-red-400 mt-0.5 shrink-0" /> :
                   <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />}
                  <p className="text-sm text-slate-300">{summary.recommendation}</p>
                </div>
              </div>
              {summary.nextInspectionDue && (
                <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
                  <Clock className="w-3 h-3" />
                  Next inspection due: {new Date(summary.nextInspectionDue).toLocaleDateString()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="inspections">
        <TabsList className="bg-slate-800 border-slate-700">
          <TabsTrigger value="inspections" className="data-[state=active]:bg-blue-600">Casing Inspections</TabsTrigger>
          <TabsTrigger value="tests" className="data-[state=active]:bg-blue-600">Pressure Tests</TabsTrigger>
          <TabsTrigger value="trend" className="data-[state=active]:bg-blue-600">Integrity Trend</TabsTrigger>
        </TabsList>

        <TabsContent value="inspections">
          <Card className="bg-slate-900/60 border-slate-700">
            <CardContent className="pt-4">
              {inspectionsQuery.data && inspectionsQuery.data.length > 0 ? (
                <div className="space-y-2">
                  {inspectionsQuery.data.map(insp => (
                    <div key={insp.id} className="flex items-center justify-between p-3 bg-slate-800/60 rounded-lg border border-slate-700">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs border-blue-500/40 text-blue-400">{insp.inspectionType}</Badge>
                          <span className="text-white text-sm">{insp.casingString} casing</span>
                          <span className="text-slate-400 text-xs">{insp.topDepthFt}–{insp.bottomDepthFt} ft</span>
                        </div>
                        <div className="text-slate-400 text-xs mt-1">
                          Corrosion: {insp.corrosionPct?.toFixed(1) ?? "—"}% · Ovality: {insp.ovalityPct?.toFixed(1) ?? "—"}% · Anomalies: {insp.anomaliesFound ?? 0}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${(insp.integrityScore ?? 85) >= 80 ? "text-emerald-400" : (insp.integrityScore ?? 85) >= 60 ? "text-amber-400" : "text-red-400"}`}>
                          {insp.integrityScore?.toFixed(0) ?? "—"}
                        </div>
                        <div className="text-xs text-slate-400">{new Date(insp.inspectionDate).toLocaleDateString()}</div>
                        <Badge variant="outline" className={`text-xs mt-1 ${insp.passedTest ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400"}`}>
                          {insp.passedTest ? "PASS" : "FAIL"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No inspection records yet. Add the first inspection.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tests">
          <Card className="bg-slate-900/60 border-slate-700">
            <CardContent className="pt-4">
              {testsQuery.data && testsQuery.data.length > 0 ? (
                <div className="space-y-2">
                  {testsQuery.data.map(test => (
                    <div key={test.id} className="flex items-center justify-between p-3 bg-slate-800/60 rounded-lg border border-slate-700">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs border-purple-500/40 text-purple-400">{test.testType}</Badge>
                          <span className="text-white text-sm">{test.testPressurePsi} psi × {test.holdTimeMins} min</span>
                        </div>
                        <div className="text-slate-400 text-xs mt-1">
                          Pressure drop: {test.pressureDropPsi?.toFixed(1) ?? "—"} psi · Fluid: {test.testFluid}
                          {test.acceptanceCriteriaPsi ? ` · Criteria: ≤${test.acceptanceCriteriaPsi} psi` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className={`${test.passed ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400"}`}>
                          {test.passed ? "PASS" : "FAIL"}
                        </Badge>
                        <div className="text-xs text-slate-400 mt-1">{new Date(test.testDate).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No pressure test records yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trend">
          <Card className="bg-slate-900/60 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-sm">Integrity Score Trend Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {historyQuery.data && historyQuery.data.length > 1 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={historyQuery.data.map(h => ({
                    date: new Date(h.date).toLocaleDateString(),
                    score: h.score,
                    casing: h.casingString,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <YAxis domain={[0, 100]} stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
                    <Legend wrapperStyle={{ color: "#94a3b8" }} />
                    <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 4 }} name="Integrity Score" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <p className="text-sm">Need at least 2 inspection records to show trend.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
