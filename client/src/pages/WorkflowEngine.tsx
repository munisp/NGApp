/**
 * WorkflowEngine.tsx — Temporal Workflow Engine Management
 *
 * Manages long-running Temporal workflows for:
 *   - Permit-to-Work (PTW) workflows
 *   - OTA Campaign workflows
 *   - Regulatory Submission workflows
 *
 * Features:
 *   - List all active/completed workflows with status
 *   - Start new workflow instances
 *   - Send signals to running workflows
 *   - Terminate running workflows
 *   - Real-time status polling
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import {
  Workflow, Play, Square, Signal, RefreshCw, Plus,
  CheckCircle2, XCircle, Clock, AlertTriangle, Activity,
  Zap, FileText, Radio, Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface WorkflowInstance {
  workflowId: string;
  status: string;
  startTime: string | null;
  closeTime: string | null;
  type: string;
  lastSignal?: string;
}

const WORKFLOW_TYPES: { value: string; label: string; icon: LucideIcon; description: string }[] = [
  { value: "PTWWorkflow", label: "Permit-to-Work", icon: FileText, description: "Manages PTW approval lifecycle with safety checks" },
  { value: "OTACampaignWorkflow", label: "OTA Campaign", icon: Radio, description: "Orchestrates firmware update rollout across devices" },
  { value: "RegulatorySubmissionWorkflow", label: "Regulatory Submission", icon: Settings2, description: "Automates regulatory report submission pipeline" },
];

const STATUS_CONFIG: Record<string, { color: string; icon: LucideIcon; label: string }> = {
  RUNNING:   { color: "bg-blue-950/40 text-blue-400 border-blue-800/40",     icon: Activity,      label: "Running" },
  COMPLETED: { color: "bg-emerald-950/40 text-emerald-400 border-emerald-800/40", icon: CheckCircle2, label: "Completed" },
  FAILED:    { color: "bg-red-950/40 text-red-400 border-red-800/40",         icon: XCircle,       label: "Failed" },
  TERMINATED:{ color: "bg-orange-950/40 text-orange-400 border-orange-800/40", icon: Square,        label: "Terminated" },
  TIMED_OUT: { color: "bg-yellow-950/40 text-yellow-400 border-yellow-800/40", icon: Clock,         label: "Timed Out" },
  CANCELED:  { color: "bg-gray-950/40 text-gray-400 border-gray-800/40",       icon: XCircle,       label: "Canceled" },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? { color: "bg-gray-950/40 text-gray-400 border-gray-800/40", icon: Clock, label: status };
}

// ─── Start Workflow Dialog ─────────────────────────────────────────────────────
function StartWorkflowDialog({ open, onClose, onStarted }: { open: boolean; onClose: () => void; onStarted: () => void }) {
  const [workflowType, setWorkflowType] = useState<"PTWWorkflow" | "OTACampaignWorkflow" | "RegulatorySubmissionWorkflow">("PTWWorkflow");
  const [inputJson, setInputJson] = useState('{\n  "wellId": "WELL-001",\n  "requestedBy": "user@operator.com"\n}');

  const startMut = trpc.workflows.start.useMutation({
    onSuccess: (data) => {
      toast.success(`Workflow started: ${data.workflowId}`);
      onStarted();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit() {
    let parsedInput: Record<string, unknown>;
    try {
      parsedInput = JSON.parse(inputJson);
    } catch {
      toast.error("Invalid JSON input");
      return;
    }
    startMut.mutate({ workflowType: workflowType as "PTWWorkflow" | "OTACampaignWorkflow" | "RegulatorySubmissionWorkflow", input: parsedInput });
  }

  const selectedType = WORKFLOW_TYPES.find(t => t.value === workflowType);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="w-4 h-4 text-primary" />
            Start New Workflow
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Workflow Type <span className="text-red-400">*</span></Label>
            <Select value={workflowType} onValueChange={(v) => setWorkflowType(v as "PTWWorkflow" | "OTACampaignWorkflow" | "RegulatorySubmissionWorkflow")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORKFLOW_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value as string}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedType && (
              <p className="text-xs text-muted-foreground">{selectedType.description}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Input (JSON)</Label>
            <Textarea
              className="font-mono text-xs h-32"
              value={inputJson}
              onChange={e => setInputJson(e.target.value)}
              placeholder='{"wellId": "WELL-001"}'
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={startMut.isPending}>
            {startMut.isPending ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
            Start Workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Signal Dialog ─────────────────────────────────────────────────────────────
function SignalDialog({ workflow, open, onClose, onSignaled }: { workflow: WorkflowInstance | null; open: boolean; onClose: () => void; onSignaled: () => void }) {
  const [signalName, setSignalName] = useState("approve");
  const [payload, setPayload] = useState('{"approvedBy": "supervisor@operator.com"}');

  const signalMut = trpc.workflows.signal.useMutation({
    onSuccess: () => {
      toast.success("Signal sent successfully");
      onSignaled();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!workflow) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Signal className="w-4 h-4 text-primary" />
            Send Signal to Workflow
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/10 border border-border/50">
            <p className="text-xs text-muted-foreground">Workflow ID</p>
            <p className="text-sm font-mono">{workflow.workflowId}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Signal Name</Label>
            <Select value={signalName} onValueChange={setSignalName}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approve">approve — Approve the workflow step</SelectItem>
                <SelectItem value="reject">reject — Reject and halt the workflow</SelectItem>
                <SelectItem value="proceed">proceed — Advance to next step</SelectItem>
                <SelectItem value="cancel">cancel — Cancel gracefully</SelectItem>
                <SelectItem value="retry">retry — Retry failed step</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Payload (JSON)</Label>
            <Textarea
              className="font-mono text-xs h-24"
              value={payload}
              onChange={e => setPayload(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => {
            let parsedPayload: Record<string, unknown> = {};
            try { parsedPayload = JSON.parse(payload); } catch { /* empty payload */ }
            signalMut.mutate({ workflowId: workflow.workflowId, signal: signalName, payload: parsedPayload });
          }} disabled={signalMut.isPending}>
            {signalMut.isPending ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Signal className="w-4 h-4 mr-1" />}
            Send Signal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function WorkflowEngine() {
  const [startOpen, setStartOpen] = useState(false);
  const [signalOpen, setSignalOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowInstance | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data, isLoading, refetch, isFetching } = trpc.workflows.list.useQuery(
    { workflowType: typeFilter === "all" ? undefined : typeFilter, limit: 50 },
    { refetchInterval: autoRefresh ? 10000 : false }
  );

  const terminateMut = trpc.workflows.terminate.useMutation({
    onSuccess: () => { toast.success("Workflow terminated"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const workflows = (data?.workflows as WorkflowInstance[] | undefined) ?? [];
  const source = (data as { source?: string } | undefined)?.source ?? "unknown";

  const running = workflows.filter(w => w.status === "RUNNING").length;
  const completed = workflows.filter(w => w.status === "COMPLETED").length;
  const failed = workflows.filter(w => ["FAILED", "TERMINATED", "TIMED_OUT"].includes(w.status)).length;

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Workflow className="w-6 h-6 text-primary" />
            Workflow Engine
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Temporal workflow orchestration — PTW, OTA campaigns, regulatory submissions
            {source === "simulated" && (
              <Badge variant="outline" className="ml-2 text-xs bg-amber-950/30 text-amber-400 border-amber-800/40">
                <AlertTriangle className="w-3 h-3 mr-1" />Simulated (Go worker offline)
              </Badge>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => setAutoRefresh(p => !p)}
            className={autoRefresh ? "text-emerald-400 border-emerald-800/40" : ""}
          >
            <Zap className={cn("w-4 h-4 mr-1", autoRefresh && "text-emerald-400")} />
            {autoRefresh ? "Live" : "Paused"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("w-4 h-4 mr-1", isFetching && "animate-spin")} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setStartOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Start Workflow
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: workflows.length, icon: Workflow, color: "text-primary" },
          { label: "Running", value: running, icon: Activity, color: "text-blue-400" },
          { label: "Completed", value: completed, icon: CheckCircle2, color: "text-emerald-400" },
          { label: "Failed/Terminated", value: failed, icon: XCircle, color: "text-red-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-card border-border/50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <Icon className={cn("w-5 h-5", color)} />
                <div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="text-xl font-bold">{value}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Workflow Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {WORKFLOW_TYPES.map(wt => {
          const count = workflows.filter(w => w.type === wt.value).length;
          const runningCount = workflows.filter(w => w.type === wt.value && w.status === "RUNNING").length;
          const Icon = wt.icon;
          return (
            <Card
              key={wt.value}
              className={cn(
                "bg-card border-border/50 cursor-pointer transition-colors",
                typeFilter === (wt.value as string) && "border-primary/50 bg-primary/5"
              )}
              onClick={() => setTypeFilter(typeFilter === wt.value ? "all" : wt.value)}
            >
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-primary" />
                    <div>
                      <div className="text-sm font-medium">{wt.label}</div>
                      <div className="text-xs text-muted-foreground">{wt.description}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{count}</div>
                    {runningCount > 0 && (
                      <Badge variant="outline" className="text-xs bg-blue-950/30 text-blue-400 border-blue-800/40">
                        {runningCount} running
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Workflow Table */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              {typeFilter === "all" ? "All Workflows" : WORKFLOW_TYPES.find(t => t.value === typeFilter)?.label ?? typeFilter}
              <span className="ml-2 text-muted-foreground font-normal">({workflows.length})</span>
            </CardTitle>
            {typeFilter !== "all" && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setTypeFilter("all")}>
                Clear filter
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">
              <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-40" />
              Loading workflows...
            </div>
          ) : workflows.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Workflow className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No workflows found</p>
              <p className="text-xs mt-1">Start a workflow to begin orchestration</p>
              <Button className="mt-4" size="sm" onClick={() => setStartOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> Start First Workflow
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workflow ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Closed</TableHead>
                  <TableHead>Last Signal</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflows.map(wf => {
                  const sc = getStatusConfig(wf.status);
                  const StatusIcon = sc.icon;
                  const wfType = WORKFLOW_TYPES.find(t => t.value === wf.type);
                  return (
                    <TableRow key={wf.workflowId}>
                      <TableCell className="font-mono text-xs">{wf.workflowId}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {wfType && (() => { const WfIcon = wfType.icon; return <WfIcon className="w-3.5 h-3.5 text-muted-foreground" />; })()}
                          <span className="text-sm">{wfType?.label ?? wf.type}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-xs", sc.color)}>
                          {(() => { const SI = sc.icon; return <SI className="w-3 h-3 mr-1" />; })()}
                          {sc.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {wf.startTime ? new Date(wf.startTime).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {wf.closeTime ? new Date(wf.closeTime).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{wf.lastSignal ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {wf.status === "RUNNING" && (
                            <>
                              <Button
                                variant="ghost" size="sm" className="h-7 px-2 text-xs"
                                onClick={() => { setSelectedWorkflow(wf); setSignalOpen(true); }}
                              >
                                <Signal className="w-3.5 h-3.5 mr-1" />Signal
                              </Button>
                              <Button
                                variant="ghost" size="sm" className="h-7 px-2 text-xs text-red-400 hover:text-red-300"
                                onClick={() => {
                                  if (confirm(`Terminate workflow "${wf.workflowId}"?`)) {
                                    terminateMut.mutate({ workflowId: wf.workflowId, reason: "Terminated by operator" });
                                  }
                                }}
                              >
                                <Square className="w-3.5 h-3.5 mr-1" />Terminate
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <StartWorkflowDialog open={startOpen} onClose={() => setStartOpen(false)} onStarted={() => refetch()} />
      <SignalDialog workflow={selectedWorkflow} open={signalOpen} onClose={() => setSignalOpen(false)} onSignaled={() => refetch()} />
    </div>
  );
}
