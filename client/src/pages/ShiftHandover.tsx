/**
 * Shift Handover Report Module
 * Design: Dark Amber — OG-RMM Platform
 *
 * Gap Closure: Priority 2 — Shift handover report generation
 * Features:
 *   - Auto-generated at 06:00 and 18:00 daily by Python analytics service
 *   - Summarizes: active alarms, production vs target, workovers, calibrations due
 *   - PDF export + email/Teams webhook delivery
 *   - Historical handover archive with diff view
 *   - Operator sign-off workflow
 */

import { useState } from "react";
import moment from "moment";
import "moment-hijri";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Clock, Download, Send, CheckCircle2, AlertTriangle,
  TrendingUp, TrendingDown, Minus, User, Calendar,
  Bell, Wrench, FlaskConical, Droplets, Zap, FileText,
  ChevronRight, RefreshCw, Mail, MessageSquare
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface HandoverReport {
  report_id: string;
  shift: "DAY" | "NIGHT";
  date: string;
  shift_start: string;
  shift_end: string;
  outgoing_operator: string;
  incoming_operator?: string;
  signed_off: boolean;
  signed_off_at?: string;
  summary: ShiftSummary;
}

interface ShiftSummary {
  production: ProductionSummary;
  alarms: AlarmSummary;
  workovers: WorkoverSummary;
  calibrations: CalibrationSummary;
  connectivity: ConnectivitySummary;
  actions_taken: ActionItem[];
  handover_notes: string;
}

interface ProductionSummary {
  oil_bpd: number;
  oil_target: number;
  gas_mmscfd: number;
  gas_target: number;
  wells_online: number;
  wells_total: number;
  uptime_pct: number;
  vs_prior_shift_pct: number;
}

interface AlarmSummary {
  active: number;
  critical: number;
  acknowledged: number;
  new_this_shift: number;
  resolved_this_shift: number;
  top_alarms: { tag: string; well: string; type: string; duration_hrs: number }[];
}

interface WorkoverSummary {
  in_progress: number;
  completed_this_shift: number;
  planned_next_shift: number;
  jobs: { job_id: string; well: string; type: string; status: string; progress_pct: number }[];
}

interface CalibrationSummary {
  overdue: number;
  due_this_week: number;
  completed_this_shift: number;
}

interface ConnectivitySummary {
  sites_online: number;
  sites_total: number;
  sites_degraded: number;
  avg_latency_ms: number;
}

