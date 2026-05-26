/**
 * WellKPIDashboard — Consolidated 6-Well KPI Dashboard
 *
 * Displays key performance indicators for all 6 wells in a single view:
 * - Production rates (oil, gas, water)
 * - Flowing wellhead pressure
 * - Uptime / availability
 * - Active alarms count
 * - Physics risk scores (from ML prediction)
 * - Trend sparklines
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import {
  Activity, AlertTriangle, CheckCircle, Cpu, Droplets,
  Flame, Gauge, RefreshCw, TrendingDown, TrendingUp, Wifi,
  WifiOff, Zap, ChevronDown, ChevronUp, Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ── Constants ─────────────────────────────────────────────────────────────────

const WELLS = ["WELL-001", "WELL-002", "WELL-003", "WELL-004", "WELL-005", "WELL-006"] as const;
type WellId = typeof WELLS[number];

const WELL_COLORS: Record<WellId, string> = {
  "WELL-001": "#3b82f6",
  "WELL-002": "#10b981",
  "WELL-003": "#f59e0b",
  "WELL-004": "#ef4444",
  "WELL-005": "#8b5cf6",
  "WELL-006": "#06b6d4",
};

const RISK_COLORS = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#f59e0b",
  LOW: "#10b981",
  UNKNOWN: "#6b7280",
};

const RISK_BG = {
  CRITICAL: "bg-red-500/10 text-red-400 border-red-500/30",
  HIGH: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  MEDIUM: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  LOW: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  UNKNOWN: "bg-gray-500/10 text-gray-400 border-gray-500/30",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface WellKPI {
  wellId: WellId;
  oilRateBopd: number;
  gasRateMmscfd: number;
  waterRateBwpd: number;
  waterCutPct: number;
  gorScfBbl: number;
  fwhpPsia: number;
  uptimePct: number;
  activeAlarms: number;
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  riskScore: number;
  trend: "up" | "down" | "flat";
  trendData: { t: number; v: number }[];
  lastUpdated: number;
  status: "PRODUCING" | "SHUT-IN" | "WORKOVER" | "TESTING";
}

// ── Synthetic KPI generator (demo data when DB unavailable) ───────────────────

function generateWellKPIs(): WellKPI[] {
  const now = Date.now();
  return WELLS.map((wellId, i) => {
    const base = 800 + i * 200;
    const trendData = Array.from({ length: 12 }, (_, j) => ({
      t: j,
      v: base + Math.sin(j * 0.8 + i) * 80 + Math.random() * 40,
    }));
    const statuses: WellKPI["status"][] = ["PRODUCING", "PRODUCING", "PRODUCING", "PRODUCING", "TESTING", "SHUT-IN"];
    const risks: WellKPI["riskLevel"][] = ["LOW", "LOW", "MEDIUM", "HIGH", "LOW", "CRITICAL"];
    return {
      wellId,
      oilRateBopd: Math.round(base + Math.random() * 200),
      gasRateMmscfd: parseFloat((0.8 + i * 0.3 + Math.random() * 0.2).toFixed(2)),
      waterRateBwpd: Math.round(200 + i * 80 + Math.random() * 100),
      waterCutPct: Math.round(15 + i * 5 + Math.random() * 5),
      gorScfBbl: Math.round(800 + i * 100 + Math.random() * 50),
      fwhpPsia: Math.round(1200 - i * 80 + Math.random() * 50),
      uptimePct: Math.round(92 + Math.random() * 7),
      activeAlarms: [0, 1, 2, 3, 0, 5][i],
      riskLevel: risks[i],
      riskScore: [12, 25, 45, 72, 18, 91][i],
      trend: ["up", "flat", "down", "down", "up", "down"][i] as WellKPI["trend"],
      trendData,
      lastUpdated: now - Math.random() * 60_000,
      status: statuses[i],
    };
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TrendIcon({ trend }: { trend: WellKPI["trend"] }) {
  if (trend === "up") return <TrendingUp className="w-3 h-3 text-emerald-400" />;
  if (trend === "down") return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Activity className="w-3 h-3 text-gray-400" />;
}

function StatusBadge({ status }: { status: WellKPI["status"] }) {
  const styles: Record<WellKPI["status"], string> = {
    "PRODUCING": "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    "SHUT-IN": "bg-gray-500/10 text-gray-400 border-gray-500/30",
    "WORKOVER": "bg-blue-500/10 text-blue-400 border-blue-500/30",
    "TESTING": "bg-purple-500/10 text-purple-400 border-purple-500/30",
  };
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${styles[status]}`}>
      {status}
    </span>
  );
}

function SparkLine({ data, color }: { data: { t: number; v: number }[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function WellCard({ kpi, expanded, onToggle }: {
  kpi: WellKPI;
  expanded: boolean;
  onToggle: () => void;
}) {
  const color = WELL_COLORS[kpi.wellId];
  const riskBg = RISK_BG[kpi.riskLevel];

  return (
    <Card
      className="bg-gray-900 border-gray-700 hover:border-gray-500 transition-colors cursor-pointer"
      onClick={onToggle}
    >
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <CardTitle className="text-sm font-bold text-white">{kpi.wellId}</CardTitle>
            <StatusBadge status={kpi.status} />
          </div>
          <div className="flex items-center gap-2">
            {kpi.activeAlarms > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-red-400">
                <AlertTriangle className="w-3 h-3" />
                {kpi.activeAlarms}
              </span>
            )}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${riskBg}`}>
              {kpi.riskLevel}
            </span>
            {expanded ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-3 pt-0">
        {/* Primary KPIs */}
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div>
            <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5">
              <Droplets className="w-3 h-3 text-blue-400" /> Oil
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-white">{kpi.oilRateBopd.toLocaleString()}</span>
              <span className="text-[10px] text-gray-500">bopd</span>
              <TrendIcon trend={kpi.trend} />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5">
              <Flame className="w-3 h-3 text-orange-400" /> Gas
            </div>
            <div className="text-sm font-bold text-white">
              {kpi.gasRateMmscfd} <span className="text-[10px] text-gray-500">MMscfd</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5">
              <Gauge className="w-3 h-3 text-purple-400" /> FWHP
            </div>
            <div className="text-sm font-bold text-white">
              {kpi.fwhpPsia} <span className="text-[10px] text-gray-500">psia</span>
            </div>
          </div>
        </div>

        {/* Sparkline */}
        <SparkLine data={kpi.trendData} color={color} />

        {/* Risk progress bar */}
        <div className="mt-2">
          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
            <span>Risk Score</span>
            <span style={{ color: RISK_COLORS[kpi.riskLevel] }}>{kpi.riskScore}%</span>
          </div>
          <Progress
            value={kpi.riskScore}
            className="h-1.5 bg-gray-700"
          />
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-700 grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Water Cut</span>
              <span className="text-white">{kpi.waterCutPct}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">GOR</span>
              <span className="text-white">{kpi.gorScfBbl} scf/bbl</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Water Rate</span>
              <span className="text-white">{kpi.waterRateBwpd.toLocaleString()} bwpd</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Uptime</span>
              <span className="text-emerald-400">{kpi.uptimePct}%</span>
            </div>
            <div className="col-span-2 flex justify-between">
              <span className="text-gray-400">Last Updated</span>
              <span className="text-white">{new Date(kpi.lastUpdated).toLocaleTimeString()}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
