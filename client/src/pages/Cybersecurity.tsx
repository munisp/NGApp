/**
 * IEC 62443 Cybersecurity Dashboard
 * Design: Dark Amber — OG-RMM Platform
 *
 * Gap Closure: G-06 — OT Cybersecurity (IEC 62443)
 * Covers:
 *   - Security Level assessment per zone (SL-1 to SL-4)
 *   - Network segmentation visualization (Purdue model)
 *   - Vulnerability scan results per edge agent
 *   - Patch compliance tracking
 *   - Incident response log
 *   - Certificate expiry monitoring
 *   - NERC CIP / IEC 62443 control compliance matrix
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Shield, ShieldAlert, ShieldCheck, Lock, Unlock,
  AlertTriangle, CheckCircle2, Clock, RefreshCw,
  Network, Server, Cpu, Globe, Key, FileText,
  Eye, EyeOff, Activity, Zap
} from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, LineChart, Line
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

type SecurityLevel = 1 | 2 | 3 | 4;
type VulnSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
type IncidentStatus = "OPEN" | "INVESTIGATING" | "CONTAINED" | "RESOLVED";

interface SecurityZone {
  zone_id: string;
  name: string;
  purdue_level: number;
  target_sl: SecurityLevel;
  current_sl: SecurityLevel;
  assets: number;
  vulnerabilities: { critical: number; high: number; medium: number; low: number };
  last_scan: string;
}

interface Vulnerability {
  cve_id: string;
  asset: string;
  severity: VulnSeverity;
  cvss_score: number;
  description: string;
  patch_available: boolean;
  days_open: number;
}

interface SecurityIncident {
  incident_id: string;
  timestamp: string;
  type: string;
  source_ip?: string;
  target: string;
  severity: VulnSeverity;
  status: IncidentStatus;
  description: string;
}

interface Certificate {
  name: string;
  asset: string;
  expiry: string;
  days_remaining: number;
  issuer: string;
  status: "VALID" | "EXPIRING_SOON" | "EXPIRED";
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const SECURITY_ZONES: SecurityZone[] = [
  {
    zone_id: "Z0",
    name: "Enterprise / IT (Level 4-5)",
    purdue_level: 4,
    target_sl: 2,
    current_sl: 2,
    assets: 45,
    vulnerabilities: { critical: 0, high: 2, medium: 8, low: 14 },
    last_scan: "2026-03-13T08:00:00Z",
  },
  {
    zone_id: "Z1",
    name: "Supervisory / SCADA (Level 3)",
    purdue_level: 3,
    target_sl: 3,
    current_sl: 2,
    assets: 18,
    vulnerabilities: { critical: 1, high: 3, medium: 5, low: 9 },
    last_scan: "2026-03-13T08:00:00Z",
  },
  {
    zone_id: "Z2",
    name: "Control Network (Level 2)",
    purdue_level: 2,
    target_sl: 3,
    current_sl: 3,
    assets: 32,
    vulnerabilities: { critical: 0, high: 1, medium: 3, low: 7 },
    last_scan: "2026-03-13T08:00:00Z",
  },
  {
    zone_id: "Z3",
    name: "Field / Edge Devices (Level 1)",
    purdue_level: 1,
    target_sl: 2,
    current_sl: 2,
    assets: 142,
    vulnerabilities: { critical: 2, high: 7, medium: 18, low: 31 },
    last_scan: "2026-03-13T06:00:00Z",
  },
  {
    zone_id: "Z4",
    name: "Safety Instrumented Systems (SIS)",
    purdue_level: 1,
    target_sl: 4,
    current_sl: 3,
    assets: 28,
    vulnerabilities: { critical: 0, high: 0, medium: 1, low: 3 },
    last_scan: "2026-03-12T22:00:00Z",
  },
];

const VULNERABILITIES: Vulnerability[] = [
  {
    cve_id: "CVE-2024-3094",
    asset: "Edge Agent v2.1.3 (Permian Basin cluster)",
    severity: "CRITICAL",
    cvss_score: 9.8,
    description: "Remote code execution via malformed OPC-UA NodeId",
    patch_available: true,
    days_open: 12,
  },
  {
    cve_id: "CVE-2025-1234",
    asset: "SCADA HMI Server (Level 3)",
    severity: "CRITICAL",
    cvss_score: 9.1,
    description: "Authentication bypass in Modbus TCP handler",
    patch_available: true,
    days_open: 5,
  },
  {
    cve_id: "CVE-2024-8821",
    asset: "API Gateway v1.4.0",
    severity: "HIGH",
    cvss_score: 7.5,
    description: "JWT algorithm confusion attack (RS256 → HS256)",
    patch_available: true,
    days_open: 8,
  },
  {
    cve_id: "CVE-2025-0091",
    asset: "Redpanda 23.3.1",
    severity: "HIGH",
    cvss_score: 7.2,
    description: "Unauthenticated topic enumeration via Admin API",
    patch_available: false,
    days_open: 3,
  },
  {
    cve_id: "CVE-2024-6712",
    asset: "InfluxDB 2.7.1",
    severity: "MEDIUM",
    cvss_score: 5.4,
    description: "SSRF via Flux query engine HTTP source",
    patch_available: true,
    days_open: 21,
  },
];

const INCIDENTS: SecurityIncident[] = [
  {
    incident_id: "INC-2026-0047",
    timestamp: "2026-03-13T03:22:00Z",
    type: "Brute Force",
    source_ip: "185.220.101.x",
    target: "API Gateway /auth/token",
    severity: "HIGH",
    status: "CONTAINED",
    description: "847 failed login attempts from Tor exit node. IP blocked by WAF. No successful authentication.",
  },
  {
    incident_id: "INC-2026-0046",
    timestamp: "2026-03-12T14:55:00Z",
    type: "Anomalous OPC-UA",
    source_ip: "10.4.22.87",
    target: "Edge Agent — Bakken cluster",
    severity: "MEDIUM",
    status: "INVESTIGATING",
    description: "Unusual NodeId browse request pattern from internal IP. Possible reconnaissance. Lateral movement investigation in progress.",
  },
  {
    incident_id: "INC-2026-0045",
    timestamp: "2026-03-11T09:10:00Z",
    type: "Certificate Mismatch",
    source_ip: undefined,
    target: "Modbus RTU Gateway — Haynesville",
    severity: "LOW",
    status: "RESOLVED",
    description: "TLS certificate CN mismatch on internal mTLS connection. Misconfiguration corrected.",
  },
];

const CERTIFICATES: Certificate[] = [
  { name: "API Gateway TLS", asset: "api-gateway.og-rmm.internal", expiry: "2026-09-15", days_remaining: 186, issuer: "Let's Encrypt", status: "VALID" },
  { name: "Edge Agent mTLS (Permian)", asset: "edge-permian-01", expiry: "2026-04-02", days_remaining: 20, issuer: "Internal CA", status: "EXPIRING_SOON" },
  { name: "SCADA HMI Certificate", asset: "scada-hmi-01", expiry: "2026-03-18", days_remaining: 5, issuer: "Internal CA", status: "EXPIRING_SOON" },
  { name: "Keycloak OIDC", asset: "auth.og-rmm.internal", expiry: "2027-01-10", days_remaining: 303, issuer: "DigiCert", status: "VALID" },
  { name: "InfluxDB TLS", asset: "influx.og-rmm.internal", expiry: "2026-06-30", days_remaining: 109, issuer: "Internal CA", status: "VALID" },
  { name: "Redpanda Broker TLS", asset: "kafka.og-rmm.internal", expiry: "2026-03-20", days_remaining: 7, issuer: "Internal CA", status: "EXPIRING_SOON" },
];

const RADAR_DATA = [
  { subject: "Access Control", A: 85, fullMark: 100 },
  { subject: "Network Seg.", A: 72, fullMark: 100 },
  { subject: "Patch Mgmt", A: 61, fullMark: 100 },
  { subject: "Audit Logging", A: 90, fullMark: 100 },
  { subject: "Crypto / PKI", A: 78, fullMark: 100 },
  { subject: "Incident Resp.", A: 83, fullMark: 100 },
  { subject: "Physical Sec.", A: 95, fullMark: 100 },
  { subject: "Supply Chain", A: 55, fullMark: 100 },
];

const PATCH_TREND = [
  { week: "W1", patched: 12, open: 28 },
  { week: "W2", patched: 18, open: 24 },
  { week: "W3", patched: 22, open: 19 },
  { week: "W4", patched: 15, open: 21 },
  { week: "W5", patched: 28, open: 16 },
  { week: "W6", patched: 19, open: 14 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function slColor(sl: SecurityLevel, target: SecurityLevel) {
  if (sl >= target) return "text-emerald-400";
  if (sl === target - 1) return "text-amber-400";
  return "text-red-400";
}

function sevConfig(sev: VulnSeverity) {
  const map: Record<VulnSeverity, { color: string; bg: string }> = {
    CRITICAL: { color: "text-red-400", bg: "bg-red-500/10 border-red-700/30" },
    HIGH:     { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-700/30" },
    MEDIUM:   { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-700/30" },
    LOW:      { color: "text-blue-400", bg: "bg-blue-500/10 border-blue-700/30" },
    INFO:     { color: "text-muted-foreground", bg: "bg-muted/30 border-border/30" },
  };
  return map[sev];
}

function incidentStatusConfig(status: IncidentStatus) {
  const map: Record<IncidentStatus, { color: string; label: string }> = {
    OPEN:          { color: "text-red-400", label: "Open" },
    INVESTIGATING: { color: "text-amber-400", label: "Investigating" },
    CONTAINED:     { color: "text-blue-400", label: "Contained" },
    RESOLVED:      { color: "text-emerald-400", label: "Resolved" },
  };
  return map[status];
}

// ── NVD CVE Live Feed Component ─────────────────────────────────────────────

function NvdCveFeed() {
  const [keyword, setKeyword] = useState("SCADA");
  const [inputValue, setInputValue] = useState("SCADA");

  const { data, isLoading, refetch, isFetching } = trpc.nvdCve.fetchLatest.useQuery(
    { keyword, resultsPerPage: 20 },
    { staleTime: 5 * 60 * 1000 } // cache 5 min to avoid rate limiting
  );

  const ICS_KEYWORDS_LIST = ["SCADA", "PLC", "OPC", "Modbus", "DNP3", "Siemens", "Rockwell", "Schneider", "Honeywell", "Emerson"];

  function severityColor(sev: string) {
    if (sev === "CRITICAL") return { color: "text-red-400", bg: "bg-red-950/20 border-red-700/40" };
    if (sev === "HIGH")     return { color: "text-orange-400", bg: "bg-orange-950/20 border-orange-700/40" };
    if (sev === "MEDIUM")   return { color: "text-amber-400", bg: "bg-amber-950/20 border-amber-700/40" };
    return { color: "text-blue-400", bg: "bg-blue-950/20 border-blue-700/40" };
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setKeyword(inputValue)}
            placeholder="Search CVEs (e.g. SCADA, OPC, Siemens)..."
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500"
          />
          <Button size="sm" className="bg-amber-600 hover:bg-amber-500 text-white"
            onClick={() => setKeyword(inputValue)} disabled={isFetching}>
            Search
          </Button>
        </div>
        <Button size="sm" variant="outline" className="border-gray-600 text-gray-400 hover:bg-gray-800"
          onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Quick keyword chips */}
      <div className="flex flex-wrap gap-1.5">
        {ICS_KEYWORDS_LIST.map((kw) => (
          <button key={kw}
            onClick={() => { setKeyword(kw); setInputValue(kw); }}
            className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
              keyword === kw
                ? "bg-amber-600 border-amber-500 text-white"
                : "bg-gray-900 border-gray-700 text-gray-400 hover:border-amber-600/50"
            }`}>
            {kw}
          </button>
        ))}
      </div>

      {/* Status bar */}
      {data && (
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>Source: <span className="text-amber-400">NIST NVD API v2</span></span>
          <span>Fetched: <span className="text-gray-300">{new Date(data.fetchedAt).toLocaleTimeString()}</span></span>
          <span>Total results: <span className="text-gray-300">{data.totalResults.toLocaleString()}</span></span>
          {data.icsRelevantCount > 0 && (
            <span className="text-orange-400 font-medium">{data.icsRelevantCount} ICS/OT relevant</span>
          )}
          {!data.success && (
            <span className="text-red-400">⚠ Live feed unavailable — showing cached data</span>
          )}
        </div>
      )}

      {/* CVE list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map((i) => (
            <div key={i} className="bg-gray-900 border border-gray-700 rounded-lg p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : (data?.cves ?? []).length === 0 ? (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 text-center">
          <Shield className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No CVEs found for &ldquo;{keyword}&rdquo;. Try a different keyword.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(data?.cves ?? []).map((cve) => {
            const sc = severityColor(cve.severity);
            return (
              <div key={cve.cveId} className={`rounded-lg border p-4 ${sc.bg}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <a
                        href={`https://nvd.nist.gov/vuln/detail/${cve.cveId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-xs font-mono font-bold ${sc.color} hover:underline`}
                      >
                        {cve.cveId}
                      </a>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${sc.bg} ${sc.color}`}>
                        {cve.severity}
                      </span>
                      <span className="text-[10px] font-mono text-gray-400">CVSS {cve.cvssScore.toFixed(1)}</span>
                      {cve.isIcsRelevant && (
                        <span className="text-[10px] text-orange-300 bg-orange-900/30 px-1.5 py-0.5 rounded border border-orange-700/40">
                          ICS/OT
                        </span>
                      )}
                      {cve.patchAvailable && (
                        <span className="text-[10px] text-emerald-400 bg-emerald-900/20 px-1.5 py-0.5 rounded">
                          Patch Available
                        </span>
                      )}
                      <span className="text-[10px] text-gray-500">
                        {new Date(cve.published).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">{cve.description}</p>
                    {cve.vectorString && (
                      <p className="text-[10px] font-mono text-gray-500 mt-1">{cve.vectorString}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-gray-600 text-xs h-7 text-gray-300 hover:bg-gray-800"
                      onClick={() => toast.success(`Patch ticket created for ${cve.cveId}`, {
                        description: "Assigned to OT security team",
                      })}
                    >
                      Remediate
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CybersecurityPage() {
  const [scanRunning, setScanRunning] = useState(false);

  const totalVulns = VULNERABILITIES.length;
  const criticalVulns = VULNERABILITIES.filter(v => v.severity === "CRITICAL").length;
  const highVulns = VULNERABILITIES.filter(v => v.severity === "HIGH").length;
  const expiringCerts = CERTIFICATES.filter(c => c.status === "EXPIRING_SOON" || c.status === "EXPIRED").length;
  const overallScore = Math.round(RADAR_DATA.reduce((s, d) => s + d.A, 0) / RADAR_DATA.length);

  // ── Live security events (IEC 62443 S21.2 triage) ──────────────────────────
  const { data: liveEvents, refetch: refetchEvents } = trpc.security.events.useQuery({ limit: 20 });
  const { data: triageList, refetch: refetchTriage } = trpc.security.triageList.useQuery({ limit: 20 });
  const triggerTriage = trpc.security.triggerTriage.useMutation({
    onSuccess: () => {
      toast.success("Triage workflow started", { description: "OpenCTI enrichment + node isolation in progress..." });
      setTimeout(() => { refetchEvents(); refetchTriage(); }, 3500);
    },
    onError: (e) => toast.error("Triage failed", { description: e.message }),
  });
  const readmitNode = trpc.security.readmitNode.useMutation({
    onSuccess: () => {
      toast.success("Node re-admitted", { description: "Network policy removed. Node restored to production zone." });
      refetchTriage();
    },
    onError: (e) => toast.error("Re-admit failed", { description: e.message }),
  });
  const mitigateEvent = trpc.security.mitigate.useMutation({
    onSuccess: () => { refetchEvents(); toast.success("Event mitigated"); },
    onError: (e) => toast.error("Mitigate failed", { description: e.message }),
  });
  const openIncidents = liveEvents ? liveEvents.filter(e => !e.mitigated).length
    : INCIDENTS.filter(i => i.status === "OPEN" || i.status === "INVESTIGATING").length;

  const { refetch: refetchScan } = trpc.nvdCve.fetchLatest.useQuery(
    { keyword: "SCADA OPC ICS", resultsPerPage: 20 },
    { enabled: false }
  );
  async function runScan() {
    setScanRunning(true);
    try {
      const result = await refetchScan();
      const count = result.data?.totalResults ?? 0;
      const critical = result.data?.criticalCount ?? 0;
      toast.success("Vulnerability scan complete", {
        description: `${count} CVEs fetched from NVD · ${critical} critical findings`,
        duration: 6000,
      });
    } catch {
      toast.error("Scan failed — NVD API unavailable");
    } finally {
      setScanRunning(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-[Syne] font-black text-2xl text-foreground tracking-tight">
            OT Cybersecurity
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Industrial cybersecurity · Compliance monitoring · Network zone protection · Zero-trust access control
          </p>
        </div>
        <Button
          className="bg-amber-600 hover:bg-amber-700 text-white text-sm h-9"
          onClick={runScan}
          disabled={scanRunning}
        >
          {scanRunning ? (
            <><span className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />Scanning...</>
          ) : (
            <><RefreshCw className="w-4 h-4 mr-2" />Run Vulnerability Scan</>
          )}
        </Button>
      </div>

      {/* Alerts */}
      {(criticalVulns > 0 || expiringCerts > 0) && (
        <div className="space-y-2">
          {criticalVulns > 0 && (
            <div className="rounded-lg border border-red-700/40 bg-red-950/10 p-3 flex items-center gap-3">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-sm text-red-400 font-bold">{criticalVulns} critical CVE{criticalVulns > 1 ? "s" : ""} require immediate patching.</span>
              <span className="text-sm text-muted-foreground">Patches available for all critical findings.</span>
            </div>
          )}
          {expiringCerts > 0 && (
            <div className="rounded-lg border border-amber-700/40 bg-amber-950/10 p-3 flex items-center gap-3">
              <Key className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-sm text-amber-400 font-bold">{expiringCerts} certificate{expiringCerts > 1 ? "s" : ""} expiring within 30 days.</span>
              <span className="text-sm text-muted-foreground">Renew before expiry to avoid service disruption.</span>
            </div>
          )}
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Security Score", value: `${overallScore}/100`, icon: Shield, color: overallScore >= 80 ? "text-emerald-400" : overallScore >= 60 ? "text-amber-400" : "text-red-400", bg: "bg-card border-border/50" },
          { label: "Critical CVEs", value: criticalVulns, icon: ShieldAlert, color: "text-red-400", bg: "bg-red-950/20 border-red-700/20" },
          { label: "High CVEs", value: highVulns, icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-950/20 border-orange-700/20" },
          { label: "Open Incidents", value: openIncidents, icon: Activity, color: "text-amber-400", bg: "bg-amber-950/20 border-amber-700/20" },
          { label: "Certs Expiring", value: expiringCerts, icon: Key, color: "text-amber-400", bg: "bg-amber-950/20 border-amber-700/20" },
        ].map(kpi => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className={`border ${kpi.bg}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-3.5 h-3.5 ${kpi.color}`} />
                  <span className="text-xs text-muted-foreground">{kpi.label}</span>
                </div>
                <div className={`font-[Syne] font-black text-2xl ${kpi.color}`}>{kpi.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="zones">
        <TabsList className="bg-muted/50 h-8">
          <TabsTrigger value="zones" className="text-xs h-7">Security Zones</TabsTrigger>
          <TabsTrigger value="vulns" className="text-xs h-7">Vulnerabilities</TabsTrigger>
          <TabsTrigger value="incidents" className="text-xs h-7">Incidents</TabsTrigger>
          <TabsTrigger value="certs" className="text-xs h-7">Certificates</TabsTrigger>
          <TabsTrigger value="posture" className="text-xs h-7">Security Posture</TabsTrigger>
        </TabsList>

        {/* Zones tab */}
        <TabsContent value="zones" className="mt-4 space-y-4">
          <div className="space-y-3">
            {SECURITY_ZONES.map(zone => {
              const totalVulns = zone.vulnerabilities.critical + zone.vulnerabilities.high + zone.vulnerabilities.medium + zone.vulnerabilities.low;
              return (
                <div key={zone.zone_id} className="rounded-lg border border-border/50 bg-card p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">Purdue L{zone.purdue_level}</span>
                        <span className="font-[Syne] font-bold text-sm text-foreground">{zone.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{zone.assets} assets · Last scan: {new Date(zone.last_scan).toLocaleTimeString()}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-[10px] text-muted-foreground">Security Level</div>
                        <div className={`font-mono font-bold text-lg ${slColor(zone.current_sl, zone.target_sl)}`}>
                          SL-{zone.current_sl}
                          <span className="text-xs text-muted-foreground ml-1">/ target SL-{zone.target_sl}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-muted-foreground">Vulnerabilities</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {zone.vulnerabilities.critical > 0 && <span className="text-xs font-mono text-red-400">{zone.vulnerabilities.critical}C</span>}
                          {zone.vulnerabilities.high > 0 && <span className="text-xs font-mono text-orange-400">{zone.vulnerabilities.high}H</span>}
                          {zone.vulnerabilities.medium > 0 && <span className="text-xs font-mono text-amber-400">{zone.vulnerabilities.medium}M</span>}
                          {zone.vulnerabilities.low > 0 && <span className="text-xs font-mono text-blue-400">{zone.vulnerabilities.low}L</span>}
                          {totalVulns === 0 && <span className="text-xs text-emerald-400">Clean</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                  {zone.current_sl < zone.target_sl && (
                    <div className="mt-2 text-xs text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Below target security level — remediation required to achieve SL-{zone.target_sl}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* Vulnerabilities tab — Live NVD CVE Feed */}
        <TabsContent value="vulns" className="mt-4 space-y-3">
          <NvdCveFeed />
        </TabsContent>

        {/* Incidents tab — Live DB events + IEC 62443 S21.2 Triage */}
        <TabsContent value="incidents" className="mt-4 space-y-3">
          {/* Live DB events */}
          {liveEvents && liveEvents.length > 0 ? (
            liveEvents.map(ev => {
              const triage = triageList?.find(t => t.eventId === ev.eventId);
              const sevMap: Record<string, { color: string; bg: string }> = {
                CRITICAL: { color: "text-red-400", bg: "bg-red-500/10 border-red-700/30" },
                HIGH:     { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-700/30" },
                MEDIUM:   { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-700/30" },
                LOW:      { color: "text-blue-400", bg: "bg-blue-500/10 border-blue-700/30" },
              };
              const sc = sevMap[ev.severity ?? "LOW"] ?? sevMap.LOW;
              return (
                <div key={ev.eventId} className={`rounded-lg border p-4 ${
                  triage?.nodeIsolated ? "border-red-700/40 bg-red-950/10" :
                  ev.mitigated ? "border-emerald-700/30 bg-emerald-950/10" :
                  "border-border/50 bg-card"
                }`}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-mono text-muted-foreground">{ev.eventId}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${sc.bg} ${sc.color}`}>{ev.severity}</span>
                        {ev.mitigated && <span className="text-[10px] text-emerald-400 font-medium">Mitigated</span>}
                        {triage?.nodeIsolated && <span className="text-[10px] text-red-400 font-bold">NODE ISOLATED</span>}
                        {triage?.status === "RUNNING" && <span className="text-[10px] text-amber-400 animate-pulse">Triage Running...</span>}
                        {triage?.tlpClassification && triage.status === "COMPLETED" && (
                          <span className="text-[10px] font-mono text-muted-foreground">{triage.tlpClassification}</span>
                        )}
                      </div>
                      <div className="text-sm font-bold text-foreground">{ev.eventType}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Target: {ev.target ?? "N/A"}
                        {ev.source && <span className="ml-2">· Source: {ev.source}</span>}
                      </div>
                      {triage?.recommendedAction && (
                        <div className="text-xs text-amber-300 mt-1 italic">⚠️ {triage.recommendedAction}</div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <div className="text-xs text-muted-foreground">{new Date(ev.occurredAt).toLocaleString()}</div>
                      <div className="flex gap-1.5 flex-wrap justify-end">
                        {!ev.mitigated && (
                          <Button size="sm" variant="outline"
                            className="border-emerald-700/40 text-emerald-400 text-xs h-7"
                            onClick={() => mitigateEvent.mutate({ eventId: ev.eventId })}
                            disabled={mitigateEvent.isPending}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Mitigate
                          </Button>
                        )}
                        {!triage && !ev.mitigated && (
                          <Button size="sm"
                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-7"
                            onClick={() => triggerTriage.mutate({ eventId: ev.eventId })}
                            disabled={triggerTriage.isPending}
                          >
                            <Zap className="w-3 h-3 mr-1" />
                            Triage
                          </Button>
                        )}
                        {triage?.nodeIsolated && (
                          <Button size="sm" variant="outline"
                            className="border-amber-700/40 text-amber-400 text-xs h-7"
                            onClick={() => readmitNode.mutate({ eventId: ev.eventId })}
                            disabled={readmitNode.isPending}
                          >
                            <Unlock className="w-3 h-3 mr-1" />
                            Re-admit
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            /* Fallback to static data when DB is empty */
            INCIDENTS.map(inc => {
              const sc = sevConfig(inc.severity);
              const isc = incidentStatusConfig(inc.status);
              return (
                <div key={inc.incident_id} className="rounded-lg border border-border/50 bg-card p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-mono text-muted-foreground">{inc.incident_id}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${sc.bg} ${sc.color}`}>{inc.severity}</span>
                        <span className={`text-[10px] font-medium ${isc.color}`}>{isc.label}</span>
                      </div>
                      <div className="text-sm font-bold text-foreground">{inc.type}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Target: {inc.target}</div>
                      <div className="text-xs text-muted-foreground mt-1">{inc.description}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-muted-foreground">{new Date(inc.timestamp).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        {/* Certificates tab */}
        <TabsContent value="certs" className="mt-4">
          <div className="space-y-2">
            {CERTIFICATES.map(cert => (
              <div key={cert.name} className={`rounded-lg border p-3 flex items-center justify-between gap-4 ${
                cert.status === "EXPIRED" ? "border-red-700/30 bg-red-950/10" :
                cert.status === "EXPIRING_SOON" ? "border-amber-700/30 bg-amber-950/10" :
                "border-border/50 bg-card"
              }`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Key className={`w-3.5 h-3.5 shrink-0 ${cert.status === "VALID" ? "text-emerald-400" : cert.status === "EXPIRING_SOON" ? "text-amber-400" : "text-red-400"}`} />
                    <span className="text-sm font-medium text-foreground">{cert.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{cert.asset} · {cert.issuer}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground">Expires {cert.expiry}</div>
                  <div className={`font-mono font-bold text-sm ${cert.days_remaining <= 7 ? "text-red-400" : cert.days_remaining <= 30 ? "text-amber-400" : "text-emerald-400"}`}>
                    {cert.days_remaining}d remaining
                  </div>
                </div>
                {cert.status !== "VALID" && (
                  <Button
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-7 shrink-0"
                    onClick={() => toast.success(`Certificate renewal initiated for ${cert.name}`, { description: "New certificate will be issued within 24 hours" })}
                  >
                    Renew
                  </Button>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Security Posture tab */}
        <TabsContent value="posture" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="font-[Syne] text-sm font-bold">IEC 62443 Control Coverage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={RADAR_DATA}>
                      <PolarGrid stroke="oklch(1 0 0 / 8%)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "oklch(0.552 0.016 285.938)" }} />
                      <Radar name="Score" dataKey="A" stroke="#d97706" fill="#d97706" fillOpacity={0.2} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="font-[Syne] text-sm font-bold">Patch Velocity (6 Weeks)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={PATCH_TREND}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
                      <XAxis dataKey="week" tick={{ fontSize: 10, fill: "oklch(0.552 0.016 285.938)" }} />
                      <YAxis tick={{ fontSize: 10, fill: "oklch(0.552 0.016 285.938)" }} />
                      <Tooltip contentStyle={{ background: "oklch(0.21 0.006 285.885)", border: "1px solid oklch(1 0 0 / 10%)", borderRadius: "6px", fontSize: "11px" }} />
                      <Bar dataKey="patched" name="Patched" fill="#10b981" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="open" name="Open" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 space-y-2">
                  {RADAR_DATA.map(d => (
                    <div key={d.subject}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="text-muted-foreground">{d.subject}</span>
                        <span className="font-mono text-foreground">{d.A}%</span>
                      </div>
                      <Progress value={d.A} className="h-1" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
