"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import AppShell from "@/components/layout/AppShell";
import OrderBookView from "@/components/trading/OrderBook";
import OrderEntry from "@/components/trading/OrderEntry";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { useMarketStore, useTradingStore } from "@/lib/store";
import { useMarkets, useOrders, useTrades, useCreateOrder, useCancelOrder } from "@/lib/api-hooks";
import { formatPrice, formatPercent, formatVolume, getPriceColorClass, cn } from "@/lib/utils";
import {
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Clock,
  X,
  Layers,
} from "lucide-react";

// Dynamic imports for heavy chart components (no SSR)
const AdvancedChart = dynamic(() => import("@/components/trading/AdvancedChart"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-lg border-2 border-brand-500/30 border-t-brand-500 animate-spin" />
        <span className="text-xs text-gray-600">Loading chart...</span>
      </div>
    </div>
  ),
});
const DepthChart = dynamic(() => import("@/components/trading/DepthChart"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-32">
      <span className="text-xs text-gray-600">Loading depth...</span>
    </div>
  ),
});

export default function TradePage() {
  return (
    <Suspense fallback={
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 rounded-xl border-2 border-brand-500/30 border-t-brand-500 animate-spin" />
            <span className="text-sm text-gray-500">Loading trading terminal...</span>
          </div>
        </div>
      </AppShell>
    }>
      <TradePageContent />
    </Suspense>
  );
}