// ── PINN Uncertainty Panel ────────────────────────────────────────────────────────────────────────────────

const PINN_OUTPUTS = [
  { key: "q_bpd",              label: "Flow Rate",          unit: "bopd",   color: "#3b82f6" },
  { key: "pwf_psi",            label: "BHP",                unit: "psi",    color: "#8b5cf6" },
  { key: "drawdown_psi",       label: "Drawdown",           unit: "psi",    color: "#f59e0b" },
  { key: "sanding_index",      label: "Sanding Index",      unit: "",       color: "#ef4444" },
  { key: "risk_score",         label: "Risk Score",         unit: "%",      color: "#f97316" },
  { key: "fracture_gradient_ppg", label: "Frac Gradient",  unit: "ppg",    color: "#10b981" },
  { key: "eur_mbbl",           label: "EUR",                unit: "Mbbl",   color: "#06b6d4" },
];

function PINNUncertaintyPanel({ wells }: { wells: WellKPI[] }) {
  const [selectedWell, setSelectedWell] = useState<WellId>("WELL-001");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<Record<string, { mean: number; lower: number; upper: number; cv_pct: number }> | null>(null);
  const [modelTrained, setModelTrained] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const pinnPredict = trpc.pinn.predict.useMutation();
  const pinnTrain   = trpc.pinn.train.useMutation();
  const pinnSave    = trpc.pinn.saveModel.useMutation();
  const pinnLoad    = trpc.pinn.loadModel.useMutation();
  const pinnStatus  = trpc.pinn.status.useQuery(undefined, { refetchInterval: 10_000 });

  const well = useMemo(() => wells.find(w => w.wellId === selectedWell), [wells, selectedWell]);

  const runPrediction = async () => {
    if (!well) return;
    setIsRunning(true);
    try {
      const res = await pinnPredict.mutateAsync({
        wellId:            selectedWell,
        reservoirPressure: 3000,
        qMax:              well.oilRateBopd * 1.4,
        skinFactor:        0,
        espFrequencyHz:    0,
        wellheadPressure:  well.fwhpPsia,
        tvdFt:             8000,
        fluidGradient:     0.433,
        waterCut:          well.waterCutPct / 100,
        gorScfPerBbl:      well.gorScfBbl,
        avgBulkDensityGcc: 2.35,
        lotPressurePpg:    14.5,
        currentMudWeightPpg: 10.5,
        ucsPsi:            3000,
        frictionAngleDeg:  30,
        biotCoefficient:   0.8,
        declineRateDi:     0.08,
        bFactor:           0.5,
        mcSamples:         50,
      }) as Record<string, { mean: number; lower: number; upper: number; cv_pct: number }>;
      setResult(res);
      setModelTrained(!!(res as any).model_trained);
    } catch (e) {
      toast.error("PINN prediction failed: " + String(e));
    } finally {
      setIsRunning(false);
    }
  };

  const handleTrain = async () => {
    setIsRunning(true);
    try {
      await pinnTrain.mutateAsync({ nSamples: 300, nEpochs: 150, lr: 1e-3, physicsWeight: 0.1 });
      toast.success("PINN training complete");
      setModelTrained(true);
    } catch (e) {
      toast.error("Training failed: " + String(e));
    } finally {
      setIsRunning(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const r = await pinnSave.mutateAsync();
      if ((r as any).ok) toast.success("Model saved to S3");
      else toast.error("Save failed: " + (r as any).error);
    } catch (e) {
      toast.error("Save error: " + String(e));
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoad = async () => {
    setIsLoading(true);
    try {
      const r = await pinnLoad.mutateAsync();
      if ((r as any).ok) { toast.success("Model loaded from S3"); setModelTrained(true); }
      else toast.error("Load failed: " + (r as any).error);
    } catch (e) {
      toast.error("Load error: " + String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const statusData = pinnStatus.data as any;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-400" />
            PINN Surrogate — Monte Carlo Uncertainty Quantification
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedWell}
              onChange={e => setSelectedWell(e.target.value as WellId)}
              className="bg-gray-800 border border-gray-600 text-white text-xs rounded px-2 py-1.5"
            >
              {WELLS.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
            <Button size="sm" onClick={runPrediction} disabled={isRunning}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs">
              {isRunning ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
              {isRunning ? "Running..." : "Run PINN Predict"}
            </Button>
            <Button size="sm" variant="outline" onClick={handleTrain} disabled={isRunning}
              className="text-xs border-blue-500 text-blue-400 hover:bg-blue-500/10">
              Train Model
            </Button>
            <Button size="sm" variant="outline" onClick={handleSave} disabled={isSaving || !modelTrained}
              className="text-xs border-emerald-500 text-emerald-400 hover:bg-emerald-500/10">
              {isSaving ? "Saving..." : "Save to S3"}
            </Button>
            <Button size="sm" variant="outline" onClick={handleLoad} disabled={isLoading}
              className="text-xs border-cyan-500 text-cyan-400 hover:bg-cyan-500/10">
              {isLoading ? "Loading..." : "Load from S3"}
            </Button>
            {statusData && (
              <span className={`text-[10px] px-2 py-0.5 rounded border ${
                statusData.available !== false ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-gray-500/10 text-gray-400 border-gray-500/30"
              }`}>
                {statusData.available !== false ? (statusData.trained ? `v${statusData.model_version ?? "1.0"} trained` : "untrained") : "ML offline"}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {PINN_OUTPUTS.map(({ key, label, unit, color }) => {
            const val = result[key];
            if (!val) return null;
            const cvPct = val.cv_pct ?? 0;
            const uncertainty = cvPct < 5 ? "LOW" : cvPct < 15 ? "MEDIUM" : "HIGH";
            const ucBg = uncertainty === "LOW" ? "bg-emerald-500/10 text-emerald-400" : uncertainty === "MEDIUM" ? "bg-yellow-500/10 text-yellow-400" : "bg-red-500/10 text-red-400";
            return (
              <Card key={key} className="bg-gray-900 border-gray-700">
                <CardContent className="px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">{label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${ucBg}`}>
                      ±{cvPct.toFixed(1)}% CV
                    </span>
                  </div>
                  <div className="text-xl font-bold" style={{ color }}>
                    {val.mean.toFixed(key === "eur_mbbl" ? 0 : key === "sanding_index" ? 3 : 1)}
                    {unit && <span className="text-xs text-gray-500 ml-1">{unit}</span>}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1">
                    95% CI: [{val.lower.toFixed(1)}, {val.upper.toFixed(1)}] {unit}
                  </div>
                  {/* CI bar */}
                  <div className="mt-2 relative h-2 bg-gray-700 rounded">
                    <div
                      className="absolute h-2 rounded opacity-40"
                      style={{
                        backgroundColor: color,
                        left: `${Math.max(0, ((val.lower - val.lower * 0.9) / (val.upper * 1.1 - val.lower * 0.9)) * 100)}%`,
                        right: `${Math.max(0, 100 - ((val.upper - val.lower * 0.9) / (val.upper * 1.1 - val.lower * 0.9)) * 100)}%`,
                      }}
                    />
                    <div
                      className="absolute w-1 h-2 rounded"
                      style={{
                        backgroundColor: color,
                        left: `${((val.mean - val.lower * 0.9) / (val.upper * 1.1 - val.lower * 0.9)) * 100}%`,
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!result && (
        <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
          Select a well and click &quot;Run PINN Predict&quot; to see uncertainty-quantified predictions.
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────────────────────────

export default function WellKPIDashboard() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [kpis, setKpis] = useState<WellKPI[]>([]);
  const [expandedWell, setExpandedWell] = useState<WellId | null>(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // Load KPIs — prefer live DB data (kpiSummary), fall back to synthetic demo
  const { data: kpiSummaryData } = trpc.wells.kpiSummary.useQuery(undefined, {
    retry: false,
    refetchInterval: autoRefresh ? 30_000 : false,
  });

  const { data: alarmsData } = trpc.alarms.list.useQuery({ limit: 50, state: "UNACKNOWLEDGED" }, {
    enabled: isAuthenticated,
    retry: false,
  });

  const statusMap: Record<string, WellKPI["status"]> = {
    ACTIVE: "PRODUCING",
    SHUT_IN: "SHUT-IN",
    WORKOVER: "WORKOVER",
    DRILLING: "TESTING",
    ABANDONED: "SHUT-IN",
  };

  const loadKPIs = useCallback(() => {
    if (kpiSummaryData && kpiSummaryData.length > 0) {
      // Use live DB data from kpiSummary
      const liveKpis: WellKPI[] = kpiSummaryData.map(w => {
        const trendData = Array.from({ length: 12 }, (_, j) => ({
          t: j,
          v: (w.oilRateBopd ?? 0) + Math.sin(j * 0.8) * 50,
        }));
        return {
          wellId: (w.wellId as WellId) in WELL_COLORS ? (w.wellId as WellId) : "WELL-001" as WellId,
          status: statusMap[w.status] ?? "PRODUCING",
          oilRateBopd: w.oilRateBopd ?? 0,
          gasRateMmscfd: w.gasRateMmscfd ?? 0,
          waterRateBwpd: w.waterRateBwpd ?? 0,
          waterCutPct: w.waterCutPct ?? 0,
          gorScfBbl: w.gorScfBbl ?? 0,
          fwhpPsia: w.fwhpPsia ?? 0,
          uptimePct: w.status === "ACTIVE" ? 98 : w.status === "WORKOVER" ? 45 : 0,
          activeAlarms: w.activeAlarms,
          riskScore: w.riskScore,
          riskLevel: (w.riskLevel as WellKPI["riskLevel"]) ?? "UNKNOWN",
          trend: "stable" as unknown as WellKPI["trend"],
          trendData,
          lastUpdated: w.lastTelemetryAt ? new Date(w.lastTelemetryAt).getTime() : Date.now(),
        };
      });
      setKpis(liveKpis);
    } else {
      // Fall back to synthetic demo data
      const base = generateWellKPIs();
      if (alarmsData?.length) {
        base.forEach(kpi => {
          kpi.activeAlarms = alarmsData.filter(a => a.wellId === kpi.wellId).length;
        });
      }
      setKpis(base);
    }
    setLastRefresh(Date.now());
  }, [kpiSummaryData, alarmsData]);

  useEffect(() => {
    loadKPIs();
  }, [loadKPIs]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadKPIs, 30_000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadKPIs]);

  // Aggregate KPIs
  const totalOil = kpis.reduce((s, k) => s + k.oilRateBopd, 0);
  const totalGas = kpis.reduce((s, k) => s + k.gasRateMmscfd, 0);
  const totalWater = kpis.reduce((s, k) => s + k.waterRateBwpd, 0);
  const avgUptime = kpis.length ? Math.round(kpis.reduce((s, k) => s + k.uptimePct, 0) / kpis.length) : 0;
  const totalAlarms = kpis.reduce((s, k) => s + k.activeAlarms, 0);
  const criticalWells = kpis.filter(k => k.riskLevel === "CRITICAL" || k.riskLevel === "HIGH").length;
  const producingWells = kpis.filter(k => k.status === "PRODUCING").length;

  // Export to CSV
  const exportCSV = () => {
    const headers = ["Well ID", "Status", "Oil (bopd)", "Gas (MMscfd)", "Water (bwpd)", "WC%", "GOR", "FWHP (psia)", "Uptime%", "Risk Level", "Risk Score", "Active Alarms"];
    const rows = kpis.map(k => [
      k.wellId, k.status, k.oilRateBopd, k.gasRateMmscfd, k.waterRateBwpd,
      k.waterCutPct, k.gorScfBbl, k.fwhpPsia, k.uptimePct, k.riskLevel, k.riskScore, k.activeAlarms,
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `well-kpi-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("KPI data exported to CSV");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">Loading dashboard...</div>
      </div>
    );
  }

  // Comparison chart data
  const comparisonData = kpis.map(k => ({
    name: k.wellId.replace("WELL-", "W"),
    oil: k.oilRateBopd,
    gas: Math.round(k.gasRateMmscfd * 1000),
    water: k.waterRateBwpd,
    risk: k.riskScore,
  }));

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            6-Well KPI Dashboard
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Last refreshed: {new Date(lastRefresh).toLocaleTimeString()} ·{" "}
            <span className={autoRefresh ? "text-emerald-400" : "text-gray-500"}>
              {autoRefresh ? "Auto-refresh ON (30s)" : "Auto-refresh OFF"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(v => !v)}
            className={`text-xs border-gray-600 ${autoRefresh ? "text-emerald-400" : "text-gray-400"}`}
          >
            {autoRefresh ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
            {autoRefresh ? "Live" : "Paused"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadKPIs}
            className="text-xs border-gray-600 text-gray-300"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            className="text-xs border-gray-600 text-gray-300"
          >
            <Download className="w-3 h-3 mr-1" />
            Export CSV
          </Button>
          {!isAuthenticated && (
            <Button size="sm" onClick={() => window.location.href = getLoginUrl()} className="text-xs bg-blue-600 hover:bg-blue-700">
              Sign In for Live Data
            </Button>
          )}
        </div>
      </div>

      {/* Fleet Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: "Total Oil", value: `${totalOil.toLocaleString()}`, unit: "bopd", icon: <Droplets className="w-4 h-4 text-blue-400" />, color: "text-blue-400" },
          { label: "Total Gas", value: `${totalGas.toFixed(1)}`, unit: "MMscfd", icon: <Flame className="w-4 h-4 text-orange-400" />, color: "text-orange-400" },
          { label: "Total Water", value: `${totalWater.toLocaleString()}`, unit: "bwpd", icon: <Droplets className="w-4 h-4 text-cyan-400" />, color: "text-cyan-400" },
          { label: "Avg Uptime", value: `${avgUptime}`, unit: "%", icon: <Zap className="w-4 h-4 text-yellow-400" />, color: "text-yellow-400" },
          { label: "Active Alarms", value: `${totalAlarms}`, unit: "total", icon: <AlertTriangle className="w-4 h-4 text-red-400" />, color: totalAlarms > 0 ? "text-red-400" : "text-emerald-400" },
          { label: "At-Risk Wells", value: `${criticalWells}`, unit: `of ${producingWells} producing`, icon: <Cpu className="w-4 h-4 text-purple-400" />, color: criticalWells > 0 ? "text-orange-400" : "text-emerald-400" },
        ].map(({ label, value, unit, icon, color }) => (
          <Card key={label} className="bg-gray-900 border-gray-700">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                {icon}
                <span className="text-[10px] text-gray-400">{label}</span>
              </div>
              <div className={`text-lg font-bold ${color}`}>{value}</div>
              <div className="text-[10px] text-gray-500">{unit}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-800 border border-gray-700 mb-4">
          <TabsTrigger value="overview" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Well Cards
          </TabsTrigger>
          <TabsTrigger value="comparison" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Comparison Charts
          </TabsTrigger>
          <TabsTrigger value="risk" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Risk
          </TabsTrigger>
          <TabsTrigger value="pinn" className="text-xs data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            PINN Uncertainty
          </TabsTrigger>
        </TabsList>

        {/* Well Cards Grid */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {kpis.map(kpi => (
              <WellCard
                key={kpi.wellId}
                kpi={kpi}
                expanded={expandedWell === kpi.wellId}
                onToggle={() => setExpandedWell(expandedWell === kpi.wellId ? null : kpi.wellId)}
              />
            ))}
          </div>
        </TabsContent>

        {/* Comparison Charts */}
        <TabsContent value="comparison">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Oil Rate Comparison */}
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm text-white flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-blue-400" />
                  Oil Production Rate (bopd)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "6px" }}
                      labelStyle={{ color: "#f3f4f6" }}
                    />
                    <Bar dataKey="oil" radius={[3, 3, 0, 0]}>
                      {comparisonData.map((_, i) => (
                        <Cell key={i} fill={WELL_COLORS[WELLS[i]]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gas Rate Comparison */}
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-400" />
                  Gas Production Rate (Mscfd)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "6px" }}
                      labelStyle={{ color: "#f3f4f6" }}
                    />
                    <Bar dataKey="gas" radius={[3, 3, 0, 0]}>
                      {comparisonData.map((_, i) => (
                        <Cell key={i} fill={WELL_COLORS[WELLS[i]]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Risk Score Comparison */}
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  Risk Score by Well (0–100)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#9ca3af", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "6px" }}
                      labelStyle={{ color: "#f3f4f6" }}
                    />
                    <ReferenceLine y={65} stroke="#f97316" strokeDasharray="3 3" label={{ value: "High Risk", fill: "#f97316", fontSize: 10 }} />
                    <ReferenceLine y={85} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "Critical", fill: "#ef4444", fontSize: 10 }} />
                    <Bar dataKey="risk" radius={[3, 3, 0, 0]}>
                      {comparisonData.map((entry, i) => (
                        <Cell key={i} fill={RISK_COLORS[kpis[i]?.riskLevel ?? "UNKNOWN"]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Water Cut Comparison */}
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm text-white flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-cyan-400" />
                  Water Cut by Well (%)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-2">
                  {kpis.map(kpi => (
                    <div key={kpi.wellId} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-16">{kpi.wellId.replace("WELL-", "W")}</span>
                      <div className="flex-1">
                        <Progress value={kpi.waterCutPct} className="h-3 bg-gray-700" />
                      </div>
                      <span className="text-xs text-white w-10 text-right">{kpi.waterCutPct}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Risk Matrix */}
        <TabsContent value="risk">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm text-white">Risk Summary</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-3">
                  {kpis.map(kpi => (
                    <div key={kpi.wellId} className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: WELL_COLORS[kpi.wellId] }} />
                      <span className="text-xs text-white w-20">{kpi.wellId}</span>
                      <div className="flex-1">
                        <Progress value={kpi.riskScore} className="h-2 bg-gray-700" />
                      </div>
                      <span className="text-xs w-8 text-right" style={{ color: RISK_COLORS[kpi.riskLevel] }}>
                        {kpi.riskScore}%
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${RISK_BG[kpi.riskLevel]}`}>
                        {kpi.riskLevel}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-700">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm text-white">Fleet Health Overview</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-4">
                  {/* Status breakdown */}
                  <div>
                    <div className="text-xs text-gray-400 mb-2">Well Status</div>
                    <div className="grid grid-cols-2 gap-2">
                      {(["PRODUCING", "SHUT-IN", "WORKOVER", "TESTING"] as const).map(status => {
                        const count = kpis.filter(k => k.status === status).length;
                        return (
                          <div key={status} className="flex items-center justify-between bg-gray-800 rounded px-2 py-1.5">
                            <span className="text-xs text-gray-300">{status}</span>
                            <span className="text-xs font-bold text-white">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Risk breakdown */}
                  <div>
                    <div className="text-xs text-gray-400 mb-2">Risk Distribution</div>
                    <div className="grid grid-cols-2 gap-2">
                      {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map(level => {
                        const count = kpis.filter(k => k.riskLevel === level).length;
                        return (
                          <div key={level} className="flex items-center justify-between bg-gray-800 rounded px-2 py-1.5">
                            <span className="text-xs" style={{ color: RISK_COLORS[level] }}>{level}</span>
                            <span className="text-xs font-bold text-white">{count} wells</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Uptime summary */}
                  <div>
                    <div className="text-xs text-gray-400 mb-2">Uptime</div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <Progress value={avgUptime} className="h-3 bg-gray-700" />
                      </div>
                      <span className="text-sm font-bold text-emerald-400">{avgUptime}%</span>
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1">Fleet average across {kpis.length} wells</div>
                  </div>

                  {/* Alarm summary */}
                  {totalAlarms > 0 ? (
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded p-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-red-400">{totalAlarms} Active Alarms</div>
                        <div className="text-[10px] text-gray-400">Across {kpis.filter(k => k.activeAlarms > 0).length} wells</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded p-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <div className="text-xs text-emerald-400">No active alarms — all wells nominal</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* PINN Uncertainty Tab */}
        <TabsContent value="pinn">
          <PINNUncertaintyPanel wells={kpis} />
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="mt-6 text-center text-[10px] text-gray-600">
        OG-RMM Platform v54.0 · 6-Well KPI Dashboard · Data refreshes every 30 seconds
        {!isAuthenticated && " · Sign in for live well data"}
      </div>
    </div>
  );
}
