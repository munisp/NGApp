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

// Dynamic imports for heavy chart components (no SSR)
const AdvancedChart = dynamic(() => import("@/components/trading/AdvancedChart"), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-gray-500">Loading chart...</div>,
});
const DepthChart = dynamic(() => import("@/components/trading/DepthChart"), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-32 text-gray-500">Loading depth...</div>,
});

export default function TradePage() {
  return (
    <Suspense fallback={<AppShell><div className="flex items-center justify-center h-64 text-gray-500">Loading trading terminal...</div></AppShell>}>
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

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Symbol Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Symbol Selector */}
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-brand-500"
            >
              {commodities.map((c) => (
                <option key={c.symbol} value={c.symbol}>
                  {c.symbol} - {c.name}
                </option>
              ))}
            </select>

            <div>
              <span className="text-2xl font-bold font-mono">{formatPrice(commodity.lastPrice)}</span>
              <span className={`ml-2 text-sm font-medium ${getPriceColorClass(commodity.changePercent24h)}`}>
                {formatPercent(commodity.changePercent24h)}
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6 text-xs text-gray-400">
            <div>
              <span className="text-gray-600">24h High </span>
              <span className="font-mono text-white">{formatPrice(commodity.high24h)}</span>
            </div>
            <div>
              <span className="text-gray-600">24h Low </span>
              <span className="font-mono text-white">{formatPrice(commodity.low24h)}</span>
            </div>
            <div>
              <span className="text-gray-600">24h Vol </span>
              <span className="font-mono text-white">{formatVolume(commodity.volume24h)} {commodity.unit}</span>
            </div>
          </div>
        </div>

        {/* Main Trading Layout */}
        <div className="grid gap-4 lg:grid-cols-[1fr_260px_280px]">
          {/* Chart + Depth */}
          <div className="space-y-2">
            <ErrorBoundary fallback={<div className="p-8 text-center text-gray-500">Chart failed to load</div>}>
              <div className="card min-h-[400px] lg:min-h-[500px]">
                <AdvancedChart symbol={selectedSymbol} basePrice={commodity.lastPrice} />
              </div>
            </ErrorBoundary>
            <ErrorBoundary fallback={<div className="p-4 text-center text-gray-500">Depth chart failed to load</div>}>
              <div className="card">
                <h3 className="text-sm font-semibold mb-2">Market Depth</h3>
                <DepthChart symbol={selectedSymbol} />
              </div>
            </ErrorBoundary>
          </div>

          {/* Order Book */}
          <div className="card hidden lg:block min-h-[500px]">
            <OrderBookView symbol={selectedSymbol} />
          </div>

          {/* Order Entry */}
          <div className="card">
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
          <div className="flex items-center gap-4 border-b border-surface-700 mb-3">
            {(["orders", "trades", "positions"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setBottomTab(tab)}
                className={cn(
                  "pb-2 text-sm font-medium capitalize transition-colors border-b-2",
                  bottomTab === tab
                    ? "border-brand-500 text-white"
                    : "border-transparent text-gray-500 hover:text-gray-300"
                )}
              >
                {tab}
                {tab === "orders" && symbolOrders.length > 0 && (
                  <span className="ml-1 rounded-full bg-surface-700 px-1.5 py-0.5 text-[10px]">
                    {symbolOrders.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {bottomTab === "orders" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-surface-700">
                    <th className="pb-2">Time</th>
                    <th className="pb-2">Side</th>
                    <th className="pb-2">Type</th>
                    <th className="pb-2 text-right">Price</th>
                    <th className="pb-2 text-right">Qty</th>
                    <th className="pb-2 text-right">Filled</th>
                    <th className="pb-2 text-right">Status</th>
                    <th className="pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="table-row">
                      <td className="py-2 text-xs text-gray-400">
                        {new Date(o.createdAt).toLocaleTimeString()}
                      </td>
                      <td className={o.side === "BUY" ? "text-up" : "text-down"}>{o.side}</td>
                      <td className="text-gray-400">{o.type}</td>
                      <td className="text-right font-mono">{formatPrice(o.price)}</td>
                      <td className="text-right">{o.quantity}</td>
                      <td className="text-right">{o.filledQuantity}/{o.quantity}</td>
                      <td className="text-right">
                        <span className={
                          o.status === "FILLED" ? "badge-success" :
                          o.status === "OPEN" || o.status === "PARTIAL" ? "badge-warning" : "badge-danger"
                        }>
                          {o.status}
                        </span>
                      </td>
                      <td className="text-right">
                        {(o.status === "OPEN" || o.status === "PENDING") && (
                          <button
                            onClick={() => cancelOrder(o.id)}
                            className="text-[10px] text-red-400 hover:text-red-300"
                          >Cancel</button>
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
                  <tr className="text-left text-xs text-gray-500 border-b border-surface-700">
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
                  {trades.map((t) => (
                    <tr key={t.id} className="table-row">
                      <td className="py-2 text-xs text-gray-400">
                        {new Date(t.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="font-medium">{t.symbol}</td>
                      <td className={t.side === "BUY" ? "text-up" : "text-down"}>{t.side}</td>
                      <td className="text-right font-mono">{formatPrice(t.price)}</td>
                      <td className="text-right">{t.quantity}</td>
                      <td className="text-right text-gray-400">${t.fee.toFixed(2)}</td>
                      <td className="text-right">
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
            <div className="text-center py-8 text-sm text-gray-500">
              No open positions for this symbol. Place an order to open a position.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
