import { useTranslation } from 'react-i18next';
/**
 * Workovers Page — Workover/Intervention Job Management
 * Design: Dark Amber — Syne headings · DM Sans body · JetBrains Mono data
 * Integrates with Temporal durable workflows and TigerBeetle financial ledger
 */

import { useState } from "react";
import { Link } from "wouter";
import {
  Wrench, Plus, Clock, CheckCircle2, AlertTriangle, XCircle,
  ChevronDown, ChevronRight, DollarSign, Calendar, User,
  Activity, Layers, ArrowUpRight, Filter, Search, BarChart3,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
// useWorkovers removed - using live tRPC data
type WorkoverJob = Record<string, any>;
type WorkoverCostEntry = Record<string, any>;

// ── Status / Priority config ──────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: LucideIcon; color: string }> = {
  PLANNED:     { label: "Planned",     badge: "status-badge-drilling", icon: Clock,         color: "text-blue-400" },
  APPROVED:    { label: "Approved",    badge: "status-badge-normal",   icon: CheckCircle2,  color: "text-emerald-400" },
  IN_PROGRESS: { label: "In Progress", badge: "status-badge-warning",  icon: Activity,      color: "text-amber-400" },
  COMPLETED:   { label: "Completed",   badge: "status-badge-normal",   icon: CheckCircle2,  color: "text-emerald-400" },
  CANCELLED:   { label: "Cancelled",   badge: "status-badge-offline",  icon: XCircle,       color: "text-muted-foreground" },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  CRITICAL: { label: "CRITICAL", color: "status-badge-critical" },
  HIGH:     { label: "HIGH",     color: "status-badge-warning" },
  MEDIUM:   { label: "MEDIUM",   color: "status-badge-drilling" },
  LOW:      { label: "LOW",      color: "status-badge-offline" },
};

const JOB_TYPES = [
  "ESP_REPLACEMENT", "SCALE_REMOVAL", "TUBING_REPLACEMENT", "SAND_CLEANOUT",
  "PERFORATION", "ACIDIZING", "HYDRAULIC_FRACTURING", "PUMP_REPAIR",
  "WELLBORE_CLEANOUT", "PLUG_ABANDONMENT",
];

const COST_CATEGORIES = ["LABOR", "EQUIPMENT", "MATERIALS", "TRANSPORT", "SERVICES", "OTHER"];

// ── Cost entry row ────────────────────────────────────────────────────────────

function CostEntryRow({ entry }: { entry: WorkoverCostEntry }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
      <div className="w-20 shrink-0">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">{entry.category}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground truncate">{entry.description}</p>
        {entry.vendor && <p className="text-[10px] text-muted-foreground">{entry.vendor}</p>}
      </div>
      <div className="text-xs font-mono text-foreground shrink-0">
        ${entry.amount_usd.toLocaleString()}
      </div>
      <div className="text-[10px] font-mono text-muted-foreground shrink-0 w-20 text-right">
        {entry.date}
      </div>
    </div>
  );
}

// ── Job card (expandable) ─────────────────────────────────────────────────────

