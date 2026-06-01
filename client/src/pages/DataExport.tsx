/**
 * DataExport.tsx — Production Data Export Center (v54.0)
 *
 * Allows operators and engineers to export:
 * - Production data (CSV/JSON, up to 365 days, per-well filter)
 * - Alarm history (CSV/JSON, severity filter)
 * - Well KPI summary (CSV/JSON)
 * - Audit log (CSV/JSON)
 * - Physics engine results (JSON)
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Download, FileText, BarChart3, Shield, Activity,
  Cpu, CheckCircle2, Loader2, AlertTriangle, Database,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExportResult {
  ok: boolean;
  url: string;
  filename: string;
  rows: number;
  format: string;
  generatedAt: string;
}

// ─── Export Card ──────────────────────────────────────────────────────────────

function ExportCard({
  icon: Icon,
  title,
  description,
  color,
  children,
  result,
  isLoading,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  title: string;
  description: string;
  color: string;
  children: React.ReactNode;
  result: ExportResult | null | undefined;
  isLoading: boolean;
}) {
  return (
    <Card className="bg-gray-900 border-gray-700">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm text-white flex items-center gap-2">
          <span className={`w-4 h-4 ${color} flex items-center`}><Icon className="w-4 h-4" /></span>
          {title}
        </CardTitle>
        <p className="text-xs text-gray-400">{description}</p>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {children}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            Generating export and uploading to S3…
          </div>
        )}

        {result && (
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-600 space-y-2">
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              Export ready — {result.rows.toLocaleString()} rows
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500 truncate max-w-[200px]">{result.filename}</span>
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition-colors"
              >
                <Download className="w-3 h-3" />
                Download
              </a>
            </div>
            <div className="text-[10px] text-gray-500">
              Generated: {new Date(result.generatedAt).toLocaleString()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const WELLS = ["WELL-001", "WELL-002", "WELL-003", "WELL-004", "WELL-005", "WELL-006"];

export default function DataExport() {
  // Production export state
  const [prodFormat, setProdFormat]   = useState<"csv" | "json">("csv");
  const [prodDays, setProdDays]       = useState<string>("30");
  const [prodWells, setProdWells]     = useState<string>("all");
  const [prodResult, setProdResult]   = useState<ExportResult | null>(null);

  // Alarm export state
  const [alarmFormat, setAlarmFormat] = useState<"csv" | "json">("csv");
  const [alarmLimit, setAlarmLimit]   = useState<string>("500");
  const [alarmSev, setAlarmSev]       = useState<string>("ALL");
  const [alarmResult, setAlarmResult] = useState<ExportResult | null>(null);

  // KPI export state
  const [kpiFormat, setKpiFormat]     = useState<"csv" | "json">("csv");
  const [kpiResult, setKpiResult]     = useState<ExportResult | null>(null);

  // Audit export state
  const [auditFormat, setAuditFormat] = useState<"csv" | "json">("csv");
  const [auditLimit, setAuditLimit]   = useState<string>("200");
  const [auditResult, setAuditResult] = useState<ExportResult | null>(null);

  // Physics export state
  const [physResult, setPhysResult]   = useState<ExportResult | null>(null);

  // tRPC mutations
  const prodExport   = trpc.dataExport.production.useMutation();
  const alarmExport  = trpc.dataExport.alarms.useMutation();
  const kpiExport    = trpc.dataExport.wellKpi.useMutation();
  const auditExport  = trpc.dataExport.auditLog.useMutation();
  const physExport   = trpc.dataExport.physicsResults.useMutation();

  const handleProd = async () => {
    try {
      const res = await prodExport.mutateAsync({
        format: prodFormat,
        days: parseInt(prodDays),
        wellIds: prodWells === "all" ? undefined : [prodWells],
      });
      setProdResult(res as ExportResult);
      toast.success(`Production export ready: ${(res as ExportResult).rows} rows`);
    } catch (e) {
      toast.error("Export failed: " + String(e));
    }
  };

  const handleAlarm = async () => {
    try {
      const sevMap: Record<string, number | undefined> = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4, ALL: undefined };
      const res = await alarmExport.mutateAsync({
        format: alarmFormat,
        limit: parseInt(alarmLimit),
        severity: sevMap[alarmSev],
      });
      setAlarmResult(res as ExportResult);
      toast.success(`Alarm export ready: ${(res as ExportResult).rows} rows`);
    } catch (e) {
      toast.error("Export failed: " + String(e));
    }
  };

  const handleKpi = async () => {
    try {
      const res = await kpiExport.mutateAsync({ format: kpiFormat });
      setKpiResult(res as ExportResult);
      toast.success(`KPI export ready: ${(res as ExportResult).rows} wells`);
    } catch (e) {
      toast.error("Export failed: " + String(e));
    }
  };

  const handleAudit = async () => {
    try {
      const res = await auditExport.mutateAsync({
        format: auditFormat,
        limit: parseInt(auditLimit),
      });
      setAuditResult(res as ExportResult);
      toast.success(`Audit export ready: ${(res as ExportResult).rows} entries`);
    } catch (e) {
      toast.error("Export failed: " + String(e));
    }
  };

  const handlePhys = async () => {
    try {
      const res = await physExport.mutateAsync({ format: "json" });
      setPhysResult(res as ExportResult);
      toast.success(`Physics export ready: ${(res as ExportResult).rows} wells`);
    } catch (e) {
      toast.error("Export failed: " + String(e));
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-400" />
              Data Export Center
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Export production, alarm, KPI, audit, and physics data to CSV or JSON.
              Files are uploaded to S3 and available for immediate download.
            </p>
          </div>
          <Badge className="bg-blue-600/20 text-blue-400 border-blue-500/30 text-xs">
            v54.0 · S3-backed
          </Badge>
        </div>

        {/* Export cards grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">

          {/* Production Data */}
          <ExportCard
            icon={BarChart3}
            title="Production Data"
            description="Daily oil/gas/water rates, GOR, FWHP, uptime per well"
            color="text-blue-400"
            result={prodResult}
            isLoading={prodExport.isPending}
          >
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-gray-400 mb-1 block">Format</Label>
                <Select value={prodFormat} onValueChange={v => setProdFormat(v as "csv" | "json")}>
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-400 mb-1 block">Days</Label>
                <Select value={prodDays} onValueChange={setProdDays}>
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="180">180 days</SelectItem>
                    <SelectItem value="365">365 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-400 mb-1 block">Well Filter</Label>
              <Select value={prodWells} onValueChange={setProdWells}>
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Wells</SelectItem>
                  {WELLS.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm" onClick={handleProd} disabled={prodExport.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs"
            >
              {prodExport.isPending
                ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Exporting…</>
                : <><Download className="w-3 h-3 mr-1" /> Export Production Data</>}
            </Button>
          </ExportCard>

          {/* Alarm History */}
          <ExportCard
            icon={AlertTriangle}
            title="Alarm History"
            description="All alarms with severity, type, acknowledgement and resolution status"
            color="text-red-400"
            result={alarmResult}
            isLoading={alarmExport.isPending}
          >
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-gray-400 mb-1 block">Format</Label>
                <Select value={alarmFormat} onValueChange={v => setAlarmFormat(v as "csv" | "json")}>
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-400 mb-1 block">Limit</Label>
                <Select value={alarmLimit} onValueChange={setAlarmLimit}>
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                    <SelectItem value="1000">1,000</SelectItem>
                    <SelectItem value="5000">5,000</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-400 mb-1 block">Severity Filter</Label>
              <Select value={alarmSev} onValueChange={setAlarmSev}>
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Severities</SelectItem>
                  <SelectItem value="CRITICAL">Critical Only</SelectItem>
                  <SelectItem value="HIGH">High Only</SelectItem>
                  <SelectItem value="MEDIUM">Medium Only</SelectItem>
                  <SelectItem value="LOW">Low Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm" onClick={handleAlarm} disabled={alarmExport.isPending}
              className="w-full bg-red-600 hover:bg-red-700 text-white text-xs"
            >
              {alarmExport.isPending
                ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Exporting…</>
                : <><Download className="w-3 h-3 mr-1" /> Export Alarm History</>}
            </Button>
          </ExportCard>

          {/* Well KPI Summary */}
          <ExportCard
            icon={Activity}
            title="Well KPI Summary"
            description="Current KPI snapshot for all 6 wells: rates, risk, uptime, alarms"
            color="text-emerald-400"
            result={kpiResult}
            isLoading={kpiExport.isPending}
          >
            <div>
              <Label className="text-xs text-gray-400 mb-1 block">Format</Label>
              <Select value={kpiFormat} onValueChange={v => setKpiFormat(v as "csv" | "json")}>
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm" onClick={handleKpi} disabled={kpiExport.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            >
              {kpiExport.isPending
                ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Exporting…</>
                : <><Download className="w-3 h-3 mr-1" /> Export KPI Summary</>}
            </Button>
          </ExportCard>

          {/* Audit Log */}
          <ExportCard
            icon={Shield}
            title="Audit Log"
            description="SOC 2 / IEC 62443 audit trail: user actions, resource changes, timestamps"
            color="text-purple-400"
            result={auditResult}
            isLoading={auditExport.isPending}
          >
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-gray-400 mb-1 block">Format</Label>
                <Select value={auditFormat} onValueChange={v => setAuditFormat(v as "csv" | "json")}>
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-400 mb-1 block">Limit</Label>
                <Select value={auditLimit} onValueChange={setAuditLimit}>
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                    <SelectItem value="1000">1,000</SelectItem>
                    <SelectItem value="5000">5,000</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              size="sm" onClick={handleAudit} disabled={auditExport.isPending}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs"
            >
              {auditExport.isPending
                ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Exporting…</>
                : <><Download className="w-3 h-3 mr-1" /> Export Audit Log</>}
            </Button>
          </ExportCard>

          {/* Physics Engine Results */}
          <ExportCard
            icon={Cpu}
            title="Physics Engine Results"
            description="Coupled solver outputs: nodal analysis, geomechanics, sand onset, EUR"
            color="text-amber-400"
            result={physResult}
            isLoading={physExport.isPending}
          >
            <div className="bg-gray-800/50 rounded p-2 text-[10px] text-gray-400 space-y-1">
              <div className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Nodal analysis (IPR/VLP operating point)</div>
              <div className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> 1D MEM geomechanics (fracture gradient, pore pressure)</div>
              <div className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Sand onset critical drawdown</div>
              <div className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> EUR (Arps hyperbolic decline)</div>
            </div>
            <Button
              size="sm" onClick={handlePhys} disabled={physExport.isPending}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs"
            >
              {physExport.isPending
                ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Exporting…</>
                : <><Download className="w-3 h-3 mr-1" /> Export Physics Results (JSON)</>}
            </Button>
          </ExportCard>

          {/* Info card */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                Export Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2 text-xs text-gray-400">
              <p>All exports are uploaded to S3 and returned as direct download links. Links are valid for 24 hours.</p>
              <p>CSV files are UTF-8 encoded with comma delimiters, suitable for Excel and Power BI.</p>
              <p>JSON files use ISO 8601 timestamps and are compatible with Python pandas, Node.js, and Rust serde.</p>
              <p>Production data uses synthetic demo values when the database is not connected.</p>
              <div className="mt-3 pt-3 border-t border-gray-700">
                <div className="text-[10px] text-gray-500">
                  OG-RMM Platform v54.0 · Data Export Center<br />
                  Compliant with SOC 2 Type II audit requirements
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </DashboardLayout>
  );
}
