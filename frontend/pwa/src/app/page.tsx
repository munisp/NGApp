"use client";

import AppShell from "@/components/layout/AppShell";
import { useMarketStore, useTradingStore } from "@/lib/store";
import { formatCurrency, formatPercent, formatVolume, getPriceColorClass, getCategoryIcon, formatPrice } from "@/lib/utils";
import Link from "next/link";

export default function DashboardPage() {
  const { commodities } = useMarketStore();
  const { portfolio, positions, orders, trades } = useTradingStore();

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-gray-400">NEXCOM Exchange Overview</p>
        </div>

        {/* Portfolio Summary Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SummaryCard
            label="Portfolio Value"
            value={formatCurrency(portfolio.totalValue)}
            change={formatPercent(portfolio.totalPnlPercent)}
            positive={portfolio.totalPnlPercent >= 0}
          />
          <SummaryCard
            label="Available Balance"
            value={formatCurrency(portfolio.availableBalance)}
          />
          <SummaryCard
            label="Unrealized P&L"
            value={formatCurrency(portfolio.totalPnl)}
            change={formatPercent(portfolio.totalPnlPercent)}
            positive={portfolio.totalPnl >= 0}
          />
          <SummaryCard
            label="Margin Used"
            value={formatCurrency(portfolio.marginUsed)}
            subtitle={`${((portfolio.marginUsed / (portfolio.marginUsed + portfolio.marginAvailable)) * 100).toFixed(1)}% utilized`}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Positions */}
          <div className="card lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Open Positions</h2>
              <Link href="/portfolio" className="text-xs text-brand-400 hover:underline">
                View all
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-700 text-left text-xs text-gray-500">
                    <th className="pb-2">Symbol</th>
                    <th className="pb-2">Side</th>
                    <th className="pb-2 text-right">Qty</th>
                    <th className="pb-2 text-right">Entry</th>
                    <th className="pb-2 text-right">Current</th>
                    <th className="pb-2 text-right">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos) => (
                    <tr key={pos.symbol} className="table-row">
                      <td className="py-2.5 font-medium">{pos.symbol}</td>
                      <td className={pos.side === "BUY" ? "text-up" : "text-down"}>
                        {pos.side}
                      </td>
                      <td className="text-right">{pos.quantity}</td>
                      <td className="text-right font-mono text-gray-400">
                        {formatPrice(pos.averageEntryPrice)}
                      </td>
                      <td className="text-right font-mono">
                        {formatPrice(pos.currentPrice)}
                      </td>
                      <td className={`text-right font-mono ${getPriceColorClass(pos.unrealizedPnl)}`}>
                        {formatCurrency(pos.unrealizedPnl)}
                        <span className="ml-1 text-xs">
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
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent Orders</h2>
              <Link href="/orders" className="text-xs text-brand-400 hover:underline">
                View all
              </Link>
            </div>
            <div className="space-y-3">
              {orders.slice(0, 4).map((order) => (
                <div key={order.id} className="flex items-center justify-between rounded-lg bg-surface-900 p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${order.side === "BUY" ? "text-up" : "text-down"}`}>
                        {order.side}
                      </span>
                      <span className="font-medium">{order.symbol}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {order.type} &middot; {order.quantity} lots
                    </p>
                  </div>
                  <OrderStatusBadge status={order.status} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Market Overview */}
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Market Overview</h2>
            <Link href="/markets" className="text-xs text-brand-400 hover:underline">
              View all markets
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {commodities.slice(0, 10).map((c) => (
              <Link
                key={c.symbol}
                href={`/trade?symbol=${c.symbol}`}
                className="rounded-lg border border-surface-700 bg-surface-900 p-3 hover:border-surface-200/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg">{getCategoryIcon(c.category)}</span>
                  <span className={`text-xs font-bold ${getPriceColorClass(c.changePercent24h)}`}>
                    {formatPercent(c.changePercent24h)}
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold">{c.symbol}</p>
                <p className="text-xs text-gray-500">{c.name}</p>
                <p className="mt-1 font-mono text-sm">{formatPrice(c.lastPrice)}</p>
                <p className="text-[10px] text-gray-500">Vol: {formatVolume(c.volume24h)}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Trades */}
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Trades</h2>
            <Link href="/orders?tab=trades" className="text-xs text-brand-400 hover:underline">
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700 text-left text-xs text-gray-500">
                  <th className="pb-2">Time</th>
                  <th className="pb-2">Symbol</th>
                  <th className="pb-2">Side</th>
                  <th className="pb-2 text-right">Price</th>
                  <th className="pb-2 text-right">Qty</th>
                  <th className="pb-2 text-right">Fee</th>
                  <th className="pb-2 text-right">Settlement</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => (
                  <tr key={trade.id} className="table-row">
                    <td className="py-2 text-xs text-gray-400">
                      {new Date(trade.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="font-medium">{trade.symbol}</td>
                    <td className={trade.side === "BUY" ? "text-up" : "text-down"}>
                      {trade.side}
                    </td>
                    <td className="text-right font-mono">{formatPrice(trade.price)}</td>
                    <td className="text-right">{trade.quantity}</td>
                    <td className="text-right text-gray-400">{formatCurrency(trade.fee)}</td>
                    <td className="text-right">
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
  label,
  value,
  change,
  subtitle,
  positive,
}: {
  label: string;
  value: string;
  change?: string;
  subtitle?: string;
  positive?: boolean;
}) {
  return (
    <div className="card">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {change && (
        <p className={`mt-0.5 text-xs font-medium ${positive ? "text-up" : "text-down"}`}>
          {change}
        </p>
      )}
      {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
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
  return <span className={colors[status] ?? "badge"}>{status}</span>;
}
