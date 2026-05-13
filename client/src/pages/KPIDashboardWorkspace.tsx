/**
 * KPI Dashboard — Role-based KPI monitoring with traffic lights, flow-down hierarchy,
 * weighted scoring, auto-refresh (30s), and drill-down capabilities.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  RefreshCcw,
  Shield,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface KPIMetric {
  id: string;
  name: string;
  value: number;
  target: number;
  unit: string;
  weight: number;
  status: "green" | "amber" | "red";
  cadence: "hourly" | "daily";
  description: string;
}

interface DirectReportScore {
  role: string;
  title: string;
  score: number;
  status: "green" | "amber" | "red";
  weight: number;
  weightedScore: number;
}

interface RoleKPIResult {
  role: string;
  title: string;
  overallScore: number;
  overallStatus: "green" | "amber" | "red";
  metrics: KPIMetric[];
  directReportScores: DirectReportScore[];
  rollUpScore: number;
  compositeScore: number;
  lastUpdated: string;
  cadence: string;
}

interface TreeNode {
  role: string;
  title: string;
  ownScore: number;
  rollUpScore: number;
  compositeScore: number;
  status: string;
  children: TreeNode[];
}

// ─── ROLE METADATA ──────────────────────────────────────────────────────────

const ROLE_ICONS: Record<string, React.ReactNode> = {
  ceo: <BarChart3 size={18} />,
  coo: <Activity size={18} />,
  cro: <AlertTriangle size={18} />,
  cto: <Shield size={18} />,
  cso: <Shield size={18} />,
  treasury: <TrendingUp size={18} />,
  credit: <BarChart3 size={18} />,
  head_teller: <Users size={18} />,
  compliance: <CheckCircle2 size={18} />,
  customer_service: <Users size={18} />,
  internal_audit: <Shield size={18} />,
};

const STATUS_COLORS = {
  green: { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300", dot: "bg-emerald-500" },
  amber: { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-300", dot: "bg-amber-500" },
  red: { bg: "bg-red-100", text: "text-red-800", border: "border-red-300", dot: "bg-red-500" },
};

// ─── COMPONENTS ─────────────────────────────────────────────────────────────

function TrafficLight({ status }: { status: "green" | "amber" | "red" }) {
  const colors = STATUS_COLORS[status];
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-3 h-3 rounded-full ${colors.dot} animate-pulse`} />
      <span className={`text-xs font-medium ${colors.text} uppercase`}>{status}</span>
    </div>
  );
}

function ScoreBadge({ score, label }: { score: number; label?: string }) {
  const status = score >= 85 ? "green" : score >= 60 ? "amber" : "red";
  const colors = STATUS_COLORS[status];
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${colors.bg} ${colors.border} border`}>
      {label && <span className={`text-xs ${colors.text}`}>{label}:</span>}
      <span className={`text-sm font-bold ${colors.text}`}>{score.toFixed(1)}</span>
    </div>
  );
}

function MetricRow({ metric }: { metric: KPIMetric }) {
  const colors = STATUS_COLORS[metric.status];
  const isLower = metric.value < metric.target;
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${colors.border} ${colors.bg} bg-opacity-30`}>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
          <span className="text-sm font-medium text-gray-900">{metric.name}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${metric.cadence === "hourly" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
            {metric.cadence}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5 ml-4">{metric.description}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-sm font-bold text-gray-900">{metric.value}{metric.unit !== "count" && metric.unit !== "₦" && metric.unit !== "₦M" ? "" : ""} <span className="text-xs text-gray-500">{metric.unit}</span></div>
          <div className="text-xs text-gray-500">Target: {metric.target} {metric.unit}</div>
        </div>
        <div className="text-xs text-gray-400 w-12 text-right">
          {Math.round(metric.weight * 100)}%
        </div>
        <TrafficLight status={metric.status} />
      </div>
    </div>
  );
}

function DirectReportCard({ report, onDrillDown }: { report: DirectReportScore; onDrillDown: (role: string) => void }) {
  const colors = STATUS_COLORS[report.status];
  return (
    <div
      className={`p-3 rounded-lg border ${colors.border} cursor-pointer hover:shadow-md transition-shadow`}
      onClick={() => onDrillDown(report.role)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {ROLE_ICONS[report.role]}
          <div>
            <div className="text-sm font-medium">{report.title}</div>
            <div className="text-xs text-gray-500">Weight: {Math.round(report.weight * 100)}%</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ScoreBadge score={report.score} />
          <ChevronRight size={16} className="text-gray-400" />
        </div>
      </div>
    </div>
  );
}

function HierarchyTree({ node, level = 0, onSelect }: { node: TreeNode; level?: number; onSelect: (role: string) => void }) {
  const [expanded, setExpanded] = useState(level < 2);
  const colors = STATUS_COLORS[node.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.green;

  return (
    <div className={`${level > 0 ? "ml-6 border-l-2 border-gray-200 pl-4" : ""}`}>
      <div
        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-gray-50 ${colors.bg} bg-opacity-20`}
        onClick={() => { setExpanded(!expanded); onSelect(node.role); }}
      >
        {node.children.length > 0 && (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
        {ROLE_ICONS[node.role]}
        <span className="text-sm font-medium flex-1">{node.title}</span>
        <ScoreBadge score={node.compositeScore} />
        <TrafficLight status={node.status as "green" | "amber" | "red"} />
      </div>
      {expanded && node.children.map(child => (
        <HierarchyTree key={child.role} node={child} level={level + 1} onSelect={onSelect} />
      ))}
    </div>
  );
}

// ─── MAIN DASHBOARD ─────────────────────────────────────────────────────────

export default function KPIDashboardWorkspace() {
  const [selectedRole, setSelectedRole] = useState<string>("ceo");
  const [roleData, setRoleData] = useState<RoleKPIResult | null>(null);
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [view, setView] = useState<"metrics" | "hierarchy" | "compensation">("metrics");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [roleRes, treeRes] = await Promise.all([
        fetch(`/api/kpi/${selectedRole}`),
        fetch("/api/kpi/rollup"),
      ]);
      if (roleRes.ok) setRoleData(await roleRes.json());
      if (treeRes.ok) setTreeData(await treeRes.json());
      setLastRefresh(new Date());
    } catch {
      // Offline or service unavailable
    } finally {
      setLoading(false);
    }
  }, [selectedRole]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  const roles = ["ceo", "coo", "cro", "cto", "cso", "treasury", "credit", "head_teller", "compliance", "customer_service", "internal_audit"];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KPI Performance Dashboard</h1>
          <p className="text-sm text-gray-500">Real-time personnel KPIs with weighted scoring and flow-down aggregation</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-400 flex items-center gap-1">
            <Clock size={12} />
            Last: {lastRefresh.toLocaleTimeString()}
          </div>
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCcw size={14} className={autoRefresh ? "animate-spin" : ""} />
            {autoRefresh ? "Live" : "Paused"}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCcw size={14} /> Refresh
          </Button>
        </div>
      </div>

      {/* Role Selector */}
      <div className="flex gap-2 flex-wrap">
        {roles.map(role => (
          <Button
            key={role}
            variant={selectedRole === role ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedRole(role)}
            className="capitalize"
          >
            {ROLE_ICONS[role]}
            <span className="ml-1">{role.replace("_", " ")}</span>
          </Button>
        ))}
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 border-b pb-2">
        {(["metrics", "hierarchy", "compensation"] as const).map(v => (
          <Button key={v} variant={view === v ? "default" : "ghost"} size="sm" onClick={() => setView(v)} className="capitalize">
            {v}
          </Button>
        ))}
      </div>

      {loading && <div className="text-center py-12 text-gray-500">Loading KPI data...</div>}

      {!loading && view === "metrics" && roleData && (
        <div className="space-y-6">
          {/* Score Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-gray-500 mb-1">Own Score</div>
                <ScoreBadge score={roleData.overallScore} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-gray-500 mb-1">Roll-Up Score</div>
                <ScoreBadge score={roleData.rollUpScore || roleData.overallScore} label="Reports" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-gray-500 mb-1">Composite (60/40)</div>
                <ScoreBadge score={roleData.compositeScore} label="Final" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-gray-500 mb-1">Status</div>
                <TrafficLight status={roleData.overallStatus} />
              </CardContent>
            </Card>
          </div>

          {/* Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {ROLE_ICONS[selectedRole]}
                {roleData.title} — KPI Metrics
                <span className="text-xs text-gray-400 font-normal">({roleData.cadence} cadence)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {roleData.metrics.map(m => <MetricRow key={m.id} metric={m} />)}
            </CardContent>
          </Card>

          {/* Direct Reports Roll-Up */}
          {roleData.directReportScores.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowDown size={18} />
                  Flow-Down: Direct Reports
                  <span className="text-xs text-gray-400 font-normal">(40% of composite score)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {roleData.directReportScores.map(dr => (
                  <DirectReportCard key={dr.role} report={dr} onDrillDown={setSelectedRole} />
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!loading && view === "hierarchy" && treeData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Organization KPI Hierarchy (Flow-Down View)</CardTitle>
          </CardHeader>
          <CardContent>
            <HierarchyTree node={treeData} onSelect={setSelectedRole} />
          </CardContent>
        </Card>
      )}

      {!loading && view === "compensation" && roleData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Compensation Model — {roleData.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-gray-50">
                <div className="text-xs text-gray-500">Composite Score</div>
                <div className="text-2xl font-bold">{roleData.compositeScore.toFixed(1)}</div>
              </div>
              <div className="p-4 rounded-lg bg-gray-50">
                <div className="text-xs text-gray-500">Variable Multiplier</div>
                <div className="text-2xl font-bold">
                  {roleData.compositeScore >= 60 ? ((roleData.compositeScore - 60) / 40).toFixed(2) : "0.00"}x
                </div>
              </div>
              <div className="p-4 rounded-lg bg-gray-50">
                <div className="text-xs text-gray-500">Performance Band</div>
                <div className="text-lg font-bold capitalize">
                  {roleData.compositeScore >= 110 ? "Exceptional" : roleData.compositeScore >= 95 ? "Exceeds" : roleData.compositeScore >= 80 ? "Meets" : roleData.compositeScore >= 60 ? "Needs Improvement" : "Unsatisfactory"}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">KPI Weight Breakdown</h3>
              {roleData.metrics.map(m => (
                <div key={m.id} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[m.status].dot}`} />
                  <span className="text-sm flex-1">{m.name}</span>
                  <span className="text-xs text-gray-500">{Math.round(m.weight * 100)}% weight</span>
                  <span className="text-sm font-medium">{m.value} {m.unit}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