function TradePageContent() {
  const searchParams = useSearchParams();
  const initialSymbol = searchParams.get("symbol") || "MAIZE";
  const { commodities } = useMarkets();
  const { orders } = useOrders();
  const { trades } = useTrades();
  const { createOrder } = useCreateOrder();
  const { cancelOrder } = useCancelOrder();
  const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol);
  const [bottomTab, setBottomTab] = useState<"orders" | "trades" | "positions">("orders");

  const commodity = commodities.find((c) => c.symbol === selectedSymbol) ?? commodities[0];
  const symbolOrders = orders.filter((o) => o.symbol === selectedSymbol);
  const symbolTrades = trades.filter((t) => t.symbol === selectedSymbol);
  const isUp = commodity.changePercent24h >= 0;

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Symbol Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="rounded-xl py-2.5 px-4 text-sm font-bold text-white appearance-none cursor-pointer focus:outline-none"
              style={{
                background: "rgba(30, 41, 59, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
              }}
            >
              {commodities.map((c) => (
                <option key={c.symbol} value={c.symbol}>
                  {c.symbol} - {c.name}
                </option>
              ))}
            </select>

            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold font-mono tracking-tight">{formatPrice(commodity.lastPrice)}</span>
              <span className={cn(
                "flex items-center gap-1 text-sm font-bold",
                isUp ? "text-emerald-400" : "text-red-400"
              )}>
                {isUp ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                {formatPercent(commodity.changePercent24h)}
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1">
            {[
              { label: "24h High", value: formatPrice(commodity.high24h), color: "text-emerald-400" },
              { label: "24h Low", value: formatPrice(commodity.low24h), color: "text-red-400" },
              { label: "24h Vol", value: `${formatVolume(commodity.volume24h)} ${commodity.unit}`, color: "text-white" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg px-3 py-1.5" style={{ background: "rgba(255, 255, 255, 0.02)" }}>
                <span className="text-[10px] font-medium text-gray-600 uppercase">{stat.label}</span>
                <span className={cn("ml-2 font-mono text-xs font-semibold", stat.color)}>{stat.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Main Trading Layout */}
        <div className="grid gap-4 lg:grid-cols-[1fr_260px_280px]">
          {/* Chart + Depth */}
          <div className="space-y-3">
            <ErrorBoundary fallback={<div className="card p-8 text-center text-gray-500">Chart failed to load</div>}>
              <div className="card min-h-[400px] lg:min-h-[500px] !p-3">
                <AdvancedChart symbol={selectedSymbol} basePrice={commodity.lastPrice} />
              </div>
            </ErrorBoundary>
            <ErrorBoundary fallback={<div className="card p-4 text-center text-gray-500">Depth chart failed to load</div>}>
              <div className="card !p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="h-4 w-4 text-blue-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Market Depth</h3>
                </div>
                <DepthChart symbol={selectedSymbol} />
              </div>
            </ErrorBoundary>
          </div>

          {/* Order Book */}
          <div className="card hidden lg:block min-h-[500px] !p-3">
            <OrderBookView symbol={selectedSymbol} />
          </div>

          {/* Order Entry */}
          <div className="card !p-4">
            <OrderEntry
              symbol={selectedSymbol}
              currentPrice={commodity.lastPrice}
              onSubmit={async (order) => {
                await createOrder({
                  symbol: selectedSymbol,
                  side: order.side,
                  type: order.type,
                  quantity: order.quantity,
                  price: order.price,
                  stopPrice: order.stopPrice,
                });
              }}
            />
          </div>
        </div>

        {/* Bottom Panel - Orders/Trades */}
        <div className="card">
          <div className="flex items-center gap-1 mb-4" style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
            {(["orders", "trades", "positions"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setBottomTab(tab)}
                className={cn(
                  "relative px-4 pb-3 pt-1 text-[13px] font-medium capitalize transition-colors",
                  bottomTab === tab
                    ? "text-white"
                    : "text-gray-600 hover:text-gray-400"
                )}
              >
                {tab}
                {tab === "orders" && symbolOrders.length > 0 && (
                  <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                    style={{ background: "rgba(16, 185, 129, 0.1)", color: "#34d399" }}
                  >
                    {symbolOrders.length}
                  </span>
                )}
                {bottomTab === tab && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-brand-500" />
                )}
              </button>
            ))}
          </div>

          {bottomTab === "orders" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="table-header"><Clock className="inline h-3 w-3 mr-1 opacity-50" />Time</th>
                    <th className="table-header">Side</th>
                    <th className="table-header">Type</th>
                    <th className="table-header text-right">Price</th>
                    <th className="table-header text-right">Qty</th>
                    <th className="table-header text-right">Filled</th>
                    <th className="table-header text-right">Status</th>
                    <th className="table-header text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="table-row">
                      <td className="py-3 text-[11px] text-gray-500 font-mono">
                        {new Date(o.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="py-3">
                        <span className={cn("text-[11px] font-bold", o.side === "BUY" ? "text-emerald-400" : "text-red-400")}>{o.side}</span>
                      </td>
                      <td className="py-3 text-[13px] text-gray-400">{o.type}</td>
                      <td className="py-3 text-right font-mono text-[13px]">{formatPrice(o.price)}</td>
                      <td className="py-3 text-right text-[13px]">{o.quantity}</td>
                      <td className="py-3 text-right text-[13px] text-gray-400">{o.filledQuantity}/{o.quantity}</td>
                      <td className="py-3 text-right">
                        <span className={
                          o.status === "FILLED" ? "badge-success" :
                          o.status === "OPEN" || o.status === "PARTIAL" ? "badge-warning" : "badge-danger"
                        }>
                          {o.status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {(o.status === "OPEN" || o.status === "PENDING") && (
                          <button
                            onClick={() => cancelOrder(o.id)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <X className="h-3 w-3" /> Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {bottomTab === "trades" && (
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
                  {trades.map((t) => (
                    <tr key={t.id} className="table-row">
                      <td className="py-3 text-[11px] text-gray-500 font-mono">
                        {new Date(t.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-3 font-semibold text-[13px]">{t.symbol}</td>
                      <td className="py-3">
                        <span className={cn("text-[11px] font-bold", t.side === "BUY" ? "text-emerald-400" : "text-red-400")}>
                          {t.side}
                        </span>
                      </td>
                      <td className="py-3 text-right font-mono text-[13px]">{formatPrice(t.price)}</td>
                      <td className="py-3 text-right text-[13px]">{t.quantity}</td>
                      <td className="py-3 text-right text-[13px] text-gray-500">${t.fee.toFixed(2)}</td>
                      <td className="py-3 text-right">
                        <span className={
                          t.settlementStatus === "settled" ? "badge-success" :
                          t.settlementStatus === "pending" ? "badge-warning" : "badge-danger"
                        }>
                          {t.settlementStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {bottomTab === "positions" && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-600">
              <BarChart3 className="h-8 w-8 mb-3 opacity-30" />
              <p className="text-sm font-medium">No open positions for this symbol</p>
              <p className="text-xs mt-1">Place an order to open a position</p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
