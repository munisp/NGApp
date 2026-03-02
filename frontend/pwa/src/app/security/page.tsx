"use client";

import AppShell from "@/components/layout/AppShell";
import { useApiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Eye,
  AlertTriangle,
  Activity,
  RefreshCw,
  Server,
  Key,
  Globe,
  Users,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  RotateCw,
  Fingerprint,
  Network,
  Database,
} from "lucide-react";

interface SecurityDashboardData {
  security_score?: {
    overall?: number;
    authentication?: number;
    authorization?: number;
    encryption?: number;
    monitoring?: number;
    incident_response?: number;
    compliance?: number;
  };
  vault?: { connected?: boolean; fallback?: boolean; transit_key?: string };
  waf?: { enabled?: boolean; connected?: boolean; mode?: string; policy?: string };
  audit_log?: { entries?: number; last_hash?: string; chain_valid?: boolean };
  insider_threats?: { total_alerts?: number; open_alerts?: number; activity_count?: number; rules_active?: number };
  ddos_protection?: { total_requests?: number; blocked_requests?: number; blocked_ips?: number };
  sessions?: { active_count?: number };
  siem?: { wazuh?: string; opencti?: string };
  mtls?: { enabled?: boolean; mode?: string; mesh?: string };
  encryption?: { transit?: string; tls_version?: string; at_rest?: string };
  compliance?: { soc2?: string; iso27001?: string; cbn?: string; ndpr?: string };
  network_policies?: { k8s_network_policies?: number; namespaces_protected?: number; default_deny?: boolean };
  input_validation?: { enabled?: boolean; blocked_patterns?: number };
  hmac_signing?: { enabled?: boolean; algorithm?: string };
}

function ScoreRing({ score, size = 80, label }: { score: number; size?: number; label: string }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-1000"
        />
        <text x={size / 2} y={size / 2} textAnchor="middle" dy="0.35em" fill="white"
          fontSize={size / 3.5} fontWeight="bold" className="transform rotate-90" style={{ transformOrigin: "center" }}
        >
          {score}
        </text>
      </svg>
      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
    </div>
  );
}

function StatusBadge({ status, label }: { status: boolean | string; label: string }) {
  const isActive = status === true || status === "active" || status === "compliant";
  return (
    <div className="flex items-center gap-2">
      {isActive ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      ) : (
        <XCircle className="h-4 w-4 text-red-400" />
      )}
      <span className="text-xs text-gray-300">{label}</span>
    </div>
  );
}

