/**
 * TemporalWorkflows.tsx — Durable Workflow Management Page
 *
 * Displays and manages Temporal workflows for workover lifecycle state machines.
 * Supports listing, starting, cancelling, and inspecting workflow status.
 *
 * When TEMPORAL_ADDRESS is not configured, the page shows simulated workflow data
 * with a clear "SIMULATION MODE" indicator.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Play,
  StopCircle,
  RefreshCw,
  Workflow,
  Server,
  Zap,
  Info,
} from "lucide-react";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface WorkflowStatus {
  workflowId: string;
  runId: string;
  status: "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "TIMED_OUT" | "SIMULATED";
  startTime: string;
  closeTime?: string;
  workflowType: string;
  taskQueue: string;
}

// ─── STATUS CONFIG ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  RUNNING: { label: "Running", color: "text-amber-400 bg-amber-950/40 border-amber-800/50", icon: Activity },
  COMPLETED: { label: "Completed", color: "text-emerald-400 bg-emerald-950/40 border-emerald-800/50", icon: CheckCircle2 },
  FAILED: { label: "Failed", color: "text-red-400 bg-red-950/40 border-red-800/50", icon: XCircle },
  CANCELLED: { label: "Cancelled", color: "text-gray-400 bg-gray-900/40 border-gray-700/50", icon: StopCircle },
  TIMED_OUT: { label: "Timed Out", color: "text-orange-400 bg-orange-950/40 border-orange-800/50", icon: Clock },
  SIMULATED: { label: "Simulated", color: "text-blue-400 bg-blue-950/40 border-blue-800/50", icon: Zap },
};

// ─── WORKFLOW CARD ────────────────────────────────────────────────────────────

function WorkflowCard({
  workflow,
  onCancel,
  isAdmin,
}: {
  workflow: WorkflowStatus;
  onCancel: (id: string) => void;
  isAdmin: boolean;
}) {
  const cfg = STATUS_CONFIG[workflow.status] ?? STATUS_CONFIG.SIMULATED;
  const StatusIcon = cfg.icon;
  const duration = workflow.closeTime
    ? Math.round((new Date(workflow.closeTime).getTime() - new Date(workflow.startTime).getTime()) / 60000)
    : Math.round((Date.now() - new Date(workflow.startTime).getTime()) / 60000);

  return (
    <div className="bg-card border border-border/50 rounded-lg p-4 space-y-3 hover:border-amber-800/30 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-mono font-semibold text-amber-400 truncate">
              {workflow.workflowId}
            </span>
            <span className={cn("inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border font-mono", cfg.color)}>
              <StatusIcon className="w-3 h-3" />
              {cfg.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-mono flex-wrap">
            <span className="flex items-center gap-1">
              <Workflow className="w-3 h-3" />
              {workflow.workflowType}
            </span>
            <span className="flex items-center gap-1">
              <Server className="w-3 h-3" />
              {workflow.taskQueue}
            </span>
          </div>
        </div>
        {workflow.status === "RUNNING" && isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCancel(workflow.workflowId)}
            className="text-xs border-red-800/50 text-red-400 hover:bg-red-950/20 shrink-0"
          >
            <StopCircle className="w-3 h-3 mr-1" />
            Cancel
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-muted-foreground mb-0.5">Started</div>
          <div className="font-mono">{new Date(workflow.startTime).toLocaleString()}</div>
        </div>
        {workflow.closeTime && (
          <div>
            <div className="text-muted-foreground mb-0.5">Closed</div>
            <div className="font-mono">{new Date(workflow.closeTime).toLocaleString()}</div>
          </div>
        )}
        <div>
          <div className="text-muted-foreground mb-0.5">Duration</div>
          <div className="font-mono">
            {duration < 60 ? `${duration}m` : `${Math.floor(duration / 60)}h ${duration % 60}m`}
            {workflow.status === "RUNNING" && <span className="text-amber-500/70 ml-1">(running)</span>}
          </div>
        </div>
      </div>

      <div className="text-[10px] text-muted-foreground/50 font-mono truncate">
        Run: {workflow.runId}
      </div>
    </div>
  );
}

// ─── START WORKFLOW DIALOG ────────────────────────────────────────────────────

function StartWorkflowDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    workoverJobId: `WO-${new Date().getFullYear()}-MANUAL`,
    wellId: "PB-047",
    jobType: "PUMP_REPLACEMENT",
    estimatedDays: 3,
    estimatedCost: 50000,
    contractor: "WT Field Services",
    description: "Manual workflow start from Temporal dashboard",
  });

  const startMutation = trpc.temporal.startWorkover.useMutation({
    onSuccess: (data) => {
      toast.success(`Workflow started: ${data.workflowId}`);
      onClose();
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border/50 max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-[Syne] text-sm flex items-center gap-2">
            <Play className="w-4 h-4 text-amber-400" />
            Start Workover Workflow
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Job ID</Label>
              <Input
                value={form.workoverJobId}
                onChange={e => setForm(f => ({ ...f, workoverJobId: e.target.value }))}
                className="text-xs h-8 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Well ID</Label>
              <Select value={form.wellId} onValueChange={v => setForm(f => ({ ...f, wellId: v }))}>
                <SelectTrigger className="text-xs h-8 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["PB-047", "PB-052", "KW-001", "KW-002", "UAE-001", "UAE-002", "GOM-001", "NS-001"].map(id => (
                    <SelectItem key={id} value={id} className="text-xs">{id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Job Type</Label>
            <Select value={form.jobType} onValueChange={v => setForm(f => ({ ...f, jobType: v }))}>
              <SelectTrigger className="text-xs h-8 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["PUMP_REPLACEMENT", "TUBING_REPAIR", "STIMULATION", "PERFORATION", "SAND_CONTROL", "SCALE_REMOVAL", "CALIBRATION", "INSPECTION"].map(t => (
                  <SelectItem key={t} value={t} className="text-xs">{t.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Est. Days</Label>
              <Input
                type="number"
                value={form.estimatedDays}
                onChange={e => setForm(f => ({ ...f, estimatedDays: Number(e.target.value) }))}
                className="text-xs h-8 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Budget (USD)</Label>
              <Input
                type="number"
                value={form.estimatedCost}
                onChange={e => setForm(f => ({ ...f, estimatedCost: Number(e.target.value) }))}
                className="text-xs h-8 mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Contractor</Label>
            <Input
              value={form.contractor}
              onChange={e => setForm(f => ({ ...f, contractor: e.target.value }))}
              className="text-xs h-8 mt-1"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="text-xs h-8 mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => startMutation.mutate(form)}
            disabled={startMutation.isPending}
            className="text-xs bg-amber-700 hover:bg-amber-600 text-white"
          >
            <Play className="w-3 h-3 mr-1" />
            {startMutation.isPending ? "Starting…" : "Start Workflow"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function TemporalWorkflows() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [showStartDialog, setShowStartDialog] = useState(false);

  const { data: health } = trpc.temporal.health.useQuery();
  const { data: workflows, refetch, isFetching } = trpc.temporal.list.useQuery(
    { limit: 50 },
    { refetchInterval: 30000 }
  );

  const cancelMutation = trpc.temporal.cancel.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Workflow cancelled");
        refetch();
      } else {
        toast.error("Cancel failed — workflow may have already completed");
      }
    },
    onError: (err) => toast.error(`Cancel failed: ${err.message}`),
  });

  const filtered = (workflows ?? []).filter(w =>
    filterStatus === "ALL" || w.status === filterStatus
  );

  const stats = {
    total: workflows?.length ?? 0,
    running: workflows?.filter(w => w.status === "RUNNING").length ?? 0,
    completed: workflows?.filter(w => w.status === "COMPLETED").length ?? 0,
    failed: workflows?.filter(w => w.status === "FAILED").length ?? 0,
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold font-[Syne] flex items-center gap-2">
            <Workflow className="w-5 h-5 text-amber-400" />
            Automated Workflows
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automated field operation workflows with real-time status tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs"
          >
            <RefreshCw className={cn("w-3 h-3 mr-1", isFetching && "animate-spin")} />
            Refresh
          </Button>
          {isAdmin && (
            <Button
              size="sm"
              onClick={() => setShowStartDialog(true)}
              className="text-xs bg-amber-700 hover:bg-amber-600 text-white"
            >
              <Play className="w-3 h-3 mr-1" />
              Start Workflow
            </Button>
          )}
        </div>
      </div>

      {/* Connection status banner */}
      {health && (
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono",
          health.mode === "live"
            ? "border-emerald-800/50 bg-emerald-950/20 text-emerald-400"
            : "border-blue-800/50 bg-blue-950/20 text-blue-400"
        )}>
          {health.mode === "live" ? (
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <Info className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>
            {health.mode === "live"
              ? `Workflow engine connected at ${health.address}`
              : "Demo mode — connect a workflow engine to enable live orchestration"}
          </span>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Workflows", value: stats.total, color: "text-white" },
          { label: "Running", value: stats.running, color: "text-amber-400" },
          { label: "Completed", value: stats.completed, color: "text-emerald-400" },
          { label: "Failed", value: stats.failed, color: "text-red-400" },
        ].map(({ label, value, color }) => (
          <Card key={label} className="bg-card border-border/50">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-muted-foreground mb-1">{label}</div>
              <div className={cn("text-2xl font-mono font-bold tabular-nums", color)}>{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {["ALL", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-md border transition-all font-mono",
              filterStatus === s
                ? "border-amber-700/60 bg-amber-950/30 text-amber-400"
                : "border-border/50 text-muted-foreground hover:border-amber-800/30"
            )}
          >
            {s}
            {s !== "ALL" && (
              <span className="ml-1.5 text-[9px] opacity-60">
                {(workflows ?? []).filter(w => w.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Workflow list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Workflow className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No workflows found</p>
            <p className="text-xs mt-1 opacity-60">
              {filterStatus !== "ALL" ? `No ${filterStatus.toLowerCase()} workflows` : "Start a workover to create a workflow"}
            </p>
          </div>
        ) : (
          filtered.map(wf => (
            <WorkflowCard
              key={wf.workflowId}
              workflow={wf as WorkflowStatus}
              onCancel={(id) => cancelMutation.mutate({ workflowId: id })}
              isAdmin={isAdmin}
            />
          ))
        )}
      </div>

      {/* Architecture note */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-[Syne] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Workflow Architecture
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid md:grid-cols-3 gap-4 text-xs text-muted-foreground">
            <div>
              <div className="text-amber-400 font-semibold mb-1 font-mono">workoverExecute</div>
              <p>Full workover lifecycle: PLANNED → MOBILIZING → IN_PROGRESS → COMPLETED. Handles contractor coordination, cost tracking, and automatic status escalation with configurable SLAs.</p>
            </div>
            <div>
              <div className="text-blue-400 font-semibold mb-1 font-mono">alarm.escalate</div>
              <p>ISA-18.2 alarm escalation state machine. Tracks acknowledgement SLAs, fires email/SMS at configurable thresholds, and auto-escalates to supervisor if unacknowledged.</p>
            </div>
            <div>
              <div className="text-emerald-400 font-semibold mb-1 font-mono">calibration.schedule</div>
              <p>Sensor calibration scheduling with reminder workflows. Triggers 30/7/1-day reminders, auto-creates workover jobs on overdue calibrations, and updates compliance records.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <StartWorkflowDialog
        open={showStartDialog}
        onClose={() => setShowStartDialog(false)}
      />
    </div>
  );
}
