"use client";

import AppShell from "@/components/layout/AppShell";
import { useTradingStore } from "@/lib/store";
import { formatCurrency, formatPercent, formatPrice, getPriceColorClass, cn } from "@/lib/utils";

export default function PortfolioPage() {
  const { portfolio, positions } = useTradingStore();

  const totalUnrealized = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
  const totalRealized = positions.reduce((sum, p) => sum + p.realizedPnl, 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Portfolio</h1>

        {/* Summary Row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <div className="card">
            <p className="text-xs text-gray-500">Total Value</p>
            <p className="mt-1 text-xl font-bold">{formatCurrency(portfolio.totalValue)}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500">Unrealized P&L</p>
            <p className={`mt-1 text-xl font-bold ${getPriceColorClass(totalUnrealized)}`}>
              {formatCurrency(totalUnrealized)}
            </p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500">Realized P&L</p>
            <p className={`mt-1 text-xl font-bold ${getPriceColorClass(totalRealized)}`}>
              {formatCurrency(totalRealized)}
            </p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500">Available Margin</p>
            <p className="mt-1 text-xl font-bold">{formatCurrency(portfolio.marginAvailable)}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500">Margin Utilization</p>
            <p className="mt-1 text-xl font-bold">
              {((portfolio.marginUsed / (portfolio.marginUsed + portfolio.marginAvailable)) * 100).toFixed(1)}%
            </p>
            <div className="mt-2 h-2 rounded-full bg-surface-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${(portfolio.marginUsed / (portfolio.marginUsed + portfolio.marginAvailable)) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Positions Table */}
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">Open Positions ({positions.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700 text-left text-xs text-gray-500">
                  <th className="pb-2">Symbol</th>
                  <th className="pb-2">Side</th>
                  <th className="pb-2 text-right">Quantity</th>
                  <th className="pb-2 text-right">Entry Price</th>
                  <th className="pb-2 text-right">Current Price</th>
                  <th className="pb-2 text-right">Unrealized P&L</th>
                  <th className="pb-2 text-right">Realized P&L</th>
                  <th className="pb-2 text-right">Margin</th>
                  <th className="pb-2 text-right">Liq. Price</th>
                  <th className="pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos) => (
                  <tr key={pos.symbol} className="table-row">
                    <td className="py-3 font-bold">{pos.symbol}</td>
                    <td>
                      <span className={cn(
                        "rounded px-2 py-0.5 text-xs font-bold",
                        pos.side === "BUY" ? "bg-up/20 text-up" : "bg-down/20 text-down"
                      )}>
                        {pos.side === "BUY" ? "LONG" : "SHORT"}
                      </span>
                    </td>
                    <td className="text-right font-mono">{pos.quantity}</td>
                    <td className="text-right font-mono text-gray-400">{formatPrice(pos.averageEntryPrice)}</td>
                    <td className="text-right font-mono">{formatPrice(pos.currentPrice)}</td>
                    <td className={`text-right font-mono ${getPriceColorClass(pos.unrealizedPnl)}`}>
                      {formatCurrency(pos.unrealizedPnl)}
                      <br />
                      <span className="text-[10px]">{formatPercent(pos.unrealizedPnlPercent)}</span>
                    </td>
                    <td className={`text-right font-mono ${getPriceColorClass(pos.realizedPnl)}`}>
                      {formatCurrency(pos.realizedPnl)}
                    </td>
                    <td className="text-right font-mono text-gray-400">{formatCurrency(pos.margin)}</td>
                    <td className="text-right font-mono text-red-400">{formatPrice(pos.liquidationPrice)}</td>
                    <td className="text-right">
                      <button className="btn-danger text-xs px-2 py-1">Close</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Portfolio Allocation */}
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">Allocation</h2>
          <div className="space-y-3">
            {positions.map((pos) => {
              const value = pos.quantity * pos.currentPrice;
              const pct = (value / portfolio.totalValue) * 100;
              return (
                <div key={pos.symbol} className="flex items-center gap-4">
                  <span className="w-20 text-sm font-bold">{pos.symbol}</span>
                  <div className="flex-1 h-3 rounded-full bg-surface-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-sm text-gray-400">{pct.toFixed(1)}%</span>
                  <span className="w-24 text-right text-sm font-mono">{formatCurrency(value)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