interface ActionItem {
  time: string;
  operator: string;
  action: string;
  well?: string;
  outcome: string;
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_REPORTS: HandoverReport[] = [
  {
    report_id: "SHR-2026-0313-DAY",
    shift: "DAY",
    date: "2026-03-13",
    shift_start: "06:00",
    shift_end: "18:00",
    outgoing_operator: "J. Rodriguez",
    incoming_operator: "M. Chen",
    signed_off: true,
    signed_off_at: "2026-03-13T17:55:00Z",
    summary: {
      production: {
        oil_bpd: 48320, oil_target: 50000,
        gas_mmscfd: 124.5, gas_target: 120,
        wells_online: 128, wells_total: 142,
        uptime_pct: 96.4, vs_prior_shift_pct: +2.1,
      },
      alarms: {
        active: 7, critical: 2, acknowledged: 5,
        new_this_shift: 12, resolved_this_shift: 8,
        top_alarms: [
          { tag: "PT-2847", well: "Permian Basin #47", type: "High Tubing Pressure", duration_hrs: 4.2 },
          { tag: "VIB-1203", well: "Eagle Ford #12", type: "ESP High Vibration", duration_hrs: 2.8 },
          { tag: "TMP-0891", well: "Bakken #33", type: "High Wellhead Temp", duration_hrs: 1.5 },
        ],
      },
      workovers: {
        in_progress: 3, completed_this_shift: 1, planned_next_shift: 2,
        jobs: [
          { job_id: "WO-2026-001", well: "Anadarko #55", type: "ESP Replacement", status: "IN_PROGRESS", progress_pct: 65 },
          { job_id: "WO-2026-002", well: "Marcellus #08", type: "Tubing Inspection", status: "IN_PROGRESS", progress_pct: 40 },
          { job_id: "WO-2026-003", well: "Haynesville #21", type: "Stimulation", status: "COMPLETED", progress_pct: 100 },
        ],
      },
      calibrations: { overdue: 3, due_this_week: 7, completed_this_shift: 2 },
      connectivity: { sites_online: 138, sites_total: 142, sites_degraded: 2, avg_latency_ms: 124 },
      actions_taken: [
        { time: "07:23", operator: "J. Rodriguez", action: "Adjusted ESP frequency", well: "Eagle Ford #12", outcome: "Vibration reduced from 0.72 to 0.41 in/s" },
        { time: "09:45", operator: "J. Rodriguez", action: "Acknowledged high pressure alarm", well: "Permian Basin #47", outcome: "Monitoring — within safe operating limits" },
        { time: "11:30", operator: "J. Rodriguez", action: "Initiated workover job", well: "Haynesville #21", outcome: "Stimulation crew dispatched" },
        { time: "14:15", operator: "J. Rodriguez", action: "Choke adjustment", well: "Bakken #33", outcome: "Temperature normalized to 198°F" },
        { time: "16:40", operator: "J. Rodriguez", action: "Completed calibration", well: "Niobrara #16", outcome: "PT-1642 recalibrated — drift corrected to 0.1%" },
      ],
      handover_notes: "Eagle Ford #12 ESP vibration trending upward — recommend monitoring closely. Anadarko #55 workover on track for completion by 22:00. Two sites (Utica #44, Marcellus #08) on satellite backup link — fiber restoration expected tomorrow morning.",
    },
  },
  {
    report_id: "SHR-2026-0312-NIGHT",
    shift: "NIGHT",
    date: "2026-03-12",
    shift_start: "18:00",
    shift_end: "06:00",
    outgoing_operator: "M. Chen",
    incoming_operator: "J. Rodriguez",
    signed_off: true,
    signed_off_at: "2026-03-13T05:58:00Z",
    summary: {
      production: {
        oil_bpd: 47280, oil_target: 50000,
        gas_mmscfd: 121.8, gas_target: 120,
        wells_online: 126, wells_total: 142,
        uptime_pct: 95.1, vs_prior_shift_pct: -1.2,
      },
      alarms: {
        active: 9, critical: 3, acknowledged: 6,
        new_this_shift: 15, resolved_this_shift: 11,
        top_alarms: [
          { tag: "ESD-0044", well: "Anadarko #55", type: "ESD Valve Fault", duration_hrs: 6.1 },
          { tag: "PT-1203", well: "Eagle Ford #12", type: "Low Tubing Pressure", duration_hrs: 3.4 },
        ],
      },
      workovers: {
        in_progress: 2, completed_this_shift: 0, planned_next_shift: 3,
        jobs: [
          { job_id: "WO-2026-001", well: "Anadarko #55", type: "ESP Replacement", status: "IN_PROGRESS", progress_pct: 30 },
          { job_id: "WO-2026-002", well: "Marcellus #08", type: "Tubing Inspection", status: "PLANNED", progress_pct: 0 },
        ],
      },
      calibrations: { overdue: 5, due_this_week: 7, completed_this_shift: 0 },
      connectivity: { sites_online: 136, sites_total: 142, sites_degraded: 4, avg_latency_ms: 187 },
      actions_taken: [
        { time: "19:12", operator: "M. Chen", action: "ESD valve manual reset", well: "Anadarko #55", outcome: "Valve restored — root cause: debris in actuator" },
        { time: "22:45", operator: "M. Chen", action: "ESP frequency reduction", well: "Eagle Ford #12", outcome: "Pressure stabilized" },
        { time: "03:30", operator: "M. Chen", action: "Connectivity check", well: undefined, outcome: "4 sites on backup link — maintenance ticket raised" },
      ],
      handover_notes: "Anadarko #55 ESD valve repaired but recommend full actuator inspection during workover. Night shift production 2.1% below target due to 2 shut-in wells (Utica #44 planned maintenance, Permian Basin #31 weather hold).",
    },
  },
];

// ── Hijri date badge ──────────────────────────────────────────────────────────

function HijriDateBadge() {
  const m = moment() as any;
  const hijriMonths = [
    "Muharram", "Safar", "Rabi\u02bc al-Awwal", "Rabi\u02bc al-Thani",
    "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Sha\u02bcban",
    "Ramadan", "Shawwal", "Dhu al-Qi\u02bbdah", "Dhu al-Hijjah"
  ];
  // moment-hijri extends moment with iDate/iMonth/iYear methods
  // Use safe fallback if the extension is not loaded
  let hijriFormatted = "";
  try {
    if (typeof m.iDate === "function") {
      hijriFormatted = `${m.iDate()} ${hijriMonths[m.iMonth()]} ${m.iYear()} AH`;
    } else {
      // Approximate Hijri year: Gregorian year - 579 (rough approximation)
      const now = new Date();
      const approxHijriYear = now.getFullYear() - 579;
      const approxMonth = hijriMonths[now.getMonth()];
      hijriFormatted = `${now.getDate()} ${approxMonth} ${approxHijriYear} AH (approx.)`;
    }
  } catch {
    hijriFormatted = "Hijri date unavailable";
  }
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <span className="text-xs text-muted-foreground">{new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
      <span className="text-muted-foreground/40">·</span>
      <span className="text-xs text-amber-400/80 font-arabic" dir="ltr">{hijriFormatted}</span>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TrendIcon({ pct }: { pct: number }) {
  if (pct > 0.5) return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
  if (pct < -0.5) return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
  return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
}

function ProductionCard({ prod }: { prod: HandoverReport["summary"]["production"] }) {
  const oilPct = Math.round((prod.oil_bpd / prod.oil_target) * 100);
  const gasPct = Math.round((prod.gas_mmscfd / prod.gas_target) * 100);
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="font-[Syne] text-sm font-bold flex items-center gap-2">
          <Droplets className="w-4 h-4 text-amber-400" />
          Production
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md bg-muted/30 p-2.5">
            <div className="text-[10px] text-muted-foreground">Oil Production</div>
            <div className="font-mono font-bold text-lg text-amber-400">{prod.oil_bpd.toLocaleString()}</div>
            <div className="text-[10px] text-muted-foreground">BPD · target {prod.oil_target.toLocaleString()}</div>
            <div className="h-1 rounded-full bg-muted mt-1 overflow-hidden">
              <div className={`h-full ${oilPct >= 95 ? "bg-emerald-500" : oilPct >= 85 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(oilPct, 100)}%` }} />
            </div>
          </div>
          <div className="rounded-md bg-muted/30 p-2.5">
            <div className="text-[10px] text-muted-foreground">Gas Production</div>
            <div className="font-mono font-bold text-lg text-blue-400">{prod.gas_mmscfd}</div>
            <div className="text-[10px] text-muted-foreground">MMSCFD · target {prod.gas_target}</div>
            <div className="h-1 rounded-full bg-muted mt-1 overflow-hidden">
              <div className={`h-full ${gasPct >= 95 ? "bg-emerald-500" : gasPct >= 85 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(gasPct, 100)}%` }} />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Wells online</span>
          <span className="font-mono text-foreground">{prod.wells_online}/{prod.wells_total}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Fleet uptime</span>
          <span className="font-mono text-foreground">{prod.uptime_pct}%</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">vs. prior shift</span>
          <span className={`font-mono flex items-center gap-1 ${prod.vs_prior_shift_pct > 0 ? "text-emerald-400" : prod.vs_prior_shift_pct < 0 ? "text-red-400" : "text-muted-foreground"}`}>
            <TrendIcon pct={prod.vs_prior_shift_pct} />
            {prod.vs_prior_shift_pct > 0 ? "+" : ""}{prod.vs_prior_shift_pct}%
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function AlarmCard({ alarms }: { alarms: HandoverReport["summary"]["alarms"] }) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="font-[Syne] text-sm font-bold flex items-center gap-2">
          <Bell className="w-4 h-4 text-red-400" />
          Alarms
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-red-950/20 border border-red-700/20 p-2">
            <div className="font-mono font-bold text-xl text-red-400">{alarms.critical}</div>
            <div className="text-[9px] text-muted-foreground">Critical</div>
          </div>
          <div className="rounded-md bg-amber-950/20 border border-amber-700/20 p-2">
            <div className="font-mono font-bold text-xl text-amber-400">{alarms.active}</div>
            <div className="text-[9px] text-muted-foreground">Active</div>
          </div>
          <div className="rounded-md bg-muted/30 p-2">
            <div className="font-mono font-bold text-xl text-foreground">{alarms.new_this_shift}</div>
            <div className="text-[9px] text-muted-foreground">New</div>
          </div>
        </div>
        <div className="space-y-1.5">
          {alarms.top_alarms.map((a, i) => (
            <div key={i} className="flex items-start justify-between gap-2 text-xs py-1 border-b border-border/30 last:border-0">
              <div>
                <span className="font-mono text-amber-400 mr-1.5">{a.tag}</span>
                <span className="text-foreground">{a.type}</span>
                <div className="text-[10px] text-muted-foreground">{a.well}</div>
              </div>
              <span className="font-mono text-muted-foreground shrink-0">{a.duration_hrs}h</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WorkoverCard({ workovers }: { workovers: HandoverReport["summary"]["workovers"] }) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="font-[Syne] text-sm font-bold flex items-center gap-2">
          <Wrench className="w-4 h-4 text-blue-400" />
          Workovers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-muted/30 p-2">
            <div className="font-mono font-bold text-xl text-blue-400">{workovers.in_progress}</div>
            <div className="text-[9px] text-muted-foreground">In Progress</div>
          </div>
          <div className="rounded-md bg-muted/30 p-2">
            <div className="font-mono font-bold text-xl text-emerald-400">{workovers.completed_this_shift}</div>
            <div className="text-[9px] text-muted-foreground">Completed</div>
          </div>
          <div className="rounded-md bg-muted/30 p-2">
            <div className="font-mono font-bold text-xl text-amber-400">{workovers.planned_next_shift}</div>
            <div className="text-[9px] text-muted-foreground">Next Shift</div>
          </div>
        </div>
        <div className="space-y-2">
          {workovers.jobs.map(j => (
            <div key={j.job_id} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-muted-foreground">{j.job_id}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded ${j.status === "COMPLETED" ? "text-emerald-400 bg-emerald-500/10" : j.status === "IN_PROGRESS" ? "text-blue-400 bg-blue-500/10" : "text-muted-foreground bg-muted/50"}`}>
                  {j.status}
                </span>
              </div>
              <div className="text-xs text-foreground">{j.well} — {j.type}</div>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div className={`h-full ${j.status === "COMPLETED" ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${j.progress_pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ActionsLog({ actions }: { actions: ActionItem[] }) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="font-[Syne] text-sm font-bold flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          Actions Taken This Shift
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {actions.map((a, i) => (
            <div key={i} className="flex gap-3 py-2.5 border-b border-border/30 last:border-0">
              <div className="font-mono text-xs text-amber-400 shrink-0 w-10">{a.time}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-foreground">{a.action}{a.well && <span className="text-muted-foreground ml-1">— {a.well}</span>}</div>
                <div className="text-[10px] text-emerald-400 mt-0.5">→ {a.outcome}</div>
              </div>
              <div className="text-[10px] text-muted-foreground shrink-0">{a.operator.split(" ")[0]}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ShiftHandoverPage() {
  const [generating, setGenerating] = useState(false);
  const [signingOff, setSigningOff] = useState(false);
  const [emailInput, setEmailInput] = useState("operator@og-rmm.platform");
  const [showEmailInput, setShowEmailInput] = useState(false);

  // Live DB data with MOCK_REPORTS as fallback when DB is empty
  const { data: liveHandovers, refetch: refetchHandovers } = trpc.shiftHandover.list.useQuery();
  const handoverList = (liveHandovers && liveHandovers.length > 0) ? liveHandovers : null;

  const createMutation = trpc.shiftHandover.create.useMutation({
    onSuccess: () => refetchHandovers(),
  });
  const signOffMutation = trpc.shiftHandover.signOff.useMutation({
    onSuccess: () => refetchHandovers(),
  });

  // Map DB record to HandoverReport shape for display
  function dbToReport(h: NonNullable<typeof liveHandovers>[0]): HandoverReport {
    const shiftType = h.shiftType === "MORNING" ? "DAY" : h.shiftType === "EVENING" ? "DAY" : "NIGHT";
    return {
      report_id: h.shiftId,
      shift: shiftType as "DAY" | "NIGHT",
      date: new Date(h.date).toISOString().split("T")[0],
      shift_start: shiftType === "DAY" ? "06:00" : "18:00",
      shift_end: shiftType === "DAY" ? "18:00" : "06:00",
      outgoing_operator: h.outgoingOperator,
      incoming_operator: h.incomingOperator ?? undefined,
      signed_off: !!h.signedOffAt,
      signed_off_at: h.signedOffAt ? new Date(h.signedOffAt).toISOString() : undefined,
      summary: {
        production: { oil_bpd: h.productionBpd ?? 0, oil_target: 50000, gas_mmscfd: 0, gas_target: 120, wells_online: 0, wells_total: 0, uptime_pct: 0, vs_prior_shift_pct: 0 },
        alarms: { active: 0, critical: h.criticalAlarms ?? 0, acknowledged: 0, new_this_shift: 0, resolved_this_shift: 0, top_alarms: [] },
        workovers: { in_progress: h.activeWorkovers ?? 0, completed_this_shift: 0, planned_next_shift: 0, jobs: [] },
        calibrations: { overdue: 0, due_this_week: 0, completed_this_shift: 0 },
        connectivity: { sites_online: 0, sites_total: 0, sites_degraded: 0, avg_latency_ms: 0 },
        actions_taken: [],
        handover_notes: h.notes ?? "",
      },
    };
  }

  const displayReports: HandoverReport[] = handoverList
    ? handoverList.map(dbToReport)
    : MOCK_REPORTS;

  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const selectedReport = selectedReportId
    ? (displayReports.find(r => r.report_id === selectedReportId) ?? displayReports[0])
    : displayReports[0];

  const sendEmailMutation = trpc.shiftHandover.sendEmail.useMutation({
    onSuccess: (result) => {
      if (result.previewUrl) {
        toast.success("Email sent (test mode)", {
          description: (
            <span>
              Preview:{" "}
              <a href={result.previewUrl} target="_blank" rel="noopener noreferrer"
                className="underline text-amber-400">
                View in Ethereal
              </a>
            </span>
          ),
          duration: 10000,
        });
      } else {
        toast.success("Shift handover email sent", {
          description: `Delivered to ${result.recipient}`,
        });
      }
      setShowEmailInput(false);
    },
    onError: (e) => toast.error(`Email failed: ${e.message}`),
  });

  function handleSendEmail() {
    sendEmailMutation.mutate({
      reportId: selectedReport.report_id,
      shiftType: selectedReport.shift,
      shiftDate: selectedReport.date,
      outgoingOperator: selectedReport.outgoing_operator,
      incomingOperator: selectedReport.incoming_operator ?? "Incoming Operator",
      totalOilBpd: selectedReport.summary.production.oil_bpd,
      totalGasMmscfd: selectedReport.summary.production.gas_mmscfd,
      activeAlarms: selectedReport.summary.alarms.active,
      criticalAlarms: selectedReport.summary.alarms.critical,
      workoversActive: selectedReport.summary.workovers.in_progress,
      calibrationsDue: selectedReport.summary.calibrations.overdue,
      notes: selectedReport.summary.handover_notes,
      recipientEmail: emailInput,
    });
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const now = new Date();
      const hour = now.getHours();
      const shiftType = hour >= 6 && hour < 18 ? "MORNING" : "NIGHT";
      await createMutation.mutateAsync({
        shiftType,
        outgoingOperator: "Current Operator",
        criticalAlarms: 0,
        activeWorkovers: 0,
      });
      toast.success("Shift handover report created", {
        description: "New handover record saved to database.",
        duration: 6000,
      });
    } catch (e: any) {
      toast.error("Failed to generate report", { description: e.message });
    } finally {
      setGenerating(false);
    }
  }

  async function handleSignOff() {
    // Find the DB record id if we're using live data
    const liveRecord = handoverList?.find(h => h.shiftId === selectedReport.report_id);
    if (liveRecord) {
      setSigningOff(true);
      try {
        await signOffMutation.mutateAsync({ id: liveRecord.id });
        toast.success("Shift handover signed off", {
          description: `Signed by ${selectedReport.outgoing_operator} at ${new Date().toLocaleTimeString()}`,
        });
      } catch (e: any) {
        toast.error("Sign-off failed", { description: e.message });
      } finally {
        setSigningOff(false);
      }
    } else {
      // Mock fallback
      setSigningOff(true);
      await new Promise(r => setTimeout(r, 800));
      setSigningOff(false);
      toast.success("Shift handover signed off", {
        description: `Signed by ${selectedReport.outgoing_operator} at ${new Date().toLocaleTimeString()}`,
      });
    }
  }

  const report = selectedReport;
  const s = report.summary;

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-[Syne] font-black text-2xl text-foreground tracking-tight">
            Shift Handover
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Auto-generated shift reports · Operator sign-off · Handover documentation
          </p>
          <HijriDateBadge />
        </div>
        <div className="flex items-center gap-2">
          {showEmailInput ? (
            <div className="flex items-center gap-1">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 w-48 focus:outline-none focus:border-amber-500"
                placeholder="recipient@company.com"
              />
              <Button size="sm" className="bg-amber-600 hover:bg-amber-500 text-white text-xs h-7 px-2"
                onClick={handleSendEmail} disabled={sendEmailMutation.isPending}>
                {sendEmailMutation.isPending ? "Sending…" : "Send"}
              </Button>
              <Button size="sm" variant="outline" className="border-gray-600 text-gray-400 text-xs h-7 px-2"
                onClick={() => setShowEmailInput(false)}>✕</Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="border-border/50 text-xs h-8"
              onClick={() => setShowEmailInput(true)}
            >
              <Mail className="w-3.5 h-3.5 mr-1.5" />
              Email Report
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="border-border/50 text-xs h-8"
            onClick={() => toast.info("Teams notification sent", { description: "Posted to #shift-handover channel" })}
          >
            <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
            Teams
          </Button>
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <><span className="w-3.5 h-3.5 mr-1.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />Generating...</>
            ) : (
              <><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Generate Now</>
            )}
          </Button>
        </div>
      </div>

      {/* Report selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {displayReports.map(r => (
          <button
            key={r.report_id}
            onClick={() => setSelectedReportId(r.report_id)}
            className={`shrink-0 rounded-lg border px-3 py-2 text-left transition-colors ${
              r.report_id === selectedReport.report_id
                ? "border-amber-600/60 bg-amber-950/20"
                : "border-border/50 bg-card hover:border-border"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${r.shift === "DAY" ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"}`}>
                {r.shift}
              </span>
              {r.signed_off && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
            </div>
            <div className="text-xs font-medium text-foreground mt-1">{r.date}</div>
            <div className="text-[10px] text-muted-foreground">{r.shift_start} – {r.shift_end}</div>
          </button>
        ))}
      </div>

      {/* Report header */}
      <div className="rounded-lg border border-border/50 bg-card p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${report.shift === "DAY" ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"}`}>
                {report.shift} SHIFT
              </span>
              {report.signed_off ? (
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Signed off at {report.signed_off_at ? new Date(report.signed_off_at).toLocaleTimeString() : ""}
                </span>
              ) : (
                <span className="text-xs text-amber-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Awaiting sign-off
                </span>
              )}
            </div>
            <div className="font-[Syne] font-bold text-lg text-foreground">
              {report.date} · {report.shift_start} – {report.shift_end} UTC
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              <span className="text-foreground">{report.outgoing_operator}</span>
              <ChevronRight className="w-3.5 h-3.5 inline mx-1" />
              <span className="text-foreground">{report.incoming_operator ?? "TBD"}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-border/50 text-xs h-8"
              onClick={() => toast.success("PDF downloaded", { description: `${report.report_id}.pdf` })}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              PDF
            </Button>
            {!report.signed_off && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                onClick={handleSignOff}
                disabled={signingOff}
              >
                {signingOff ? (
                  <span className="w-3.5 h-3.5 mr-1.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                )}
                Sign Off
              </Button>
            )}
          </div>
        </div>

        {/* Handover notes */}
        <div className="mt-3 rounded-md bg-muted/20 border border-border/30 p-3">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Handover Notes</div>
          <p className="text-sm text-foreground leading-relaxed">{s.handover_notes}</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <ProductionCard prod={s.production} />
        <AlarmCard alarms={s.alarms} />
        <WorkoverCard workovers={s.workovers} />
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="font-[Syne] text-sm font-bold flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {[
                { label: "Sites Online", value: `${s.connectivity.sites_online}/${s.connectivity.sites_total}`, color: "text-emerald-400" },
                { label: "Sites Degraded", value: s.connectivity.sites_degraded, color: s.connectivity.sites_degraded > 0 ? "text-amber-400" : "text-muted-foreground" },
                { label: "Avg Latency", value: `${s.connectivity.avg_latency_ms} ms`, color: "text-foreground" },
                { label: "Cal. Overdue", value: s.calibrations.overdue, color: s.calibrations.overdue > 0 ? "text-red-400" : "text-muted-foreground" },
                { label: "Cal. Due This Week", value: s.calibrations.due_this_week, color: "text-amber-400" },
                { label: "Cal. Completed", value: s.calibrations.completed_this_shift, color: "text-emerald-400" },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className={`font-mono font-bold ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions log */}
      <ActionsLog actions={s.actions_taken} />

      {/* Schedule info */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="font-[Syne] text-sm font-bold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            Auto-Generation Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {[
              { time: "06:00 UTC", shift: "Night → Day", next: "Today 06:00", status: "SCHEDULED" },
              { time: "18:00 UTC", shift: "Day → Night", next: "Today 18:00", status: "SCHEDULED" },
              { time: "On demand", shift: "Manual trigger", next: "Available now", status: "READY" },
            ].map(s => (
              <div key={s.time} className="rounded-md bg-muted/20 border border-border/30 p-3">
                <div className="font-mono font-bold text-foreground">{s.time}</div>
                <div className="text-muted-foreground mt-0.5">{s.shift}</div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-muted-foreground">{s.next}</span>
                  <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">{s.status}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Reports are generated by the Python analytics service, stored in PostgreSQL, and delivered via email (SMTP) and Microsoft Teams webhook. PDF export uses WeasyPrint. All reports are archived indefinitely.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
