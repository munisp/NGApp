"use client";

import AppShell from "@/components/layout/AppShell";
import { useMarketStore, useTradingStore } from "@/lib/store";
import { useMarkets, useOrders, useTrades, usePortfolio } from "@/lib/api-hooks";
import { formatCurrency, formatPercent, formatVolume, getPriceColorClass, getCategoryIcon, formatPrice, cn } from "@/lib/utils";
import Link from "next/link";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  PiggyBank,
  ShieldCheck,
  ChevronRight,
  Activity,
  Layers,
} from "lucide-react";

export default function DashboardPage() {
  const { commodities } = useMarkets();
  const { portfolio, positions } = usePortfolio();
  const { orders } = useOrders();
  const { trades } = useTrades();

  const marginPct = (portfolio.marginUsed / (portfolio.marginUsed + portfolio.marginAvailable)) * 100;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">NEXCOM Exchange Overview</p>
          </div>
          <Link href="/trade" className="btn-primary flex items-center gap-2 text-xs">
            <Activity className="h-3.5 w-3.5" />
            Start Trading
          </Link>
        </div>

        {/* Portfolio Summary Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SummaryCard
            icon={Wallet}
            iconColor="text-brand-400"
            iconBg="bg-brand-500/10"
            label="Portfolio Value"
            value={formatCurrency(portfolio.totalValue)}
            change={formatPercent(portfolio.totalPnlPercent)}
            positive={portfolio.totalPnlPercent >= 0}
          />
          <SummaryCard
            icon={PiggyBank}
            iconColor="text-blue-400"
            iconBg="bg-blue-500/10"
            label="Available Balance"
            value={formatCurrency(portfolio.availableBalance)}
          />
          <SummaryCard
            icon={portfolio.totalPnl >= 0 ? TrendingUp : TrendingDown}
            iconColor={portfolio.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}
            iconBg={portfolio.totalPnl >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}
            label="Unrealized P&L"
            value={formatCurrency(portfolio.totalPnl)}
            change={formatPercent(portfolio.totalPnlPercent)}
            positive={portfolio.totalPnl >= 0}
          />
          <SummaryCard
            icon={ShieldCheck}
            iconColor="text-amber-400"
            iconBg="bg-amber-500/10"
            label="Margin Used"
            value={formatCurrency(portfolio.marginUsed)}
            subtitle={`${marginPct.toFixed(1)}% utilized`}
            progress={marginPct}
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {/* Positions */}
          <div className="card lg:col-span-2">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10">
                  <Layers className="h-4 w-4 text-brand-400" />
                </div>
                <h2 className="text-[15px] font-semibold">Open Positions</h2>
                <span className="badge-neutral text-[10px]">{positions.length}</span>
              </div>
              <Link href="/portfolio" className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-brand-400 transition-colors">
                View all <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="table-header">Symbol</th>
                    <th className="table-header">Side</th>
                    <th className="table-header text-right">Qty</th>
                    <th className="table-header text-right">Entry</th>
                    <th className="table-header text-right">Current</th>
                    <th className="table-header text-right">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos) => (
                    <tr key={pos.symbol} className="table-row">
                      <td className="py-3 font-semibold text-[13px]">{pos.symbol}</td>
                      <td className="py-3">
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold",
                          pos.side === "BUY"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-red-500/10 text-red-400"
                        )}>
                          {pos.side === "BUY" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {pos.side === "BUY" ? "LONG" : "SHORT"}
                        </span>
                      </td>
                      <td className="py-3 text-right font-mono text-[13px] text-gray-300">{pos.quantity}</td>
                      <td className="py-3 text-right font-mono text-[13px] text-gray-500">
                        {formatPrice(pos.averageEntryPrice)}
                      </td>
                      <td className="py-3 text-right font-mono text-[13px]">
                        {formatPrice(pos.currentPrice)}
                      </td>
                      <td className={cn("py-3 text-right font-mono text-[13px]", getPriceColorClass(pos.unrealizedPnl))}>
                        {formatCurrency(pos.unrealizedPnl)}
                        <span className="ml-1 text-[10px] opacity-70">
                          ({formatPercent(pos.unrealizedPnlPercent)})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Orders */}
          <div className="card">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">Recent Orders</h2>
              <Link href="/orders" className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-brand-400 transition-colors">
                View all <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="space-y-2.5">
              {orders.slice(0, 4).map((order) => (
                <div key={order.id} className="flex items-center justify-between rounded-xl p-3 transition-colors hover:bg-white/[0.02]"
                  style={{ background: "rgba(2, 6, 23, 0.4)", border: "1px solid rgba(255, 255, 255, 0.03)" }}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg",
                      order.side === "BUY" ? "bg-emerald-500/10" : "bg-red-500/10"
                    )}>
                      {order.side === "BUY"
                        ? <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                        : <ArrowDownRight className="h-4 w-4 text-red-400" />
                      }
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold">{order.symbol}</p>
                      <p className="text-[11px] text-gray-600">
                        {order.type} &middot; {order.quantity} lots
                      </p>
                    </div>
                  </div>
                  <OrderStatusBadge status={order.status} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Market Overview */}
        <div className="card">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                <TrendingUp className="h-4 w-4 text-blue-400" />
              </div>
              <h2 className="text-[15px] font-semibold">Market Overview</h2>
            </div>
            <Link href="/markets" className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-brand-400 transition-colors">
              All markets <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {commodities.slice(0, 10).map((c) => (
              <Link
                key={c.symbol}
                href={`/trade?symbol=${c.symbol}`}
                className="group rounded-xl p-3.5 transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  background: "linear-gradient(135deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.6))",
                  border: "1px solid rgba(255, 255, 255, 0.04)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.04)"; }}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-lg">{getCategoryIcon(c.category)}</span>
                  <span className={cn(
                    "flex items-center gap-0.5 text-[11px] font-bold",
                    c.changePercent24h >= 0 ? "text-emerald-400" : "text-red-400"
                  )}>
                    {c.changePercent24h >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {formatPercent(c.changePercent24h)}
                  </span>
                </div>
                <p className="text-[13px] font-bold">{c.symbol}</p>
                <p className="text-[11px] text-gray-600">{c.name}</p>
                <p className="mt-2 font-mono text-[15px] font-semibold">{formatPrice(c.lastPrice)}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">Vol: {formatVolume(c.volume24h)}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Trades */}
        <div className="card">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                <Activity className="h-4 w-4 text-purple-400" />
              </div>
              <h2 className="text-[15px] font-semibold">Recent Trades</h2>
            </div>
            <Link href="/orders?tab=trades" className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-brand-400 transition-colors">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="table-header">Time</th>
                  <th className="table-header">Symbol</th>
                  <th className="table-header">Side</th>
                  <th className="table-header text-right">Price</th>
                  <th className="table-header text-right">Qty</th>
                  <th className="table-header text-right">Fee</th>
                  <th className="table-header text-right">Settlement</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => (
                  <tr key={trade.id} className="table-row">
                    <td className="py-3 text-[11px] text-gray-500 font-mono">
                      {new Date(trade.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3 font-semibold text-[13px]">{trade.symbol}</td>
                    <td className="py-3">
                      <span className={cn(
                        "text-[11px] font-bold",
                        trade.side === "BUY" ? "text-emerald-400" : "text-red-400"
                      )}>
                        {trade.side}
                      </span>
                    </td>
                    <td className="py-3 text-right font-mono text-[13px]">{formatPrice(trade.price)}</td>
                    <td className="py-3 text-right text-[13px] text-gray-400">{trade.quantity}</td>
                    <td className="py-3 text-right text-[13px] text-gray-500">{formatCurrency(trade.fee)}</td>
                    <td className="py-3 text-right">
                      <span className={
                        trade.settlementStatus === "settled" ? "badge-success" :
                        trade.settlementStatus === "pending" ? "badge-warning" : "badge-danger"
                      }>
                        {trade.settlementStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function SummaryCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  change,
  subtitle,
  positive,
  progress,
}: {
  icon: typeof Wallet;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
  change?: string;
  subtitle?: string;
  positive?: boolean;
  progress?: number;
}) {
  return (
    <div className="stat-card group">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", iconBg)}>
          <Icon className={cn("h-[18px] w-[18px]", iconColor)} />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      {change && (
        <div className={cn("mt-1.5 flex items-center gap-1 text-xs font-semibold", positive ? "text-emerald-400" : "text-red-400")}>
          {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          {change}
        </div>
      )}
      {subtitle && <p className="mt-1.5 text-[11px] text-gray-500">{subtitle}</p>}
      {progress !== undefined && (
        <div className="mt-2.5 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(100, progress)}%`,
              background: progress > 80
                ? "linear-gradient(90deg, #ef4444, #f87171)"
                : progress > 50
                  ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                  : "linear-gradient(90deg, #059669, #10b981)",
            }}
          />
        </div>
      )}
    </div>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    OPEN: "badge-success",
    PARTIAL: "badge-warning",
    FILLED: "badge-success",
    PENDING: "badge-warning",
    CANCELLED: "badge-danger",
    REJECTED: "badge-danger",
  };
  return <span className={colors[status] ?? "badge-neutral"}>{status}</span>;
}
