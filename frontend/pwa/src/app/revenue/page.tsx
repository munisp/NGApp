"use client";

import AppShell from "@/components/layout/AppShell";
import {
  useFeeStatus,
  useFeeSchedules,
  useFeeApiTiers,
  useFeeRevenue,
  useFeeMemberships,
  useFeeSubscriptions,
} from "@/lib/api-hooks";
import { cn } from "@/lib/utils";
import {
  DollarSign,
  TrendingUp,
  Users,
  CreditCard,
  RefreshCw,
  Layers,
  Zap,
  BarChart3,
  CheckCircle2,
  ArrowUpRight,
  Receipt,
  Wifi,
  Server,
  Shield,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

type TabId = "overview" | "schedules" | "subscriptions" | "memberships" | "api-tiers";

const TABS: { id: TabId; label: string; icon: typeof DollarSign }[] = [
  { id: "overview", label: "Revenue Overview", icon: TrendingUp },
  { id: "schedules", label: "Fee Schedules", icon: Layers },
  { id: "subscriptions", label: "Subscriptions", icon: Wifi },
  { id: "memberships", label: "Memberships", icon: Users },
  { id: "api-tiers", label: "API Tiers", icon: Zap },
];

const MEMBERSHIP_LABELS: Record<string, string> = {
  BrokerDealerMembership: "Broker / Dealer",
  MarketMakerRegistration: "Market Maker",
  TradingSeatLicense: "Trading Seat",
  KycProcessingFee: "KYC Processing",
};

function fmt(n: number | undefined | null, decimals = 0): string {
  if (n == null) return "0";
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtCurrency(n: number | undefined | null): string {
  if (n == null) return "\u20A60";
  return "\u20A6" + fmt(n, 2);
}

export default function RevenuePage() {
  const { status, loading: statusLoading, refetch: refetchStatus } = useFeeStatus();
  const { revenue, loading: revLoading, refetch: refetchRevenue } = useFeeRevenue();
  const { schedules, loading: schedLoading } = useFeeSchedules();
  const { tiers, loading: tiersLoading } = useFeeApiTiers();
  const { memberships, loading: memLoading } = useFeeMemberships();
  const { subscriptions, loading: subLoading } = useFeeSubscriptions();

  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const isLoading = statusLoading || revLoading || schedLoading || tiersLoading || memLoading || subLoading;

  const handleRefresh = () => {
    refetchStatus();
    refetchRevenue();
  };

  const revenueByCategory = (revenue?.revenue_by_category ?? []) as Record<string, unknown>[];

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Revenue & Billing</h1>
            <p className="mt-1 text-sm text-gray-500">
              Fee engine, subscriptions, memberships, and revenue analytics
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-400 transition-all hover:text-white hover:bg-white/[0.04]"
            style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.04)" }}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {/* Net Revenue */}
              <div
                className="rounded-2xl p-5"
                style={{ background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(15, 23, 42, 0.7))", border: "1px solid rgba(16, 185, 129, 0.15)" }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                    <DollarSign className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Net Revenue</p>
                    <p className="text-2xl font-bold font-mono text-emerald-400">
                      {fmtCurrency(Number(revenue?.net_revenue ?? 0))}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 text-[10px]">
                  <span className="text-gray-400">{fmt(Number(revenue?.total_charges ?? 0))} charges</span>
                  <span className="text-red-400">{fmtCurrency(Number(revenue?.total_rebates ?? 0))} rebates</span>
                </div>
              </div>

              {/* MRR */}
              <div
                className="rounded-2xl p-5"
                style={{ background: "linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.7))", border: "1px solid rgba(255, 255, 255, 0.04)" }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                    <TrendingUp className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Monthly Recurring</p>
                    <p className="text-2xl font-bold font-mono">
                      {fmtCurrency(Number(revenue?.monthly_recurring_revenue ?? 0))}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 text-[10px]">
                  <span className="text-gray-400">{String(revenue?.active_subscriptions ?? 0)} active subscriptions</span>
                </div>
              </div>

              {/* ARR */}
              <div
                className="rounded-2xl p-5"
                style={{ background: "linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.7))", border: "1px solid rgba(255, 255, 255, 0.04)" }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
                    <BarChart3 className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Annual Recurring</p>
                    <p className="text-2xl font-bold font-mono">
                      {fmtCurrency(Number(revenue?.annual_recurring_revenue ?? 0))}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 text-[10px]">
                  <span className="text-gray-400">{String(revenue?.active_memberships ?? 0)} active memberships</span>
                </div>
              </div>

              {/* Fee Engine Status */}
              <div
                className="rounded-2xl p-5"
                style={{ background: "linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.7))", border: "1px solid rgba(255, 255, 255, 0.04)" }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                    <Receipt className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Fee Engine</p>
                    <p className="text-2xl font-bold font-mono">{String(status?.fee_schedules ?? 0)} Schedules</p>
                  </div>
                </div>
                <div className="flex gap-3 text-[10px]">
                  <span className="text-gray-400">{String(status?.api_tiers ?? 0)} API tiers</span>
                  <span className="text-gray-400">{String(status?.invoices_issued ?? 0)} invoices</span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-xl p-1" style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                      isActive
                        ? "bg-brand-500/10 text-brand-400 border border-brand-500/20"
                        : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03] border border-transparent"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden md:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Revenue Streams */}
                <div className="card">
                  <div className="flex items-center gap-2.5 mb-5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                      <DollarSign className="h-4 w-4 text-emerald-400" />
                    </div>
                    <h2 className="text-[15px] font-semibold">10 Revenue Streams</h2>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    {[
                      { name: "Transaction Fees", desc: "Maker-taker model with volume tiers", icon: ArrowUpRight, color: "text-emerald-400", bg: "bg-emerald-500/10" },
                      { name: "Listing Fees", desc: "New instrument listing & annual maintenance", icon: Receipt, color: "text-blue-400", bg: "bg-blue-500/10" },
                      { name: "Market Data", desc: "Level 1/2 subscriptions & consolidated tape", icon: Wifi, color: "text-purple-400", bg: "bg-purple-500/10" },
                      { name: "Clearing Fees", desc: "Per-trade clearing, margin interest, netting", icon: Shield, color: "text-cyan-400", bg: "bg-cyan-500/10" },
                      { name: "Technology", desc: "Co-location, FIX gateway, API tiers, DMA", icon: Server, color: "text-orange-400", bg: "bg-orange-500/10" },
                      { name: "Membership", desc: "Broker/dealer, market maker, trading seat", icon: Users, color: "text-yellow-400", bg: "bg-yellow-500/10" },
                      { name: "Tokenization", desc: "Minting, fractional trading, IPFS storage", icon: Layers, color: "text-pink-400", bg: "bg-pink-500/10" },
                      { name: "Investor Protection", desc: "Mandatory member contributions & interest", icon: Shield, color: "text-indigo-400", bg: "bg-indigo-500/10" },
                      { name: "Value-Added", desc: "Surveillance-as-a-service, index licensing", icon: Zap, color: "text-amber-400", bg: "bg-amber-500/10" },
                      { name: "Analytics", desc: "Premium dashboards, AI forecasting, reports", icon: BarChart3, color: "text-teal-400", bg: "bg-teal-500/10" },
                    ].map((stream) => (
                      <div
                        key={stream.name}
                        className="flex items-start gap-3 rounded-xl p-3"
                        style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}
                      >
                        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", stream.bg)}>
                          <stream.icon className={cn("h-4 w-4", stream.color)} />
                        </div>
                        <div>
                          <p className="text-xs font-bold">{stream.name}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{stream.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Revenue by Category */}
                {revenueByCategory.length > 0 && (
                  <div className="card">
                    <div className="flex items-center gap-2.5 mb-5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10">
                        <BarChart3 className="h-4 w-4 text-brand-400" />
                      </div>
                      <h2 className="text-[15px] font-semibold">Revenue by Category</h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left">
                            <th className="table-header">Category</th>
                            <th className="table-header text-right">Charges</th>
                            <th className="table-header text-right">Gross Revenue</th>
                            <th className="table-header text-right">Rebates</th>
                            <th className="table-header text-right">Net Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {revenueByCategory.map((cat, i) => (
                            <tr key={i} className="table-row">
                              <td className="py-3 font-medium">{String(cat.category ?? "")}</td>
                              <td className="py-3 text-right font-mono text-xs">{String(cat.charge_count ?? 0)}</td>
                              <td className="py-3 text-right font-mono text-xs text-emerald-400">{fmtCurrency(Number(cat.gross_revenue ?? 0))}</td>
                              <td className="py-3 text-right font-mono text-xs text-red-400">{fmtCurrency(Number(cat.rebates ?? 0))}</td>
                              <td className="py-3 text-right font-mono text-xs font-bold">{fmtCurrency(Number(cat.net_revenue ?? 0))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "schedules" && (
              <div className="space-y-6">
                {schedules.map((schedule, si) => {
                  const tiers = (schedule.tiers ?? []) as Record<string, unknown>[];
                  return (
                    <div key={si} className="card">
                      <div className="flex items-center gap-2.5 mb-5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                          <Layers className="h-4 w-4 text-blue-400" />
                        </div>
                        <div>
                          <h2 className="text-[15px] font-semibold">{String(schedule.name)}</h2>
                          <p className="text-[10px] text-gray-500">{String(schedule.description)}</p>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left">
                              <th className="table-header">Tier</th>
                              <th className="table-header text-right">Min Monthly Volume</th>
                              <th className="table-header text-right">Taker Fee (bps)</th>
                              <th className="table-header text-right">Maker Rebate (bps)</th>
                              <th className="table-header text-right">Clearing Fee (bps)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tiers.map((tier, ti) => (
                              <tr key={ti} className="table-row">
                                <td className="py-3">
                                  <span className="rounded-lg px-2 py-0.5 text-[10px] font-bold bg-white/[0.04]">
                                    {String(tier.tier_name)}
                                  </span>
                                </td>
                                <td className="py-3 text-right font-mono text-xs">{fmt(Number(tier.min_monthly_volume ?? 0))}</td>
                                <td className="py-3 text-right font-mono text-xs text-red-400">{Number(tier.taker_fee_bps ?? 0).toFixed(1)}</td>
                                <td className="py-3 text-right font-mono text-xs text-emerald-400">{Number(tier.maker_fee_bps ?? 0).toFixed(1)}</td>
                                <td className="py-3 text-right font-mono text-xs text-yellow-400">{Number(tier.clearing_fee_bps ?? 0).toFixed(1)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === "subscriptions" && (
              <div className="card">
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                    <Wifi className="h-4 w-4 text-purple-400" />
                  </div>
                  <h2 className="text-[15px] font-semibold">Active Subscriptions</h2>
                  <span className="badge-neutral text-[10px]">{subscriptions.length}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left">
                        <th className="table-header">Service</th>
                        <th className="table-header text-right">Amount</th>
                        <th className="table-header text-right">Billing Cycle</th>
                        <th className="table-header text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriptions.map((sub, i) => (
                        <tr key={i} className="table-row">
                          <td className="py-3 font-medium">{String(sub.service_name)}</td>
                          <td className="py-3 text-right font-mono text-xs">{fmtCurrency(Number(sub.amount_per_cycle ?? 0))}</td>
                          <td className="py-3 text-right">
                            <span className="rounded-lg px-2 py-0.5 text-[10px] font-bold bg-white/[0.04]">
                              {String(sub.billing_cycle)}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <span className={cn(
                              "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold",
                              String(sub.status) === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400" : "bg-gray-500/10 text-gray-400"
                            )}>
                              <CheckCircle2 className="h-3 w-3" />
                              {String(sub.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "memberships" && (
              <div className="card">
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-500/10">
                    <Users className="h-4 w-4 text-yellow-400" />
                  </div>
                  <h2 className="text-[15px] font-semibold">Active Memberships</h2>
                  <span className="badge-neutral text-[10px]">{memberships.length}</span>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  {memberships.map((mem, i) => (
                    <div
                      key={i}
                      className="rounded-xl p-5"
                      style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-500/10">
                          <CreditCard className="h-5 w-5 text-yellow-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">{MEMBERSHIP_LABELS[String(mem.membership_type)] ?? String(mem.membership_type)}</p>
                          <p className="text-[10px] text-gray-500">{String(mem.tier)} Tier</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Account</span>
                          <span className="font-mono">{String(mem.account_id)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Annual Fee</span>
                          <span className="font-mono font-bold text-emerald-400">{fmtCurrency(Number(mem.annual_fee ?? 0))}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Status</span>
                          <span className={cn(
                            "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold",
                            String(mem.status) === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400" : "bg-gray-500/10 text-gray-400"
                          )}>
                            <CheckCircle2 className="h-3 w-3" />
                            {String(mem.status)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "api-tiers" && (
              <div className="card">
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10">
                    <Zap className="h-4 w-4 text-orange-400" />
                  </div>
                  <h2 className="text-[15px] font-semibold">API Access Tiers</h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {tiers.map((tier, i) => {
                    const features = (tier.features ?? []) as string[];
                    const isPopular = String(tier.name) === "Professional";
                    return (
                      <div
                        key={i}
                        className={cn("rounded-xl p-5 relative", isPopular && "ring-1 ring-brand-500/30")}
                        style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}
                      >
                        {isPopular && (
                          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-brand-500/20 px-3 py-0.5 text-[10px] font-bold text-brand-400">
                            Most Popular
                          </div>
                        )}
                        <div className="text-center mb-4">
                          <p className="text-lg font-bold">{String(tier.name)}</p>
                          <p className="text-2xl font-bold font-mono mt-1">
                            {Number(tier.monthly_fee) === 0 ? "Free" : fmtCurrency(Number(tier.monthly_fee))}
                          </p>
                          <p className="text-[10px] text-gray-500">per month</p>
                        </div>
                        <div className="space-y-1 mb-4">
                          <div className="flex items-center justify-between text-xs px-2 py-1 rounded-lg bg-white/[0.02]">
                            <span className="text-gray-500">Rate Limit</span>
                            <span className="font-mono font-bold">{fmt(Number(tier.requests_per_second))} req/s</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {features.map((feat, fi) => (
                            <div key={fi} className="flex items-start gap-2 text-[11px]">
                              <ChevronRight className="h-3 w-3 text-brand-400 mt-0.5 shrink-0" />
                              <span className="text-gray-400">{feat}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
