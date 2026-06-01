import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { toast } from "sonner";
import { Shield, CheckCircle, Clock, AlertTriangle, Search, Plus, RefreshCw, FileText } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-500/20 text-green-400 border-green-500/30",
  in_progress: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  not_started: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  not_applicable: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

export default function Iec62443Page() {
  
  const [search, setSearch] = useState("");
  const [filterZone, setFilterZone] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const generateReportMutation = trpc.iec62443.generateReport.useMutation({
    onSuccess: (data) => {
      toast.success("Compliance gap report generated! Opening in new tab...");
      window.open(data.url, "_blank");
    },
    onError: (err) => toast.error(`Report generation failed: ${err.message}`),
  });

  const { data: controls, isLoading, refetch } = trpc.iec62443.listControls.useQuery({
    zone: filterZone === "all" ? undefined : filterZone,
    status: filterStatus === "all" ? undefined : filterStatus,
    search: search || undefined,
  });

  const { data: summary } = trpc.iec62443.getSummary.useQuery();
  const { data: assessments } = trpc.iec62443.listAssessments.useQuery();

  const seedMutation = trpc.iec62443.seedDefaultControls.useMutation({
    onSuccess: (data) => {
       toast.success(`Controls seeded: ${data.seeded} default IEC 62443 controls added.`);
      refetch();
    },
  });

  const updateMutation = trpc.iec62443.updateControl.useMutation({
    onSuccess: () => { toast.success("Control updated"); refetch(); },
  });

  const completionPct = summary?.completionPct ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Shield className="w-7 h-7 text-blue-400" />
              IEC 62443 Cybersecurity Compliance
            </h1>
            <p className="text-zinc-400 text-sm mt-1">Industrial Automation & Control Systems Security Standard</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
            <Button size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
              <Plus className="w-4 h-4 mr-1" /> Seed Default Controls
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
              onClick={() => generateReportMutation.mutate({ targetSL: 2, organizationName: "OG-RMM Operator" })}
              disabled={generateReportMutation.isPending}
            >
              <FileText className="w-4 h-4 mr-1" />
              {generateReportMutation.isPending ? "Generating..." : "Export Gap Report"}
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="text-zinc-400 text-xs mb-1">Total Controls</div>
              <div className="text-2xl font-bold text-white">{summary?.total ?? 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="text-zinc-400 text-xs mb-1">Completed</div>
              <div className="text-2xl font-bold text-green-400">{summary?.byStatus?.completed ?? 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="text-zinc-400 text-xs mb-1">In Progress</div>
              <div className="text-2xl font-bold text-blue-400">{summary?.byStatus?.in_progress ?? 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="text-zinc-400 text-xs mb-1">Completion</div>
              <div className="text-2xl font-bold text-white">{completionPct}%</div>
            </CardContent>
          </Card>
        </div>

        {/* Progress Bar */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-400">Overall Compliance Progress</span>
              <span className="text-sm font-semibold text-white">{completionPct}%</span>
            </div>
            <Progress value={completionPct} className="h-3" />
            <div className="flex gap-4 mt-3 text-xs text-zinc-500">
              {Object.entries(summary?.byZone ?? {}).map(([zone, count]) => (
                <span key={zone}>{zone}: {count as number}</span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              placeholder="Search controls..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-zinc-900 border-zinc-700 text-white"
            />
          </div>
          <Select value={filterZone} onValueChange={setFilterZone}>
            <SelectTrigger className="w-36 bg-zinc-900 border-zinc-700 text-white">
              <SelectValue placeholder="Zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              <SelectItem value="SL1">SL1</SelectItem>
              <SelectItem value="SL2">SL2</SelectItem>
              <SelectItem value="SL3">SL3</SelectItem>
              <SelectItem value="SL4">SL4</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40 bg-zinc-900 border-zinc-700 text-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="not_applicable">N/A</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Controls Table */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">Security Requirements ({controls?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-zinc-500">Loading controls...</div>
            ) : controls?.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">
                No controls found. Click "Seed Default Controls" to get started.
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {controls?.map((control) => (
                  <div key={control.id} className="p-4 hover:bg-zinc-800/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                            {control.controlId}
                          </span>
                          <Badge variant="outline" className={`text-xs ${STATUS_COLORS[control.status] ?? ""}`}>
                            {control.status.replace("_", " ")}
                          </Badge>
                          <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-700">
                            {control.zone}
                          </Badge>
                          <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-700">
                            {control.category}
                          </Badge>
                        </div>
                        <div className="text-sm font-medium text-white">{control.title}</div>
                        {control.requirement && (
                          <div className="text-xs text-zinc-500 mt-1 line-clamp-2">{control.requirement}</div>
                        )}
                        {control.assignedTo && (
                          <div className="text-xs text-zinc-600 mt-1">Assigned: {control.assignedTo}</div>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7"
                          onClick={() => updateMutation.mutate({ id: control.id, status: "in_progress" })}
                          disabled={control.status === "in_progress" || control.status === "completed"}
                        >
                          Start
                        </Button>
                        <Button
                          size="sm"
                          className="text-xs h-7 bg-green-600 hover:bg-green-700"
                          onClick={() => updateMutation.mutate({ id: control.id, status: "completed", completedAt: new Date() })}
                          disabled={control.status === "completed"}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" /> Complete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assessments */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-base">Security Assessments ({assessments?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {assessments?.length === 0 ? (
              <div className="text-zinc-500 text-sm">No assessments recorded yet.</div>
            ) : (
              <div className="space-y-3">
                {assessments?.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-white">
                        Assessment — {new Date(a.assessmentDate).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-zinc-400">
                        Target SL: {a.targetSl} | Achieved SL: {a.achievedSl ?? "TBD"} | Score: {a.overallScore ?? "TBD"}%
                      </div>
                    </div>
                    <Badge variant="outline" className={STATUS_COLORS[a.status] ?? ""}>
                      {a.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
