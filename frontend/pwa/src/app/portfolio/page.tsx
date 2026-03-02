"use client";

import AppShell from "@/components/layout/AppShell";
import { useTradingStore } from "@/lib/store";
import { usePortfolio, useClosePosition } from "@/lib/api-hooks";
import { formatCurrency, formatPercent, formatPrice, getPriceColorClass, cn } from "@/lib/utils";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  PieChart,
  Layers,
  X,
} from "lucide-react";

const ALLOC_COLORS = [
  "from-brand-500 to-emerald-500",
  "from-blue-500 to-cyan-500",
  "from-purple-500 to-pink-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-red-500",
  "from-indigo-500 to-violet-500",
];

export default function PortfolioPage() {
  const { portfolio, positions } = usePortfolio();
  const { closePosition } = useClosePosition();

  const totalUnrealized = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
  const totalRealized = positions.reduce((sum, p) => sum + p.realizedPnl, 0);
  const marginPct = (portfolio.marginUsed / (portfolio.marginUsed + portfolio.marginAvailable)) * 100;

  const summaryCards = [
    { icon: Wallet, iconColor: "text-brand-400", iconBg: "bg-brand-500/10", label: "Total Value", value: formatCurrency(portfolio.totalValue) },
    { icon: totalUnrealized >= 0 ? TrendingUp : TrendingDown, iconColor: totalUnrealized >= 0 ? "text-emerald-400" : "text-red-400", iconBg: totalUnrealized >= 0 ? "bg-emerald-500/10" : "bg-red-500/10", label: "Unrealized P&L", value: formatCurrency(totalUnrealized), colorClass: getPriceColorClass(totalUnrealized) },
    { icon: totalRealized >= 0 ? TrendingUp : TrendingDown, iconColor: totalRealized >= 0 ? "text-emerald-400" : "text-red-400", iconBg: totalRealized >= 0 ? "bg-emerald-500/10" : "bg-red-500/10", label: "Realized P&L", value: formatCurrency(totalRealized), colorClass: getPriceColorClass(totalRealized) },
    { icon: ShieldCheck, iconColor: "text-blue-400", iconBg: "bg-blue-500/10", label: "Available Margin", value: formatCurrency(portfolio.marginAvailable) },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>
          <p className="mt-1 text-sm text-gray-500">{positions.length} open positions</p>
        </div>

        {/* Summary Row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {summaryCards.map((card) => (
            <div key={card.label} className="stat-card">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-xl", card.iconBg)}>
                  <card.icon className={cn("h-4 w-4", card.iconColor)} />
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{card.label}</p>
              </div>
              <p className={cn("text-xl font-bold tracking-tight", card.colorClass)}>{card.value}</p>
            </div>
          ))}
          <div className="stat-card">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10">
                <PieChart className="h-4 w-4 text-amber-400" />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Margin Used</p>
            </div>
            <p className="text-xl font-bold tracking-tight">{marginPct.toFixed(1)}%</p>
            <div className="mt-2.5 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, marginPct)}%`,
                  background: marginPct > 80
                    ? "linear-gradient(90deg, #ef4444, #f87171)"
                    : marginPct > 50
                      ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                      : "linear-gradient(90deg, #059669, #10b981)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Positions Table */}
        <div className="card">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10">
              <Layers className="h-4 w-4 text-brand-400" />
            </div>
            <h2 className="text-[15px] font-semibold">Open Positions</h2>
            <span className="badge-neutral text-[10px]">{positions.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="table-header">Symbol</th>
                  <th className="table-header">Side</th>
                  <th className="table-header text-right">Quantity</th>
                  <th className="table-header text-right">Entry Price</th>
                  <th className="table-header text-right">Current Price</th>
                  <th className="table-header text-right">Unrealized P&L</th>
                  <th className="table-header text-right">Realized P&L</th>
                  <th className="table-header text-right">Margin</th>
                  <th className="table-header text-right">Liq. Price</th>
                  <th className="table-header text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos) => (
                  <tr key={pos.symbol} className="table-row">
                    <td className="py-3 font-bold text-[13px]">{pos.symbol}</td>
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
                    <td className="py-3 text-right font-mono text-[13px] text-gray-500">{formatPrice(pos.averageEntryPrice)}</td>
                    <td className="py-3 text-right font-mono text-[13px]">{formatPrice(pos.currentPrice)}</td>
                    <td className={cn("py-3 text-right font-mono text-[13px]", getPriceColorClass(pos.unrealizedPnl))}>
                      {formatCurrency(pos.unrealizedPnl)}
                      <span className="block text-[10px] opacity-70">{formatPercent(pos.unrealizedPnlPercent)}</span>
                    </td>
                    <td className={cn("py-3 text-right font-mono text-[13px]", getPriceColorClass(pos.realizedPnl))}>
                      {formatCurrency(pos.realizedPnl)}
                    </td>
                    <td className="py-3 text-right font-mono text-[13px] text-gray-500">{formatCurrency(pos.margin)}</td>
                    <td className="py-3 text-right font-mono text-[13px] text-red-400/70">{formatPrice(pos.liquidationPrice)}</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => closePosition(pos.symbol)}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <X className="h-3 w-3" /> Close
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Portfolio Allocation */}
        <div className="card">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
              <PieChart className="h-4 w-4 text-purple-400" />
            </div>
            <h2 className="text-[15px] font-semibold">Allocation</h2>
          </div>
          <div className="space-y-3">
            {positions.map((pos, i) => {
              const value = pos.quantity * pos.currentPrice;
              const pct = (value / portfolio.totalValue) * 100;
              return (
                <div key={pos.symbol} className="flex items-center gap-4">
                  <span className="w-20 text-[13px] font-bold">{pos.symbol}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div
                      className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700", ALLOC_COLORS[i % ALLOC_COLORS.length])}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-14 text-right text-[13px] font-semibold text-gray-400">{pct.toFixed(1)}%</span>
                  <span className="w-24 text-right text-[13px] font-mono">{formatCurrency(value)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
