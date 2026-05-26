import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import { toast } from "sonner";
import { ShieldAlert, Clock, CheckCircle, AlertTriangle, Plus, RefreshCw, Activity } from "lucide-react";

const SIL_COLORS: Record<number, string> = {
  1: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  2: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  3: "text-red-400 bg-red-500/10 border-red-500/30",
  4: "text-purple-400 bg-purple-500/10 border-purple-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  design: "bg-zinc-500/20 text-zinc-400",
  validation: "bg-blue-500/20 text-blue-400",
  operational: "bg-green-500/20 text-green-400",
  decommissioned: "bg-red-500/20 text-red-400",
};

export default function SilPage() {
  
  const [selectedFn, setSelectedFn] = useState<number | null>(null);

  const { data: fns, isLoading, refetch } = trpc.sil.listFunctions.useQuery();
  const { data: summary } = trpc.sil.getSummary.useQuery();
  const { data: overdue } = trpc.sil.getOverdueFunctions.useQuery();
  const { data: testRecords } = trpc.sil.listTestRecords.useQuery(
    { silFunctionId: selectedFn! },
    { enabled: selectedFn !== null }
  );

  const createMutation = trpc.sil.createFunction.useMutation({
    onSuccess: () => { toast.success("SIF created"); refetch(); },
  });

  const updateMutation = trpc.sil.updateFunction.useMutation({
    onSuccess: () => { toast.success("SIF updated"); refetch(); },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-7 h-7 text-orange-400" />
              SIL 2 Functional Safety Management
            </h1>
            <p className="text-zinc-400 text-sm mt-1">Safety Instrumented Functions — IEC 61511 / IEC 61508 Compliance</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
            <Button size="sm" onClick={() => createMutation.mutate({
              functionId: `SIF-${Date.now().toString(36).toUpperCase()}`,
              name: "New Safety Instrumented Function",
              targetSil: 2,
            })}>
              <Plus className="w-4 h-4 mr-1" /> New SIF
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="text-zinc-400 text-xs mb-1">Total SIFs</div>
              <div className="text-2xl font-bold text-white">{summary?.total ?? 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="text-zinc-400 text-xs mb-1">Operational</div>
              <div className="text-2xl font-bold text-green-400">{summary?.byStatus?.operational ?? 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="text-zinc-400 text-xs mb-1">Overdue Tests</div>
              <div className="text-2xl font-bold text-red-400">{summary?.overdueTests ?? 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="text-zinc-400 text-xs mb-1">SIL 2 Functions</div>
              <div className="text-2xl font-bold text-orange-400">{(summary?.bySil as Record<number, number>)?.[2] ?? 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Overdue Alert */}
        {(overdue?.length ?? 0) > 0 && (
          <Card className="bg-red-950/30 border-red-800/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-400 font-semibold mb-2">
                <AlertTriangle className="w-5 h-5" />
                {overdue?.length} SIF(s) with overdue proof tests
              </div>
              <div className="space-y-1">
                {overdue?.map((f) => (
                  <div key={f.id} className="text-sm text-red-300">
                    {f.functionId} — {f.name} — Due: {f.nextTestDue ? new Date(f.nextTestDue).toLocaleDateString() : "N/A"}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* SIF List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white text-base">Safety Instrumented Functions ({fns?.length ?? 0})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-zinc-500">Loading...</div>
              ) : fns?.length === 0 ? (
                <div className="p-8 text-center text-zinc-500">No SIFs defined yet.</div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {fns?.map((fn) => (
                    <div
                      key={fn.id}
                      className={`p-4 cursor-pointer hover:bg-zinc-800/50 transition-colors ${selectedFn === fn.id ? "bg-zinc-800/70 border-l-2 border-orange-500" : ""}`}
                      onClick={() => setSelectedFn(fn.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded">
                              {fn.functionId}
                            </span>
                            <Badge variant="outline" className={`text-xs ${SIL_COLORS[fn.targetSil] ?? ""}`}>
                              SIL {fn.targetSil}
                            </Badge>
                            <Badge variant="outline" className={`text-xs ${STATUS_COLORS[fn.status] ?? ""}`}>
                              {fn.status}
                            </Badge>
                          </div>
                          <div className="text-sm font-medium text-white">{fn.name}</div>
                          {fn.pfdAvg !== null && fn.pfdAvg !== undefined && (
                            <div className="text-xs text-zinc-500 mt-1">
                              PFDavg: {fn.pfdAvg.toExponential(2)} | RRF: {fn.rrf?.toFixed(0) ?? "N/A"}
                            </div>
                          )}
                          {fn.nextTestDue && (
                            <div className={`text-xs mt-1 flex items-center gap-1 ${new Date(fn.nextTestDue) < new Date() ? "text-red-400" : "text-zinc-500"}`}>
                              <Clock className="w-3 h-3" />
                              Next test: {new Date(fn.nextTestDue).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateMutation.mutate({ id: fn.id, status: "operational" });
                          }}
                          disabled={fn.status === "operational"}
                        >
                          Validate
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Test Records Panel */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                Proof Test Records
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedFn === null ? (
                <div className="text-zinc-500 text-sm">Select a SIF to view test records.</div>
              ) : testRecords?.length === 0 ? (
                <div className="text-zinc-500 text-sm">No test records for this SIF.</div>
              ) : (
                <div className="space-y-3">
                  {testRecords?.map((r) => (
                    <div key={r.id} className="p-3 bg-zinc-800/50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white">
                          {new Date(r.testDate).toLocaleDateString()} — {r.testType}
                        </span>
                        <Badge variant="outline" className={r.testResult === "pass" ? "text-green-400 border-green-500/30" : "text-red-400 border-red-500/30"}>
                          {r.testResult}
                        </Badge>
                      </div>
                      {r.responseTimeSec !== null && r.responseTimeSec !== undefined && (
                        <div className="text-xs text-zinc-500">Response time: {r.responseTimeSec}s</div>
                      )}
                      {r.testedBy && <div className="text-xs text-zinc-500">Tested by: {r.testedBy}</div>}
                      {r.deviations && <div className="text-xs text-yellow-400 mt-1">Deviations: {r.deviations}</div>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
