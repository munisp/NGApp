/**
 * SILCertification.tsx — IEC 61511 / TÜV SIL Certification Roadmap
 *
 * Provides a comprehensive UI for tracking SIL certification progress:
 *   - Assessment overview with PFD/PFH/RRF metrics
 *   - IEC 61511 control clause compliance matrix (45 controls)
 *   - Gap tracker with severity, owner, and target date
 *   - Compliance progress by category
 *   - TÜV readiness score
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  ShieldCheck, ShieldAlert, ShieldX, Shield, AlertTriangle,
  CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight,
  FileText, Users, Wrench, Server, Settings, RefreshCw,
  TrendingUp, Target,
} from "lucide-react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  COMPLIANT: { label: "Compliant", color: "text-emerald-400", bg: "bg-emerald-950/30 border-emerald-800/40", icon: CheckCircle2 },
  IN_PROGRESS: { label: "In Progress", color: "text-amber-400", bg: "bg-amber-950/30 border-amber-800/40", icon: Clock },
  NOT_STARTED: { label: "Not Started", color: "text-muted-foreground", bg: "bg-muted/10 border-border/30", icon: Shield },
  NON_COMPLIANT: { label: "Non-Compliant", color: "text-red-400", bg: "bg-red-950/30 border-red-800/40", icon: XCircle },
  WAIVED: { label: "Waived", color: "text-blue-400", bg: "bg-blue-950/30 border-blue-800/40", icon: FileText },
} as const;

const GAP_SEVERITY_CONFIG = {
  CRITICAL: { color: "text-red-400", bg: "bg-red-950/30 border-red-800/40", dot: "bg-red-500" },
  HIGH: { color: "text-orange-400", bg: "bg-orange-950/30 border-orange-800/40", dot: "bg-orange-500" },
  MEDIUM: { color: "text-amber-400", bg: "bg-amber-950/30 border-amber-800/40", dot: "bg-amber-500" },
  LOW: { color: "text-blue-400", bg: "bg-blue-950/30 border-blue-800/40", dot: "bg-blue-500" },
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CATEGORY_ICONS: Record<string, any> = {
  Management: Users,
  "Risk Assessment": AlertTriangle,
  Design: Settings,
  Software: Server,
  Verification: CheckCircle2,
  Commissioning: Wrench,
  Operations: TrendingUp,
  Modification: RefreshCw,
  Decommissioning: ShieldX,
  Platform: Shield,
};

const PIE_COLORS = ["#10b981", "#f59e0b", "#6b7280", "#ef4444", "#3b82f6"];

// ─── METRIC CARD ──────────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, color = "text-foreground",
}: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <Card className="bg-card border-border/50">
      <CardContent className="pt-3 pb-3 px-4">
        <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
        <div className={cn("text-lg font-mono font-bold", color)}>{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

// ─── CONTROL ROW ──────────────────────────────────────────────────────────────

function ControlRow({
  control,
  onUpdate,
}: {
  control: {
    id: number;
    clauseRef: string;
    controlTitle: string;
    controlDescription: string | null;
    category: string;
    silApplicability: string | null;
    status: string;
    gapDescription: string | null;
    remediationAction: string | null;
    evidence: string | null;
  };
  onUpdate: (id: number, status: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[control.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.NOT_STARTED;
  const Icon = cfg.icon;

  return (
    <div className={cn("border rounded-md transition-all", cfg.bg)}>
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <Icon className={cn("w-3.5 h-3.5 shrink-0", cfg.color)} />
        <span className="font-mono text-[10px] text-muted-foreground/70 shrink-0 w-20">{control.clauseRef}</span>
        <span className="text-xs flex-1 font-medium truncate">{control.controlTitle}</span>
        <span className="text-[10px] text-muted-foreground/50 shrink-0 hidden md:block">{control.silApplicability}</span>
        <span className={cn("text-[10px] font-mono shrink-0", cfg.color)}>{cfg.label}</span>
        {expanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-2">
          <p className="text-xs text-muted-foreground">{control.controlDescription}</p>
          {control.gapDescription && (
            <div className="text-xs p-2 rounded bg-red-950/20 border border-red-900/30 text-red-300">
              <span className="font-semibold">Gap: </span>{control.gapDescription}
            </div>
          )}
          {control.remediationAction && (
            <div className="text-xs p-2 rounded bg-amber-950/20 border border-amber-900/30 text-amber-300">
              <span className="font-semibold">Remediation: </span>{control.remediationAction}
            </div>
          )}
          {control.evidence && (
            <div className="text-xs p-2 rounded bg-emerald-950/20 border border-emerald-900/30 text-emerald-300">
              <span className="font-semibold">Evidence: </span>{control.evidence}
            </div>
          )}
          <div className="flex gap-1.5 flex-wrap pt-1">
            {(["COMPLIANT", "IN_PROGRESS", "NOT_STARTED", "NON_COMPLIANT"] as const).map(s => (
              <button
                key={s}
                onClick={e => { e.stopPropagation(); onUpdate(control.id, s); }}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded border font-mono transition-all",
                  control.status === s
                    ? STATUS_CONFIG[s].bg + " " + STATUS_CONFIG[s].color
                    : "border-border/30 text-muted-foreground/50 hover:border-border/60"
                )}
              >
                {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── GAP ROW ──────────────────────────────────────────────────────────────────

function GapRow({ gap }: {
  gap: {
    id: number;
    gapTitle: string;
    severity: string;
    description: string | null;
    remediationPlan: string | null;
    owner: string | null;
    targetDate: Date | null;
    status: string;
    impactedSilLevel: string | null;
  };
}) {
  const [expanded, setExpanded] = useState(false);
  const sev = GAP_SEVERITY_CONFIG[gap.severity as keyof typeof GAP_SEVERITY_CONFIG] ?? GAP_SEVERITY_CONFIG.MEDIUM;

  return (
    <div className={cn("border rounded-md", sev.bg)}>
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={cn("w-2 h-2 rounded-full shrink-0", sev.dot)} />
        <span className="text-xs flex-1 font-medium truncate">{gap.gapTitle}</span>
        <span className={cn("text-[10px] font-mono shrink-0", sev.color)}>{gap.severity}</span>
        <span className="text-[10px] text-muted-foreground/60 shrink-0 hidden md:block">{gap.status}</span>
        {expanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
      </div>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-2">
          {gap.description && <p className="text-xs text-muted-foreground">{gap.description}</p>}
          {gap.remediationPlan && (
            <div className="text-xs p-2 rounded bg-amber-950/20 border border-amber-900/30 text-amber-300">
              <span className="font-semibold">Remediation: </span>{gap.remediationPlan}
            </div>
          )}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <div className="text-muted-foreground/60">Owner</div>
              <div className="font-mono">{gap.owner ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground/60">Target Date</div>
              <div className="font-mono">
                {gap.targetDate ? new Date(gap.targetDate).toLocaleDateString() : "—"}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground/60">Impacted SIL</div>
              <div className="font-mono">{gap.impactedSilLevel?.replace("SIL_", "SIL ") ?? "—"}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function SILCertification() {
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [activeTab, setActiveTab] = useState<"controls" | "gaps" | "chart">("controls");

  const { data: assessments } = trpc.silCertification.listAssessments.useQuery();
  const assessmentId = assessments?.[0]?.id ?? 0;

  const { data: assessment, refetch } = trpc.silCertification.getAssessment.useQuery(
    { id: assessmentId },
    { enabled: assessmentId > 0 }
  );

  const updateControl = trpc.silCertification.updateControl.useMutation({
    onSuccess: () => refetch(),
  });

  const categories = useMemo(() => {
    if (!assessment?.controls) return ["All"];
    const cats = Array.from(new Set(assessment.controls.map(c => c.category)));
    return ["All", ...cats];
  }, [assessment?.controls]);

  const filteredControls = useMemo(() => {
    if (!assessment?.controls) return [];
    if (activeCategory === "All") return assessment.controls;
    return assessment.controls.filter(c => c.category === activeCategory);
  }, [assessment?.controls, activeCategory]);

  const categoryStats = useMemo(() => {
    if (!assessment?.controls) return [];
    const cats: Record<string, { total: number; compliant: number }> = {};
    for (const c of assessment.controls) {
      if (!cats[c.category]) cats[c.category] = { total: 0, compliant: 0 };
      cats[c.category].total++;
      if (c.status === "COMPLIANT") cats[c.category].compliant++;
    }
    return Object.entries(cats).map(([name, { total, compliant }]) => ({
      name: name.length > 12 ? name.slice(0, 11) + "…" : name,
      fullName: name,
      compliant,
      gap: total - compliant,
      rate: Math.round((compliant / total) * 100),
    }));
  }, [assessment?.controls]);

  const pieData = useMemo(() => {
    if (!assessment?.stats) return [];
    return [
      { name: "Compliant", value: assessment.stats.compliant },
      { name: "In Progress", value: assessment.stats.inProgress },
      { name: "Not Started", value: assessment.stats.notStarted },
      { name: "Non-Compliant", value: assessment.stats.nonCompliant },
    ].filter(d => d.value > 0);
  }, [assessment?.stats]);

  const tuvReadiness = useMemo(() => {
    if (!assessment?.stats) return 0;
    const { compliant, inProgress, total } = assessment.stats;
    return Math.round(((compliant + inProgress * 0.5) / total) * 100);
  }, [assessment?.stats]);

  if (!assessment) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-muted-foreground text-sm animate-pulse">Loading SIL assessment data…</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold font-[Syne] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            SIL Certification Roadmap
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Safety system certification tracking · Compliance assessment readiness · Audit documentation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono border-amber-700/50 text-amber-400">
            Target: {assessment.targetSilLevel?.replace("SIL_", "SIL ")}
          </Badge>
          <Badge variant="outline" className={cn(
            "text-xs font-mono",
            assessment.status === "COMPLIANT" ? "border-emerald-700/50 text-emerald-400" :
            assessment.status === "IN_PROGRESS" ? "border-amber-700/50 text-amber-400" :
            "border-border/50 text-muted-foreground"
          )}>
            {assessment.status?.replace("_", " ")}
          </Badge>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <MetricCard
          label="Compliance Rate"
          value={`${assessment.stats.complianceRate}%`}
          sub={`${assessment.stats.compliant}/${assessment.stats.total} controls`}
          color={assessment.stats.complianceRate >= 80 ? "text-emerald-400" : assessment.stats.complianceRate >= 50 ? "text-amber-400" : "text-red-400"}
        />
        <MetricCard label="TÜV Readiness" value={`${tuvReadiness}%`} sub="Weighted score" color="text-blue-400" />
        <MetricCard label="Open Gaps" value={assessment.gaps.filter(g => g.status !== "CLOSED").length} sub={`${assessment.gaps.filter(g => g.severity === "CRITICAL" && g.status !== "CLOSED").length} critical`} color="text-red-400" />
        <MetricCard label="PFDavg" value={assessment.pfdAvg?.toExponential(2) ?? "—"} sub="Avg Prob. Failure on Demand" color="text-amber-400" />
        <MetricCard label="PFH" value={assessment.pfhAvg?.toExponential(2) ?? "—"} sub="Failures per Hour" color="text-amber-400" />
        <MetricCard label="RRF" value={assessment.rrf?.toFixed(0) ?? "—"} sub="Risk Reduction Factor" color="text-emerald-400" />
        <MetricCard label="Assessor" value={assessment.assessorOrg ?? "TBD"} sub={assessment.phase ?? ""} />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1.5 flex-wrap">
        {(["controls", "gaps", "chart"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-md border transition-all font-mono capitalize",
              activeTab === tab
                ? "border-amber-700/60 bg-amber-950/30 text-amber-400"
                : "border-border/50 text-muted-foreground hover:border-border"
            )}
          >
            {tab === "controls" ? `Controls (${assessment.stats.total})` :
             tab === "gaps" ? `Gaps (${assessment.gaps.filter(g => g.status !== "CLOSED").length})` :
             "Analytics"}
          </button>
        ))}
      </div>

      {/* Controls tab */}
      {activeTab === "controls" && (
        <div className="space-y-3">
          {/* Category filter */}
          <div className="flex gap-1.5 flex-wrap">
            {categories.map(cat => {
              const Icon = CATEGORY_ICONS[cat] ?? Shield;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "text-[10px] px-2.5 py-1 rounded-md border transition-all flex items-center gap-1",
                    activeCategory === cat
                      ? "border-amber-700/60 bg-amber-950/30 text-amber-400"
                      : "border-border/40 text-muted-foreground hover:border-border/70"
                  )}
                >
                  <Icon className="w-2.5 h-2.5" />
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Controls list */}
          <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
            {filteredControls.map(control => (
              <ControlRow
                key={control.id}
                control={control}
                onUpdate={(id, status) => updateControl.mutate({ id, status: status as "NOT_STARTED" | "IN_PROGRESS" | "COMPLIANT" | "NON_COMPLIANT" | "WAIVED" })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Gaps tab */}
      {activeTab === "gaps" && (
        <div className="space-y-1.5 max-h-[560px] overflow-y-auto pr-1">
          {assessment.gaps.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No gaps recorded</div>
          ) : (
            assessment.gaps.map(gap => <GapRow key={gap.id} gap={gap} />)
          )}
        </div>
      )}

      {/* Analytics tab */}
      {activeTab === "chart" && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Compliance by category */}
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-[Syne]">Compliance by Category</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={categoryStats} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#6b7280" }} />
                  <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} />
                  <Tooltip
                    contentStyle={{ background: "#0d1117", border: "1px solid #374151", fontSize: 11 }}
                    formatter={(v: number, name: string) => [v, name === "compliant" ? "Compliant" : "Gap"]}
                    labelFormatter={(l) => categoryStats.find(c => c.name === l)?.fullName ?? l}
                  />
                  <Bar dataKey="compliant" fill="#10b981" stackId="a" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="gap" fill="#374151" stackId="a" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Overall status pie */}
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-[Syne]">Overall Control Status</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend
                    iconSize={8}
                    wrapperStyle={{ fontSize: 10, color: "#9ca3af" }}
                  />
                  <Tooltip
                    contentStyle={{ background: "#0d1117", border: "1px solid #374151", fontSize: 11 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* TÜV readiness gauge */}
          <Card className="bg-card border-border/50 md:col-span-2">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-[Syne] flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-400" />
                TÜV SÜD Assessment Readiness
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Overall readiness score</span>
                  <span className={cn(
                    "font-mono font-bold text-lg",
                    tuvReadiness >= 80 ? "text-emerald-400" : tuvReadiness >= 60 ? "text-amber-400" : "text-red-400"
                  )}>{tuvReadiness}%</span>
                </div>
                <div className="w-full bg-muted/20 rounded-full h-3">
                  <div
                    className={cn(
                      "h-3 rounded-full transition-all",
                      tuvReadiness >= 80 ? "bg-emerald-500" : tuvReadiness >= 60 ? "bg-amber-500" : "bg-red-500"
                    )}
                    style={{ width: `${tuvReadiness}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {[
                    { label: "< 50% — Not Ready", color: "text-red-400" },
                    { label: "50–79% — Preparation Phase", color: "text-amber-400" },
                    { label: "≥ 80% — Ready for FSA", color: "text-emerald-400" },
                  ].map(({ label, color }) => (
                    <div key={label} className={cn("text-center p-2 rounded border border-border/30", color)}>
                      {label}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground/70">
                  Score is calculated as: (Compliant × 1.0 + In Progress × 0.5) / Total Controls.
                  A score of ≥ 80% indicates readiness for an independent TÜV SÜD Functional Safety Assessment (FSA).
                  Critical gaps must be resolved before the FSA engagement.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