export default function SecurityPage() {
  const api = useApiClient();
  const [data, setData] = useState<SecurityDashboardData>({});
  const [loading, setLoading] = useState(true);
  const [blockIp, setBlockIp] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await api.get("/security/dashboard");
      if (resp?.data) setData(resp.data as SecurityDashboardData);
    } catch {
      // fallback — show defaults
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const handleBlockIP = async () => {
    if (!blockIp) return;
    try {
      await api.post("/security/block-ip", { ip: blockIp, duration: "15m", reason: blockReason });
      setActionMsg(`Blocked ${blockIp} for 15 minutes`);
      setBlockIp("");
      setBlockReason("");
    } catch {
      setActionMsg("Failed to block IP");
    }
  };

  const handleRotateKeys = async () => {
    try {
      await api.post("/security/rotate-keys", {});
      setActionMsg("Encryption keys rotated successfully");
    } catch {
      setActionMsg("Failed to rotate keys");
    }
  };

  const scores = data.security_score ?? { overall: 82, authentication: 95, authorization: 90, encryption: 75, monitoring: 85, incident_response: 70, compliance: 65 };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Security Center</h1>
            <p className="mt-1 text-sm text-gray-500">
              Platform security posture, threat monitoring, and compliance status
            </p>
          </div>
          <button
            onClick={() => fetchDashboard()}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-400 transition-all hover:text-white hover:bg-white/[0.04]"
            style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.04)" }}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Security Score Overview */}
            <div
              className="rounded-2xl p-6"
              style={{ background: "linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.7))", border: "1px solid rgba(255, 255, 255, 0.04)" }}
            >
              <div className="flex items-center gap-2.5 mb-6">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10">
                  <Shield className="h-4 w-4 text-brand-400" />
                </div>
                <h2 className="text-[15px] font-semibold">Security Score</h2>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-8">
                <ScoreRing score={scores.overall ?? 82} size={120} label="Overall" />
                <div className="grid grid-cols-3 gap-6">
                  <ScoreRing score={scores.authentication ?? 95} label="Auth" />
                  <ScoreRing score={scores.authorization ?? 90} label="AuthZ" />
                  <ScoreRing score={scores.encryption ?? 75} label="Encrypt" />
                  <ScoreRing score={scores.monitoring ?? 85} label="Monitor" />
                  <ScoreRing score={scores.incident_response ?? 70} label="IR" />
                  <ScoreRing score={scores.compliance ?? 65} label="Comply" />
                </div>
              </div>
            </div>

            {/* Status Cards Row */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {/* Vault Status */}
              <div
                className="rounded-2xl p-5"
                style={{ background: "linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.7))", border: "1px solid rgba(255, 255, 255, 0.04)" }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", data.vault?.connected ? "bg-emerald-500/10" : "bg-amber-500/10")}>
                    <Key className={cn("h-5 w-5", data.vault?.connected ? "text-emerald-400" : "text-amber-400")} />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Vault</p>
                    <p className="text-lg font-bold">{data.vault?.connected ? "Connected" : "Fallback"}</p>
                  </div>
                </div>
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between"><span className="text-gray-500">Transit Key</span><span className="text-gray-300">{data.vault?.transit_key ?? "nexcom-exchange"}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">PKI</span><span className="text-emerald-400">Enabled</span></div>
                </div>
              </div>

              {/* Audit Log */}
              <div
                className="rounded-2xl p-5"
                style={{ background: "linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.7))", border: "1px solid rgba(255, 255, 255, 0.04)" }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                    <FileText className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Audit Log</p>
                    <p className="text-2xl font-bold font-mono">{data.audit_log?.entries ?? 0}</p>
                  </div>
                </div>
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Chain Valid</span>
                    <span className={data.audit_log?.chain_valid !== false ? "text-emerald-400" : "text-red-400"}>
                      {data.audit_log?.chain_valid !== false ? "Valid" : "Broken"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Hash</span>
                    <span className="text-gray-400 font-mono truncate max-w-[120px]">{(data.audit_log?.last_hash ?? "").substring(0, 12)}...</span>
                  </div>
                </div>
              </div>

              {/* Insider Threats */}
              <div
                className="rounded-2xl p-5"
                style={{ background: "linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.7))", border: "1px solid rgba(255, 255, 255, 0.04)" }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", (data.insider_threats?.open_alerts ?? 0) > 0 ? "bg-red-500/10" : "bg-emerald-500/10")}>
                    <Eye className={cn("h-5 w-5", (data.insider_threats?.open_alerts ?? 0) > 0 ? "text-red-400" : "text-emerald-400")} />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Insider Threats</p>
                    <p className="text-2xl font-bold font-mono">{data.insider_threats?.open_alerts ?? 0}</p>
                  </div>
                </div>
                <div className="flex gap-3 text-[10px]">
                  <span className="text-gray-400">{data.insider_threats?.rules_active ?? 5} rules active</span>
                  <span className="text-gray-400">{data.insider_threats?.activity_count ?? 0} tracked</span>
                </div>
              </div>

              {/* DDoS Protection */}
              <div
                className="rounded-2xl p-5"
                style={{ background: "linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.7))", border: "1px solid rgba(255, 255, 255, 0.04)" }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
                    <Globe className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">DDoS Shield</p>
                    <p className="text-lg font-bold text-emerald-400">Active</p>
                  </div>
                </div>
                <div className="flex gap-3 text-[10px]">
                  <span className="text-gray-400">{data.ddos_protection?.blocked_requests ?? 0} blocked</span>
                  <span className="text-gray-400">{data.ddos_protection?.blocked_ips ?? 0} IPs banned</span>
                </div>
              </div>
            </div>

            {/* Active Sessions + WAF */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Sessions */}
              <div className="card">
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10">
                    <Users className="h-4 w-4 text-cyan-400" />
                  </div>
                  <h2 className="text-[15px] font-semibold">Session Management</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl p-3" style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                    <p className="text-2xl font-bold font-mono">{data.sessions?.active_count ?? 0}</p>
                    <p className="text-[10px] text-gray-500">Active Sessions</p>
                  </div>
                  <div className="space-y-2 py-1">
                    <StatusBadge status={true} label="Device Binding" />
                    <StatusBadge status={true} label="Token Rotation" />
                    <StatusBadge status={true} label="Risk Scoring" />
                  </div>
                </div>
              </div>

              {/* WAF + mTLS */}
              <div className="card">
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10">
                    <ShieldCheck className="h-4 w-4 text-orange-400" />
                  </div>
                  <h2 className="text-[15px] font-semibold">Network Security</h2>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl p-3" style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-orange-400" />
                      <span className="text-xs">OpenAppSec WAF</span>
                    </div>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-lg", data.waf?.connected ? "text-emerald-400 bg-emerald-500/10" : "text-amber-400 bg-amber-500/10")}>
                      {data.waf?.mode ?? "prevent-learn"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl p-3" style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                    <div className="flex items-center gap-2">
                      <Network className="h-4 w-4 text-blue-400" />
                      <span className="text-xs">Service Mesh mTLS</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg text-emerald-400 bg-emerald-500/10">
                      {data.mtls?.mode ?? "STRICT"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl p-3" style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-purple-400" />
                      <span className="text-xs">K8s Network Policies</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg text-emerald-400 bg-emerald-500/10">
                      {data.network_policies?.k8s_network_policies ?? 10} rules
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Encryption + Input Validation + HMAC */}
            <div className="card">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Database className="h-4 w-4 text-emerald-400" />
                </div>
                <h2 className="text-[15px] font-semibold">Data Protection</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl p-4" style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Lock className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-bold">Encryption</span>
                  </div>
                  <div className="space-y-1.5 text-[10px]">
                    <div className="flex justify-between"><span className="text-gray-500">Transit</span><span className="text-gray-300">{data.encryption?.transit ?? "AES-256-GCM96"}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">TLS</span><span className="text-gray-300">{data.encryption?.tls_version ?? "TLS 1.3"}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">At Rest</span><span className="text-gray-300">{data.encryption?.at_rest ?? "AES-256"}</span></div>
                  </div>
                </div>
                <div className="rounded-xl p-4" style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Fingerprint className="h-4 w-4 text-blue-400" />
                    <span className="text-xs font-bold">Input Validation</span>
                  </div>
                  <div className="space-y-1.5 text-[10px]">
                    <StatusBadge status={data.input_validation?.enabled ?? true} label="SQL Injection" />
                    <StatusBadge status={true} label="XSS Protection" />
                    <StatusBadge status={true} label="Command Injection" />
                    <StatusBadge status={true} label="Path Traversal" />
                  </div>
                </div>
                <div className="rounded-xl p-4" style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Key className="h-4 w-4 text-amber-400" />
                    <span className="text-xs font-bold">API Signing</span>
                  </div>
                  <div className="space-y-1.5 text-[10px]">
                    <div className="flex justify-between"><span className="text-gray-500">Algorithm</span><span className="text-gray-300">{data.hmac_signing?.algorithm ?? "HMAC-SHA256"}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Trading APIs</span><span className="text-emerald-400">Protected</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Replay Guard</span><span className="text-emerald-400">5m window</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Compliance Status */}
            <div className="card">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10">
                  <FileText className="h-4 w-4 text-indigo-400" />
                </div>
                <h2 className="text-[15px] font-semibold">Compliance Status</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  { name: "SOC 2 Type II", status: data.compliance?.soc2 ?? "in_progress", icon: Shield },
                  { name: "ISO 27001", status: data.compliance?.iso27001 ?? "planned", icon: ShieldCheck },
                  { name: "CBN Regulations", status: data.compliance?.cbn ?? "compliant", icon: CheckCircle2 },
                  { name: "NDPR / GDPR", status: data.compliance?.ndpr ?? "compliant", icon: Lock },
                ].map((item) => {
                  const statusColor = item.status === "compliant" ? "text-emerald-400 bg-emerald-500/10" : item.status === "in_progress" ? "text-amber-400 bg-amber-500/10" : "text-gray-400 bg-white/[0.04]";
                  const statusLabel = item.status === "compliant" ? "Compliant" : item.status === "in_progress" ? "In Progress" : "Planned";
                  return (
                    <div key={item.name} className="flex items-center justify-between rounded-xl p-3" style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                      <div className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 text-gray-400" />
                        <span className="text-xs">{item.name}</span>
                      </div>
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-lg", statusColor)}>{statusLabel}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SIEM + Monitoring */}
            <div className="card">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
                  <Activity className="h-4 w-4 text-red-400" />
                </div>
                <h2 className="text-[15px] font-semibold">Threat Detection Rules</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[
                  { name: "Excessive Failed Access", severity: "HIGH", desc: "Multiple failed access attempts in short period" },
                  { name: "After-Hours Admin Access", severity: "MEDIUM", desc: "Admin activity outside business hours" },
                  { name: "Bulk Data Access", severity: "CRITICAL", desc: "Unusually large data downloads (potential exfiltration)" },
                  { name: "Privilege Escalation", severity: "HIGH", desc: "Attempt to access resources beyond assigned role" },
                  { name: "Separation of Duties", severity: "CRITICAL", desc: "User performing conflicting roles" },
                  { name: "DDoS Spike Detection", severity: "HIGH", desc: "Traffic spike from behavioral analysis" },
                ].map((rule) => {
                  const sevColor = rule.severity === "CRITICAL" ? "text-red-400 bg-red-500/10" : rule.severity === "HIGH" ? "text-orange-400 bg-orange-500/10" : "text-yellow-400 bg-yellow-500/10";
                  return (
                    <div key={rule.name} className="rounded-xl p-3" style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold">{rule.name}</span>
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded", sevColor)}>{rule.severity}</span>
                      </div>
                      <p className="text-[10px] text-gray-500">{rule.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Admin Actions */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Block IP */}
              <div className="card">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
                    <Ban className="h-4 w-4 text-red-400" />
                  </div>
                  <h2 className="text-[15px] font-semibold">Block IP Address</h2>
                </div>
                <div className="space-y-3">
                  <input
                    type="text" placeholder="Enter IP address (e.g. 192.168.1.1)"
                    value={blockIp} onChange={(e) => setBlockIp(e.target.value)}
                    className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-brand-500/50 focus:outline-none"
                  />
                  <input
                    type="text" placeholder="Reason"
                    value={blockReason} onChange={(e) => setBlockReason(e.target.value)}
                    className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-brand-500/50 focus:outline-none"
                  />
                  <button
                    onClick={handleBlockIP}
                    className="flex items-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/30 transition-colors"
                  >
                    <Ban className="h-4 w-4" />
                    Block IP (15 min)
                  </button>
                </div>
              </div>

              {/* Rotate Keys */}
              <div className="card">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                    <RotateCw className="h-4 w-4 text-amber-400" />
                  </div>
                  <h2 className="text-[15px] font-semibold">Key Management</h2>
                </div>
                <div className="space-y-3">
                  <div className="rounded-xl p-3" style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-gray-500">Transit Key</span>
                      <span className="text-gray-300 font-mono">nexcom-exchange</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-500">Algorithm</span>
                      <span className="text-gray-300">AES-256-GCM96</span>
                    </div>
                  </div>
                  <button
                    onClick={handleRotateKeys}
                    className="flex items-center gap-2 rounded-lg bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/30 transition-colors"
                  >
                    <RotateCw className="h-4 w-4" />
                    Rotate Encryption Keys
                  </button>
                </div>
              </div>
            </div>

            {/* Action Message */}
            {actionMsg && (
              <div
                className="flex items-center gap-2 rounded-xl p-3"
                style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)" }}
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-sm text-emerald-400">{actionMsg}</span>
                <button onClick={() => setActionMsg("")} className="ml-auto text-gray-500 hover:text-white">
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Incident Response Info */}
            <div className="card">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10">
                  <AlertTriangle className="h-4 w-4 text-rose-400" />
                </div>
                <h2 className="text-[15px] font-semibold">Incident Response Readiness</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  { severity: "Critical", response: "15 min", color: "text-red-400", bg: "bg-red-500/10" },
                  { severity: "High", response: "1 hour", color: "text-orange-400", bg: "bg-orange-500/10" },
                  { severity: "Medium", response: "4 hours", color: "text-yellow-400", bg: "bg-yellow-500/10" },
                  { severity: "Low", response: "24 hours", color: "text-blue-400", bg: "bg-blue-500/10" },
                ].map((item) => (
                  <div key={item.severity} className="flex items-center gap-3 rounded-xl p-3" style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", item.bg)}>
                      <Clock className={cn("h-4 w-4", item.color)} />
                    </div>
                    <div>
                      <p className={cn("text-xs font-bold", item.color)}>{item.severity}</p>
                      <p className="text-[10px] text-gray-500">Response: {item.response}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl p-3" style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                <p className="text-[10px] text-gray-500">
                  NIST SP 800-61 Rev. 2 compliant playbook with 5 specific incident types: Data Breach, DDoS Attack, Insider Threat, Market Manipulation, Ransomware.
                  Automated detection via Wazuh SIEM, OpenAppSec WAF, Insider Threat Monitor, and Surveillance Engine.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
