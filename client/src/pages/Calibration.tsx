/**
 * Calibration.tsx — Sensor Calibration Scheduling & Drift Monitoring
 * Design: Dark Amber — calibration status uses traffic-light color coding
 * WT Petrotech Gap Closure: Testing and Calibration Systems, Sensor Drift Alerts
 */

import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  AlertTriangle, Calendar, CheckCircle2, ChevronDown, ChevronUp,
  Clock, Filter, FlaskConical, Search, TrendingUp, Wrench, XCircle
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line, ReferenceLine
} from "recharts";
type CalibrationRecord = Record<string, any>;
type CalibrationStatus = string;
import { trpc } from "@/lib/trpc";
import {
  autoGenerateCalibrationWorkorder,
  autoGenerateAllOverdueWorkorders,
  type CalibrationWorkorderResult,
} from "@/lib/calibration-workover-bridge";

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusConfig(status: CalibrationStatus) {
  switch (status) {
    case "OVERDUE":
      return { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", icon: XCircle, label: "Overdue" };
    case "DUE_SOON":
      return { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", icon: Clock, label: "Due Soon" };
    case "CURRENT":
      return { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: CheckCircle2, label: "Current" };
    case "IN_PROGRESS":
      return { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", icon: FlaskConical, label: "In Progress" };
    case "FAILED":
      return { color: "text-red-400", bg: "bg-red-500/20", border: "border-red-500/40", icon: AlertTriangle, label: "Failed" };
    default:
      return { color: "text-muted-foreground", bg: "bg-muted", border: "border-border", icon: Clock, label: status };
  }
}

function driftColor(drift: number, threshold: number) {
  const ratio = drift / threshold;
  if (ratio >= 1.0) return "text-red-400";
  if (ratio >= 0.7) return "text-amber-400";
  return "text-emerald-400";
}

// Drift trend data (simulated 30-day history)
function generateDriftHistory(record: CalibrationRecord) {
  return Array.from({ length: 30 }, (_, i) => ({
    day: `D-${30 - i}`,
    drift: Math.max(0, record.current_drift_pct - (30 - i) * 0.02 + Math.sin(i * 0.5) * 0.05),
    threshold: record.drift_threshold_pct,
  }));
}

// ── Calibration Row ───────────────────────────────────────────────────────────

function CalibrationRow({
  record,
  onSchedule,
}: {
  record: CalibrationRecord;
  onSchedule: (r: CalibrationRecord) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = statusConfig(record.status);
  const Icon = cfg.icon;
  const driftRatio = (record.current_drift_pct / record.drift_threshold_pct) * 100;
  const driftHistory = generateDriftHistory(record);

  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${cfg.border} ${record.status === "OVERDUE" ? "bg-red-950/10" : "bg-card"}`}>
      {/* Row header */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <Icon className={`w-4 h-4 flex-shrink-0 ${cfg.color}`} />

        <div className="flex-1 min-w-0 grid grid-cols-12 gap-2 items-center">
          {/* Sensor info */}
          <div className="col-span-3">
            <div className="text-sm font-mono font-bold text-foreground">{record.sensor_tag}</div>
            <div className="text-xs text-muted-foreground truncate">{record.sensor_name}</div>
          </div>

          {/* Well */}
          <div className="col-span-2 hidden md:block">
            <div className="text-xs text-muted-foreground">Well</div>
            <div className="text-xs font-medium truncate">{record.well_name}</div>
          </div>

          {/* Type */}
          <div className="col-span-1 hidden lg:block">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{record.sensor_type}</Badge>
          </div>

          {/* Drift */}
          <div className="col-span-2">
            <div className="text-xs text-muted-foreground mb-1">Drift</div>
            <div className="flex items-center gap-1.5">
              <Progress value={Math.min(driftRatio, 100)} className="h-1.5 flex-1" />
              <span className={`text-xs font-mono font-bold ${driftColor(record.current_drift_pct, record.drift_threshold_pct)}`}>
                {record.current_drift_pct.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Due date */}
          <div className="col-span-2">
            <div className="text-xs text-muted-foreground">Due Date</div>
            <div className={`text-xs font-mono font-bold ${cfg.color}`}>
              {record.days_until_due < 0
                ? `${Math.abs(record.days_until_due)}d overdue`
                : record.days_until_due === 0
                ? "Due today"
                : `${record.days_until_due}d`}
            </div>
          </div>

          {/* Status badge */}
          <div className="col-span-1">
            <Badge className={`${cfg.bg} ${cfg.color} ${cfg.border} text-[10px]`}>{cfg.label}</Badge>
          </div>

          {/* Protocol */}
          <div className="col-span-1 hidden xl:flex justify-end">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">{record.protocol}</Badge>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs px-2"
            onClick={e => { e.stopPropagation(); onSchedule(record); }}
          >
            <Wrench className="w-3 h-3 mr-1" />
            Schedule
          </Button>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border p-4 bg-muted/10 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Drift trend chart */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              30-Day Drift Trend
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={driftHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#6b7280" }} interval={9} />
                <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} domain={[0, record.drift_threshold_pct * 1.5]} />
                <Tooltip
                  contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", fontSize: "10px" }}
                />
                <ReferenceLine y={record.drift_threshold_pct} stroke="#ef4444" strokeDasharray="4,2" label={{ value: "Threshold", fontSize: 9, fill: "#ef4444" }} />
                <Line type="monotone" dataKey="drift" stroke="#d97706" strokeWidth={1.5} dot={false} name="Drift %" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Calibration details */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Calibration Details
            </div>
            {[
              ["Sensor Tag", record.sensor_tag],
              ["Protocol", record.protocol],
              ["Calibration Type", record.calibration_type],
              ["Interval", `${record.interval_days} days`],
              ["Last Calibrated", record.last_calibration_date ?? "Never"],
              ["Last Result", record.last_calibration_result ?? "N/A"],
              ["Last Performed By", record.last_calibration_by ?? "N/A"],
              ["Certificate No.", record.certificate_number ?? "N/A"],
              ["Drift Threshold", `${record.drift_threshold_pct}%`],
              ["Current Drift", `${record.current_drift_pct.toFixed(3)}%`],
              ["Assigned Tech", record.assigned_technician ?? "Unassigned"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-mono text-foreground">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Schedule Dialog ───────────────────────────────────────────────────────────

function ScheduleDialog({ record, open, onClose }: { record: CalibrationRecord | null; open: boolean; onClose: () => void }) {
  const [technician, setTechnician] = useState("");
  const [date, setDate] = useState("");

  if (!record) return null;

  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!technician || !date) {
      toast.error("Please fill in all fields");
      return;
    }
    setSubmitting(true);
    try {
      const result = await autoGenerateCalibrationWorkorder(record! as any, {
        supervisor: "Field Operations Manager",
        assigned_crew: technician,
        scheduled_start: new Date(date).toISOString(),
      });
      toast.success(`Work order ${result.workover_job.job_id} created`, {
        description: (
          <div className="space-y-0.5 text-xs">
            <div>Temporal workflow: <span className="font-mono">{result.temporal_workflow_id}</span></div>
            <div>Ledger entry: <span className="font-mono">{result.ledger_entry_id}</span></div>
            <div>TigerBeetle transfer: <span className="font-mono">{result.tigerbeetle_transfer_id}</span></div>
          </div>
        ) as any,
        duration: 8000,
      });
      onClose();
    } catch (err) {
      toast.error("Failed to create work order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-[Syne] flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-amber-400" />
            Schedule Calibration
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="bg-muted/30 rounded-lg p-3 space-y-1">
            <div className="text-sm font-mono font-bold">{record.sensor_tag}</div>
            <div className="text-xs text-muted-foreground">{record.sensor_name} — {record.well_name}</div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-[10px]">{record.sensor_type}</Badge>
              <Badge variant="outline" className="text-[10px] font-mono">{record.protocol}</Badge>
              {record.status === "OVERDUE" && (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">
                  {Math.abs(record.days_until_due)}d Overdue
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Scheduled Date</label>
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Assigned Technician</label>
              <Input
                placeholder="Technician name"
                value={technician}
                onChange={e => setTechnician(e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Calibration Type</label>
              <Select defaultValue={record.calibration_type}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ROUTINE">Routine</SelectItem>
                  <SelectItem value="DRIFT_CORRECTION">Drift Correction</SelectItem>
                  <SelectItem value="POST_REPAIR">Post Repair</SelectItem>
                  <SelectItem value="INITIAL">Initial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <><span className="w-3.5 h-3.5 mr-1.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />Creating...</>
              ) : (
                <><Calendar className="w-3.5 h-3.5 mr-1.5" />Schedule & Create Work Order</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CalibrationPage() {
  const utils = trpc.useUtils();
  const { data: liveRecords } = trpc.calibration.list.useQuery({});
  const updateStatusMutation = trpc.calibration.updateStatus.useMutation({
    onSuccess: () => utils.calibration.list.invalidate(),
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const allRecords: any[] = ((liveRecords as any[]) ?? []).map((r: any) => ({
    record_id: r.recordId ?? r.id,
    sensor_tag: r.sensorTag ?? r.tag ?? "",
    sensor_name: r.sensorName ?? r.tag ?? "",
    sensor_type: r.sensorType ?? "PRESSURE",
    well_name: r.wellId ?? "",
    status: r.status as CalibrationStatus,
    last_calibration_date: r.lastCalibrationDate ?? r.createdAt?.toISOString().slice(0,10) ?? "",
    next_due_date: r.nextDueDate ?? "",
    calibration_interval_days: r.calibrationIntervalDays ?? 90,
    current_drift_pct: Number(r.currentDriftPct ?? 0),
    drift_limit_pct: Number(r.driftLimitPct ?? 1.0),
    drift_threshold_pct: Number(r.driftLimitPct ?? 1.0),
    days_until_due: r.daysUntilDue ?? 0,
    technician: r.technician ?? "",
    certificate_id: r.certificateId ?? "",
    notes: r.notes ?? "",
    drift_history: [],
  }));

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [scheduleRecord, setScheduleRecord] = useState<CalibrationRecord | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [generatedJobs, setGeneratedJobs] = useState<CalibrationWorkorderResult[]>([]);

  const overdueCount = allRecords.filter(r => r.status === "OVERDUE" || r.status === "FAILED").length;

  const handleBulkGenerate = useCallback(async () => {
    setBulkGenerating(true);
    try {
      const results = await autoGenerateAllOverdueWorkorders(allRecords);
      setGeneratedJobs(results);
      toast.success(`${results.length} calibration work orders created`, {
        description: `Temporal workflows initiated · TigerBeetle ledger entries posted · Workovers page updated`,
        duration: 8000,
      });
    } catch (err) {
      toast.error("Bulk generation failed. Please try again.");
    } finally {
      setBulkGenerating(false);
    }
  }, []);

  const filtered = allRecords.filter(r => {
    const matchSearch =
      !search ||
      r.sensor_tag.toLowerCase().includes(search.toLowerCase()) ||
      r.sensor_name.toLowerCase().includes(search.toLowerCase()) ||
      r.well_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "ALL" || r.status === filterStatus;
    const matchType = filterType === "ALL" || r.sensor_type === filterType;
    return matchSearch && matchStatus && matchType;
  });

  // Sort: overdue first, then due_soon, then current
  const sorted = [...filtered].sort((a: any, b: any) => {
    const order: Record<string, number> = { OVERDUE: 0, DUE_SOON: 1, IN_PROGRESS: 2, FAILED: 3, CURRENT: 4 };
    return (order[a.status] ?? 5) - (order[b.status] ?? 5);
  });

  // Drift distribution chart data
  const driftBuckets = [
    { range: "0-0.25%", count: allRecords.filter(r => r.current_drift_pct < 0.25).length, color: "#10b981" },
    { range: "0.25-0.5%", count: allRecords.filter(r => r.current_drift_pct >= 0.25 && r.current_drift_pct < 0.5).length, color: "#10b981" },
    { range: "0.5-1%", count: allRecords.filter(r => r.current_drift_pct >= 0.5 && r.current_drift_pct < 1.0).length, color: "#f59e0b" },
    { range: ">1%", count: allRecords.filter(r => r.current_drift_pct >= 1.0).length, color: "#ef4444" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-[Syne] text-foreground">
            Calibration Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Instrument accuracy tracking · Calibration scheduling · Compliance certificates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-border/50"
            onClick={() => toast.info("Bulk calibration scheduling — select sensors first")}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Bulk Schedule
          </Button>
          {overdueCount > 0 && (
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleBulkGenerate}
              disabled={bulkGenerating}
            >
              {bulkGenerating ? (
                <><span className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />Generating...</>
              ) : (
                <><Wrench className="w-4 h-4 mr-2" />Auto-Generate {overdueCount} Workorders</>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Generated workorders banner */}
      {generatedJobs.length > 0 && (
        <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-[Syne] font-bold text-emerald-400">
                {generatedJobs.length} Calibration Work Orders Created
              </span>
            </div>
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setGeneratedJobs([])}
            >
              Dismiss
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {generatedJobs.map(r => (
              <div key={r.workover_job.job_id} className="bg-card rounded-md border border-border/50 p-2.5 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-foreground">{r.workover_job.job_id}</span>
                  <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">PLANNED</span>
                </div>
                <div className="text-muted-foreground">{r.workover_job.well_name}</div>
                <div className="font-mono text-[9px] text-muted-foreground truncate">
                  WF: {r.temporal_workflow_id}
                </div>
                <div className="font-mono text-[9px] text-amber-400">
                  ${r.workover_job.estimated_cost_usd.toLocaleString()} est.
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Sensors", value: allRecords.length, color: "text-foreground", icon: FlaskConical },
          { label: "Overdue", value: allRecords.filter(r => r.status === "OVERDUE").length, color: "text-red-400", icon: XCircle },
          { label: "Due Soon", value: allRecords.filter(r => r.status === "DUE_SOON").length, color: "text-amber-400", icon: Clock },
          { label: "Current", value: allRecords.filter(r => r.status === "CURRENT").length, color: "text-emerald-400", icon: CheckCircle2 },
          { label: "High Drift", value: allRecords.filter(r => r.current_drift_pct >= r.drift_threshold_pct * 0.7).length, color: "text-orange-400", icon: TrendingUp },
        ].map(({ label, value, color, icon: Icon }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`w-5 h-5 ${color}`} />
              <div>
                <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Drift distribution */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-[Syne]">Drift Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={driftBuckets} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="range" tick={{ fontSize: 10, fill: "#6b7280" }} />
                <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", fontSize: "11px" }}
                />
                <Bar dataKey="count" name="Sensors" radius={[3, 3, 0, 0]}>
                  {driftBuckets.map((entry, i) => (
                    <Cell key={i} fill={entry.color} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Due in next 30 days */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-[Syne]">Upcoming Calibrations (30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {allRecords
                .filter((r: any) => {
                  const due = r.next_due_date ? new Date(r.next_due_date) : null;
                  const d = due ? Math.floor((due.getTime() - Date.now()) / 86400000) : 999;
                  return d >= -7 && d <= 30;
                })
                .sort((a: any, b: any) => {
                  const dA = a.next_due_date ? new Date(a.next_due_date).getTime() : Infinity;
                  const dB = b.next_due_date ? new Date(b.next_due_date).getTime() : Infinity;
                  return dA - dB;
                })
                .slice(0, 5)
                .map((r: any) => {
                  const cfg = statusConfig(r.status);
                  const due = r.next_due_date ? new Date(r.next_due_date) : null;
                  const daysUntil = due ? Math.floor((due.getTime() - Date.now()) / 86400000) : 0;
                  return (
                    <div key={r.calibration_id ?? r.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0">
                      <div className="flex items-center gap-2">
                        <cfg.icon className={`w-3 h-3 ${cfg.color}`} />
                        <span className="font-mono font-bold">{r.sensor_tag ?? r.sensorTag ?? r.id}</span>
                        <span className="text-muted-foreground">{r.well_name ?? r.wellId ?? ""}</span>
                      </div>
                      <div className={`font-mono font-bold ${cfg.color}`}>
                        {daysUntil < 0 ? `${Math.abs(daysUntil)}d ago` : daysUntil === 0 ? "Today" : `${daysUntil}d`}
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search sensors, wells..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="OVERDUE">Overdue</SelectItem>
            <SelectItem value="DUE_SOON">Due Soon</SelectItem>
            <SelectItem value="CURRENT">Current</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40 h-8 text-sm">
            <SelectValue placeholder="Sensor Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            <SelectItem value="PRESSURE">Pressure</SelectItem>
            <SelectItem value="TEMPERATURE">Temperature</SelectItem>
            <SelectItem value="FLOW">Flow</SelectItem>
            <SelectItem value="VIBRATION">Vibration</SelectItem>
            <SelectItem value="GAS">Gas Detector</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground ml-auto">
          {sorted.length} of {allRecords.length} sensors
        </div>
      </div>

      {/* Calibration list */}
      <div className="space-y-2">
        {sorted.map(record => (
          <CalibrationRow
            key={record.calibration_id}
            record={record}
            onSchedule={r => setScheduleRecord(r)}
          />
        ))}
        {sorted.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No calibration records match the current filters
          </div>
        )}
      </div>

      {/* Schedule dialog */}
      <ScheduleDialog
        record={scheduleRecord}
        open={!!scheduleRecord}
        onClose={() => setScheduleRecord(null)}
      />
    </div>
  );
}