function JobCard({ job, onUpdateStatus }: { job: WorkoverJob; onUpdateStatus?: (id: number, status: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const statusCfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.PLANNED;
  const priorityCfg = PRIORITY_CONFIG[job.priority] ?? PRIORITY_CONFIG.MEDIUM;
  const StatusIcon = statusCfg.icon;

  const costPct = job.estimated_cost_usd > 0
    ? Math.min(100, (job.actual_cost_usd / job.estimated_cost_usd) * 100)
    : 0;
  const isOverBudget = job.actual_cost_usd > job.estimated_cost_usd;

  const durationPct = job.actual_duration_days && job.estimated_duration_days > 0
    ? Math.min(100, (job.actual_duration_days / job.estimated_duration_days) * 100)
    : job.status === "IN_PROGRESS" && job.actual_start
    ? Math.min(95, ((Date.now() - new Date(job.actual_start).getTime()) / (job.estimated_duration_days * 86_400_000)) * 100)
    : 0;

  return (
    <div className={cn(
      "rounded-lg border transition-all duration-200",
      job.priority === "CRITICAL" ? "border-red-800/40 bg-red-950/5" :
      job.priority === "HIGH" ? "border-amber-800/30 bg-amber-950/5" :
      "border-border/50 bg-card"
    )}>
      {/* Header row */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="mt-0.5">
          {expanded
            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-mono text-muted-foreground">{job.job_id}</span>
            <span className={priorityCfg.color}>{priorityCfg.label}</span>
            <span className={statusCfg.badge}>
              <StatusIcon className="w-3 h-3" />
              {statusCfg.label}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">
              {job.job_type.replace(/_/g, " ")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/wells/${job.well_id}`}>
              <span className="text-sm font-medium text-foreground hover:text-amber-400 transition-colors">
                {job.well_name}
              </span>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{job.description}</p>
        </div>

        {/* Right-side summary */}
        <div className="hidden md:flex items-center gap-6 shrink-0">
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground">Est. Cost</div>
            <div className="text-sm font-mono font-bold text-foreground">
              ${(job.estimated_cost_usd / 1000).toFixed(0)}k
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground">Actual</div>
            <div className={cn("text-sm font-mono font-bold", isOverBudget ? "text-red-400" : "text-emerald-400")}>
              ${(job.actual_cost_usd / 1000).toFixed(0)}k
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground">Duration</div>
            <div className="text-sm font-mono font-bold text-foreground">
              {job.actual_duration_days ?? job.estimated_duration_days}d
            </div>
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/30 pt-4">
          {/* Meta grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Supervisor</div>
              <div className="text-xs text-foreground flex items-center gap-1">
                <User className="w-3 h-3 text-muted-foreground" />
                {job.supervisor}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Crew</div>
              <div className="text-xs text-foreground">{job.assigned_crew}</div>
            </div>
            {job.rig_name && (
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Rig</div>
                <div className="text-xs text-foreground">{job.rig_name}</div>
              </div>
            )}
            {job.scheduled_start && (
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Scheduled Start</div>
                <div className="text-xs text-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-muted-foreground" />
                  {job.scheduled_start.split("T")[0]}
                </div>
              </div>
            )}
          </div>

          {/* Reason */}
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Reason / Trigger</div>
            <p className="text-xs text-foreground bg-muted/20 rounded p-2 border border-border/30">{job.reason}</p>
          </div>

          {/* Budget progress */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Budget Utilization</span>
                <span className={cn("text-[10px] font-mono", isOverBudget ? "text-red-400" : "text-muted-foreground")}>
                  ${job.actual_cost_usd.toLocaleString()} / ${job.estimated_cost_usd.toLocaleString()}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-700", isOverBudget ? "bg-red-500" : "bg-amber-500")}
                  style={{ width: `${costPct}%` }}
                />
              </div>
              <div className="flex justify-between mt-0.5">
                <span className="text-[9px] text-muted-foreground font-mono">0%</span>
                <span className={cn("text-[9px] font-mono", isOverBudget ? "text-red-400" : "text-muted-foreground")}>
                  {costPct.toFixed(0)}% utilized
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Duration Progress</span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {job.estimated_duration_days}d estimated
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-700"
                  style={{ width: `${durationPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Temporal workflow */}
          {job.temporal_workflow_id && (
            <div className="flex items-center gap-2 p-2 rounded bg-muted/20 border border-border/30">
              <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-muted-foreground">Temporal Workflow: </span>
                <span className="text-[10px] font-mono text-foreground">{job.temporal_workflow_id}</span>
              </div>
              <button
                className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-0.5"
                onClick={() => window.open(`https://temporal.io/`, '_blank')}
              >
                View <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Cost entries */}
          {job.cost_entries.length > 0 && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                Cost Breakdown — TigerBeetle Ledger
              </div>
              <div className="rounded-md border border-border/30 overflow-hidden">
                <div className="bg-muted/20 px-3 py-1.5 flex items-center gap-3 border-b border-border/30">
                  <span className="text-[10px] text-muted-foreground w-20">Category</span>
                  <span className="text-[10px] text-muted-foreground flex-1">Description</span>
                  <span className="text-[10px] text-muted-foreground">Amount</span>
                  <span className="text-[10px] text-muted-foreground w-20 text-right">Date</span>
                </div>
                <div className="px-3">
                  {job.cost_entries.map((e: any) => <CostEntryRow key={e.entry_id} entry={e} />)}
                </div>
                <div className="bg-muted/20 px-3 py-2 border-t border-border/30 flex justify-between">
                  <span className="text-xs text-muted-foreground font-mono">Total Recorded</span>
                  <span className="text-xs font-mono font-bold text-foreground">
                    ${job.cost_entries.reduce((s: number, e: any) => s + e.amount_usd, 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {job.notes && (
            <div className="p-2 rounded bg-emerald-950/20 border border-emerald-800/30">
              <p className="text-xs text-emerald-300">{job.notes}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            {job.status === "PLANNED" && (
              <Button size="sm" variant="outline" className="text-xs h-7 border-amber-700/40 text-amber-400 hover:bg-amber-950/20"
                onClick={() => onUpdateStatus?.(job._dbId, "IN_PROGRESS")}>
                Approve & Start
              </Button>
            )}
            {job.status === "IN_PROGRESS" && (
              <>
                <Button size="sm" variant="outline" className="text-xs h-7 border-emerald-700/40 text-emerald-400 hover:bg-emerald-950/20"
                  onClick={() => onUpdateStatus?.(job._dbId, "COMPLETED")}>
                  Mark Complete
                </Button>
                <Button size="sm" variant="outline" className="text-xs h-7 border-red-700/40 text-red-400 hover:bg-red-950/20"
                  onClick={() => onUpdateStatus?.(job._dbId, "SUSPENDED")}>
                  Suspend
                </Button>
              </>
            )}
            <Button size="sm" variant="outline" className="text-xs h-7 border-border/50"
              onClick={() => {
                const report = `WORKOVER JOB REPORT\n${'='.repeat(40)}\nJob ID: ${job.job_id}\nWell: ${job.well_name}\nType: ${job.job_type}\nStatus: ${job.status}\nPriority: ${job.priority}\nDescription: ${job.description}\nSupervisor: ${job.supervisor}\nEst. Cost: $${job.estimated_cost_usd?.toLocaleString()}\nActual Cost: $${job.actual_cost_usd?.toLocaleString()}\nGenerated: ${new Date().toISOString()}`;
                const blob = new Blob([report], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `workover-${job.job_id}.txt`; a.click();
                URL.revokeObjectURL(url);
                toast.success('Report exported');
              }}>
              Export Report
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── New Job Dialog ────────────────────────────────────────────────────────────

function NewJobDialog({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (data: any) => void }) {
  const [form, setForm] = useState({
    well_id: "", job_type: "", priority: "MEDIUM", description: "",
    reason: "", supervisor: "", estimated_duration_days: "", estimated_cost_usd: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.well_id || !form.job_type || !form.description) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSubmitting(true);
    try {
      await onCreate({
        wellId: form.well_id,
        jobType: form.job_type,
        priority: form.priority,
        description: form.description,
        reason: form.reason || undefined,
        supervisor: form.supervisor || undefined,
        estimatedDurationDays: form.estimated_duration_days ? parseInt(form.estimated_duration_days) : undefined,
        estimatedCostUsd: form.estimated_cost_usd ? parseFloat(form.estimated_cost_usd) : undefined,
      });
      setForm({ well_id: "", job_type: "", priority: "MEDIUM", description: "", reason: "", supervisor: "", estimated_duration_days: "", estimated_cost_usd: "" });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border/50 max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-[Syne] text-base flex items-center gap-2">
            <Wrench className="w-4 h-4 text-amber-400" />
            New Workover / Intervention Job
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Well ID *</label>
              <Input
                className="h-8 text-xs font-mono bg-muted/20 border-border/50"
                placeholder="e.g. well-001"
                value={form.well_id}
                onChange={e => setForm(f => ({ ...f, well_id: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Job Type *</label>
              <Select value={form.job_type} onValueChange={v => setForm(f => ({ ...f, job_type: v }))}>
                <SelectTrigger className="h-8 text-xs bg-muted/20 border-border/50">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border/50">
                  {JOB_TYPES.map(t => (
                    <SelectItem key={t} value={t} className="text-xs">{t.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Priority</label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger className="h-8 text-xs bg-muted/20 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border/50">
                  {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map(p => (
                    <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Supervisor</label>
              <Input
                className="h-8 text-xs bg-muted/20 border-border/50"
                placeholder="Name"
                value={form.supervisor}
                onChange={e => setForm(f => ({ ...f, supervisor: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Description *</label>
            <textarea
              className="w-full h-16 text-xs bg-muted/20 border border-border/50 rounded-md px-3 py-2 text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Describe the workover scope..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Reason / Trigger</label>
            <textarea
              className="w-full h-12 text-xs bg-muted/20 border border-border/50 rounded-md px-3 py-2 text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="What triggered this job? (ML alert, inspection finding, etc.)"
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Est. Duration (days)</label>
              <Input
                className="h-8 text-xs font-mono bg-muted/20 border-border/50"
                type="number"
                placeholder="3"
                value={form.estimated_duration_days}
                onChange={e => setForm(f => ({ ...f, estimated_duration_days: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Est. Cost (USD)</label>
              <Input
                className="h-8 text-xs font-mono bg-muted/20 border-border/50"
                type="number"
                placeholder="150000"
                value={form.estimated_cost_usd}
                onChange={e => setForm(f => ({ ...f, estimated_cost_usd: e.target.value }))}
              />
            </div>
          </div>
          <div className="p-2 rounded bg-amber-950/20 border border-amber-800/30">
            <p className="text-[10px] text-amber-400">
              On submit: Temporal durable workflow will be initiated, cost tracking ledger opened in TigerBeetle, and crew notification dispatched.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" className="text-xs border-border/50" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="text-xs bg-amber-600 hover:bg-amber-500 text-white" onClick={handleSubmit}>
            Create Job & Start Workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WorkoversPage() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { data: liveJobs } = trpc.wells.allWorkovers.useQuery({});
  const updateStatusMutation = trpc.wells.updateWorkoverStatus.useMutation({
    onSuccess: () => utils.wells.allWorkovers.invalidate(),
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });
  const createMutation = trpc.wells.createWorkover.useMutation({
    onSuccess: () => { utils.wells.allWorkovers.invalidate(); toast.success("Workover job created — Temporal workflow initiated"); },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const jobs = ((liveJobs ?? []) as any[]).map((j: any) => ({
        job_id: j.jobId,
        well_id: j.wellId,
        well_name: j.wellId,
        job_type: j.jobType,
        status: j.status,
        priority: j.priority,
        description: j.description ?? "",
        reason: j.reason ?? "",
        supervisor: j.supervisor ?? "",
        estimated_duration_days: j.estimatedDurationDays ?? 0,
        actual_duration_days: j.actualDurationDays ?? 0,
        estimated_cost_usd: Number(j.estimatedCostUsd ?? 0),
        actual_cost_usd: Number(j.actualCostUsd ?? 0),
        start_date: j.startDate ?? null,
        end_date: j.endDate ?? null,
        temporal_workflow_id: j.temporalWorkflowId ?? null,
        notes: j.notes ?? "",
      cost_entries: [],
    }));

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);

  const filtered = jobs.filter(j => {
    if (statusFilter !== "ALL" && j.status !== statusFilter) return false;
    if (priorityFilter !== "ALL" && j.priority !== priorityFilter) return false;
    if (search && !j.well_name.toLowerCase().includes(search.toLowerCase()) &&
        !j.job_id.toLowerCase().includes(search.toLowerCase()) &&
        !j.job_type.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Summary stats
  const totalEstimated = jobs.reduce((s, j) => s + j.estimated_cost_usd, 0);
  const totalActual = jobs.reduce((s, j) => s + j.actual_cost_usd, 0);
  const inProgress = jobs.filter(j => j.status === "IN_PROGRESS").length;
  const critical = jobs.filter(j => j.priority === "CRITICAL").length;

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-[Syne] flex items-center gap-2">
            <Wrench className="w-5 h-5 text-amber-400" />
            {t('workovers.title')}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Field operations management with automated workflow tracking and cost control
          </p>
        </div>
        <Button
          size="sm"
          className="bg-amber-600 hover:bg-amber-500 text-white text-xs shrink-0"
          onClick={() => setShowNew(true)}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          New Job
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="kpi-card">
          <div className="text-xs text-muted-foreground mb-1">Total Jobs</div>
          <div className="text-3xl font-mono font-bold text-foreground">{jobs.length}</div>
          <div className="text-[10px] text-muted-foreground mt-1 font-mono">{inProgress} in progress</div>
        </div>
        <div className={cn("kpi-card", critical > 0 && "border-red-700/40")}>
          <div className="text-xs text-muted-foreground mb-1">Critical Priority</div>
          <div className={cn("text-3xl font-mono font-bold", critical > 0 ? "text-red-400" : "text-foreground")}>
            {critical}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 font-mono">requiring immediate action</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs text-muted-foreground mb-1">Total Estimated</div>
          <div className="text-3xl font-mono font-bold text-amber-400">
            ${(totalEstimated / 1000).toFixed(0)}k
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 font-mono">across all jobs</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs text-muted-foreground mb-1">Actual Spend</div>
          <div className={cn("text-3xl font-mono font-bold", totalActual > totalEstimated ? "text-red-400" : "text-emerald-400")}>
            ${(totalActual / 1000).toFixed(0)}k
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 font-mono">
            {totalEstimated > 0 ? ((totalActual / totalEstimated) * 100).toFixed(0) : 0}% of budget
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            className="h-8 text-xs pl-8 bg-muted/20 border-border/50"
            placeholder="Search jobs, wells..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-36 text-xs bg-muted/20 border-border/50">
            <Filter className="w-3 h-3 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border/50">
            <SelectItem value="ALL" className="text-xs">All Statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="h-8 w-36 text-xs bg-muted/20 border-border/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border/50">
            <SelectItem value="ALL" className="text-xs">All Priorities</SelectItem>
            {Object.keys(PRIORITY_CONFIG).map(p => (
              <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground font-mono ml-auto">
          {filtered.length} of {jobs.length} jobs
        </span>
      </div>

      {/* Job list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Wrench className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No workover jobs match the current filters</p>
          </div>
        ) : (
          filtered.map(job => <JobCard key={job.job_id} job={job as any} onUpdateStatus={(id, status) => updateStatusMutation.mutate({ id, status: status as any })} />)
        )}
      </div>

      {/* Workflow info banner */}
      <Card className="bg-card border-border/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Layers className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-foreground mb-1">Temporal Workflow Orchestration</p>
              <p className="text-xs text-muted-foreground">
                Each workover job spawns a durable Temporal workflow that manages state transitions (PLANNED → APPROVED → IN_PROGRESS → COMPLETED),
                sends crew notifications via the Alarm Manager, tracks cost entries in real-time against the TigerBeetle double-entry ledger,
                and triggers royalty settlement recalculation via Mojaloop when the job is closed.
              </p>
              <div className="flex items-center gap-4 mt-2">
                <button
                  className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-0.5"
                  onClick={() => toast.info("Temporal UI dashboard — configure TEMPORAL_UI_URL in environment")}
                >
                  Open Temporal UI <ArrowUpRight className="w-3 h-3" />
                </button>
                <button
                  className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-0.5"
                  onClick={() => toast.info("Financial ledger view available in the Financials page")}
                >
                  View Ledger <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <NewJobDialog open={showNew} onClose={() => setShowNew(false)} onCreate={createMutation.mutateAsync} />
    </div>
  );
}
