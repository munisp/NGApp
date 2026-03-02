"use client";

import AppShell from "@/components/layout/AppShell";
import {
  useSurveillanceAlerts,
  useCircuitBreakerStatus,
  useInvestorProtection,
  useMarketDataInfra,
} from "@/lib/api-hooks";
import { cn } from "@/lib/utils";
import {
  Shield,
  AlertTriangle,
  Activity,
  Eye,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Zap,
  TrendingDown,
  Users,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Radio,
  Lock,
  Banknote,
} from "lucide-react";

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; icon: typeof AlertTriangle }> = {
  CRITICAL: { color: "text-red-400", bg: "bg-red-500/10", icon: XCircle },
  HIGH: { color: "text-orange-400", bg: "bg-orange-500/10", icon: AlertTriangle },
  MEDIUM: { color: "text-yellow-400", bg: "bg-yellow-500/10", icon: Activity },
  LOW: { color: "text-blue-400", bg: "bg-blue-500/10", icon: Eye },
};

const ALERT_TYPE_LABELS: Record<string, string> = {
  Spoofing: "Spoofing",
  WashTrading: "Wash Trading",
  UnusualVolume: "Unusual Volume",
  ExcessiveOrderRatio: "Excessive Order Ratio",
  ConcentrationRisk: "Concentration Risk",
  CrossMarketManipulation: "Cross-Market Manipulation",
  CircuitBreaker: "Circuit Breaker",
  VolatilityInterruption: "Volatility Interruption",
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function SurveillancePage() {
  const { alerts, loading: alertsLoading, refetch } = useSurveillanceAlerts();
  const { status: cbStatus, loading: cbLoading } = useCircuitBreakerStatus();
  const { fund, loading: fundLoading } = useInvestorProtection();
  const { stats: mdStats, loading: mdLoading } = useMarketDataInfra();

  const unresolvedAlerts = alerts.filter((a) => !a.resolved);
  const criticalCount = unresolvedAlerts.filter((a) => String(a.severity) === "CRITICAL").length;
  const highCount = unresolvedAlerts.filter((a) => String(a.severity) === "HIGH").length;
  const isMarketHalted = cbStatus?.market_halted === true;

  const isLoading = alertsLoading || cbLoading || fundLoading || mdLoading;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Market Surveillance</h1>
            <p className="mt-1 text-sm text-gray-500">
              Real-time market monitoring, circuit breakers, and investor protection
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-400 transition-all hover:text-white hover:bg-white/[0.04]"
            style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.04)" }}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {/* Market Status Banner */}
        {isMarketHalted && (
          <div
            className="flex items-center gap-3 rounded-2xl p-4"
            style={{ background: "linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(15, 23, 42, 0.9))", border: "1px solid rgba(239, 68, 68, 0.3)" }}
          >
            <ShieldAlert className="h-6 w-6 text-red-400 animate-pulse" />
            <div>
              <p className="text-sm font-bold text-red-400">MARKET HALTED</p>
              <p className="text-xs text-gray-400">Circuit breaker triggered. Trading suspended.</p>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {/* Active Alerts */}
              <div
                className="rounded-2xl p-5"
                style={{ background: "linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.7))", border: "1px solid rgba(255, 255, 255, 0.04)" }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Active Alerts</p>
                    <p className="text-2xl font-bold font-mono">{unresolvedAlerts.length}</p>
                  </div>
                </div>
                <div className="flex gap-3 text-[10px]">
                  <span className="text-red-400 font-bold">{criticalCount} Critical</span>
                  <span className="text-orange-400 font-bold">{highCount} High</span>
                </div>
              </div>

              {/* Circuit Breaker Status */}
              <div
                className="rounded-2xl p-5"
                style={{ background: "linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.7))", border: "1px solid rgba(255, 255, 255, 0.04)" }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", isMarketHalted ? "bg-red-500/10" : "bg-emerald-500/10")}>
                    <Zap className={cn("h-5 w-5", isMarketHalted ? "text-red-400" : "text-emerald-400")} />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Circuit Breakers</p>
                    <p className="text-2xl font-bold font-mono">{String(cbStatus?.current_level ?? "NONE")}</p>
                  </div>
                </div>
                <div className="flex gap-3 text-[10px]">
                  <span className="text-gray-400">{String(cbStatus?.luld_bands_active ?? 12)} LULD bands</span>
                  <span className="text-gray-400">{String(cbStatus?.volatility_interruptions_today ?? 0)} interruptions</span>
                </div>
              </div>

              {/* Investor Protection Fund */}
              <div
                className="rounded-2xl p-5"
                style={{ background: "linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.7))", border: "1px solid rgba(255, 255, 255, 0.04)" }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                    <ShieldCheck className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Protection Fund</p>
                    <p className="text-2xl font-bold font-mono">
                      {Number(fund?.total_fund ?? 0).toLocaleString(undefined, { style: "currency", currency: "USD", notation: "compact" })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 text-[10px]">
                  <span className="text-gray-400">{String((fund?.claims as Record<string, unknown>)?.pending ?? 0)} pending claims</span>
                  <span className="text-gray-400">${Number(fund?.coverage_limit_per_account ?? 500000).toLocaleString()} max</span>
                </div>
              </div>

              {/* Market Data Infrastructure */}
              <div
                className="rounded-2xl p-5"
                style={{ background: "linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.7))", border: "1px solid rgba(255, 255, 255, 0.04)" }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
                    <Radio className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Market Data</p>
                    <p className="text-2xl font-bold font-mono">{String(mdStats?.nbbo_symbols ?? 12)}</p>
                  </div>
                </div>
                <div className="flex gap-3 text-[10px]">
                  <span className="text-gray-400">{String(mdStats?.tape_entries ?? 0)} tape entries</span>
                  <span className="text-gray-400">{String(mdStats?.vwap_calculations ?? 12)} VWAP</span>
                </div>
              </div>
            </div>

            {/* Circuit Breaker Thresholds */}
            <div className="card">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                  <Zap className="h-4 w-4 text-amber-400" />
                </div>
                <h2 className="text-[15px] font-semibold">Market-Wide Circuit Breaker Thresholds</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { level: "Level 1", threshold: `${cbStatus?.level1_threshold ?? -7}%`, action: "15-min halt", color: "text-yellow-400", bg: "bg-yellow-500/10" },
                  { level: "Level 2", threshold: `${cbStatus?.level2_threshold ?? -13}%`, action: "15-min halt", color: "text-orange-400", bg: "bg-orange-500/10" },
                  { level: "Level 3", threshold: `${cbStatus?.level3_threshold ?? -20}%`, action: "Market close", color: "text-red-400", bg: "bg-red-500/10" },
                ].map((item) => (
                  <div
                    key={item.level}
                    className="rounded-xl p-4"
                    style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", item.bg)}>
                        <TrendingDown className={cn("h-3.5 w-3.5", item.color)} />
                      </div>
                      <span className="text-sm font-bold">{item.level}</span>
                    </div>
                    <p className={cn("text-2xl font-bold font-mono", item.color)}>{item.threshold}</p>
                    <p className="text-[10px] text-gray-500 mt-1">{item.action}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Detection Patterns */}
            <div className="card">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10">
                  <Eye className="h-4 w-4 text-brand-400" />
                </div>
                <h2 className="text-[15px] font-semibold">Active Detection Patterns</h2>
                <span className="badge-neutral text-[10px]">7</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  { name: "Spoofing", desc: "High cancel-to-trade ratio detection", icon: Shield, color: "text-red-400", bg: "bg-red-500/10" },
                  { name: "Layering", desc: "Multi-level order stacking detection", icon: BarChart3, color: "text-orange-400", bg: "bg-orange-500/10" },
                  { name: "Wash Trading", desc: "Self-trading and circular patterns", icon: Users, color: "text-yellow-400", bg: "bg-yellow-500/10" },
                  { name: "Front Running", desc: "Pre-positioned trades before large orders", icon: Zap, color: "text-purple-400", bg: "bg-purple-500/10" },
                  { name: "Unusual Volume", desc: "Volume spike anomaly detection", icon: Activity, color: "text-blue-400", bg: "bg-blue-500/10" },
                  { name: "Order Ratio", desc: "Excessive order-to-trade ratio", icon: Clock, color: "text-cyan-400", bg: "bg-cyan-500/10" },
                  { name: "Concentration", desc: "Position concentration risk monitoring", icon: Lock, color: "text-emerald-400", bg: "bg-emerald-500/10" },
                ].map((pattern) => (
                  <div
                    key={pattern.name}
                    className="flex items-center gap-3 rounded-xl p-3"
                    style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}
                  >
                    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", pattern.bg)}>
                      <pattern.icon className={cn("h-4 w-4", pattern.color)} />
                    </div>
                    <div>
                      <p className="text-xs font-bold">{pattern.name}</p>
                      <p className="text-[10px] text-gray-500">{pattern.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alerts Table */}
            <div className="card">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                </div>
                <h2 className="text-[15px] font-semibold">Surveillance Alerts</h2>
                <span className="badge-neutral text-[10px]">{alerts.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="table-header">Severity</th>
                      <th className="table-header">Type</th>
                      <th className="table-header">Account</th>
                      <th className="table-header">Symbol</th>
                      <th className="table-header">Description</th>
                      <th className="table-header text-right">Time</th>
                      <th className="table-header text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-sm text-gray-500">
                          <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-emerald-400/30" />
                          No alerts detected. Market activity is normal.
                        </td>
                      </tr>
                    ) : (
                      alerts.map((alert, i) => {
                        const severity = String(alert.severity ?? "MEDIUM");
                        const config = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.MEDIUM;
                        const SevIcon = config.icon;
                        const resolved = alert.resolved === true;

                        return (
                          <tr key={String(alert.id ?? i)} className="table-row">
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <div className={cn("flex h-6 w-6 items-center justify-center rounded-md", config.bg)}>
                                  <SevIcon className={cn("h-3.5 w-3.5", config.color)} />
                                </div>
                                <span className={cn("text-[10px] font-bold uppercase", config.color)}>{severity}</span>
                              </div>
                            </td>
                            <td className="py-3">
                              <span className="rounded-lg px-2 py-0.5 text-[10px] font-bold bg-white/[0.04]">
                                {ALERT_TYPE_LABELS[String(alert.alert_type)] ?? String(alert.alert_type)}
                              </span>
                            </td>
                            <td className="py-3 font-mono text-[12px] text-gray-300">{String(alert.account_id)}</td>
                            <td className="py-3 font-mono text-[12px] text-gray-300">{String(alert.symbol || "---")}</td>
                            <td className="py-3 text-[12px] text-gray-400 max-w-xs truncate">{String(alert.description)}</td>
                            <td className="py-3 text-right text-[11px] text-gray-500">
                              {alert.timestamp ? timeAgo(String(alert.timestamp)) : "---"}
                            </td>
                            <td className="py-3 text-right">
                              {resolved ? (
                                <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-400">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Resolved
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold bg-red-500/10 text-red-400">
                                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                  Active
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Investor Protection Fund Details */}
            <div className="card">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                  <Banknote className="h-4 w-4 text-blue-400" />
                </div>
                <h2 className="text-[15px] font-semibold">Investor Protection Fund</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                {[
                  { label: "Total Fund", value: `$${Number(fund?.total_fund ?? 0).toLocaleString()}`, color: "text-emerald-400" },
                  { label: "Coverage Limit", value: `$${Number(fund?.coverage_limit_per_account ?? 500000).toLocaleString()}`, color: "text-blue-400" },
                  { label: "Total Disbursed", value: `$${Number(fund?.total_disbursed ?? 0).toLocaleString()}`, color: "text-amber-400" },
                  { label: "Contributing Members", value: String(fund?.contributing_members ?? 1), color: "text-purple-400" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl p-4"
                    style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}
                  >
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">{item.label}</p>
                    <p className={cn("text-xl font-bold font-mono mt-1", item.color)}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
