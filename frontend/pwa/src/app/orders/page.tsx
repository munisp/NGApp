"use client";

import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { useTradingStore } from "@/lib/store";
import { formatPrice, formatCurrency, formatDateTime, cn } from "@/lib/utils";
import type { OrderStatus } from "@/types";

export default function OrdersPage() {
  const { orders, trades } = useTradingStore();
  const [tab, setTab] = useState<"open" | "history" | "trades">("open");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");

  const openOrders = orders.filter((o) => o.status === "OPEN" || o.status === "PENDING" || o.status === "PARTIAL");
  const historyOrders = orders.filter((o) => o.status === "FILLED" || o.status === "CANCELLED" || o.status === "REJECTED");

  const displayOrders = tab === "open" ? openOrders : historyOrders;

  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Orders & Trades</h1>

        {/* Tabs */}
        <div className="flex items-center gap-4 border-b border-surface-700">
          {([
            { key: "open", label: "Open Orders", count: openOrders.length },
            { key: "history", label: "Order History", count: historyOrders.length },
            { key: "trades", label: "Trade History", count: trades.length },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "pb-3 text-sm font-medium transition-colors border-b-2",
                tab === t.key
                  ? "border-brand-500 text-white"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              )}
            >
              {t.label}
              <span className="ml-1.5 rounded-full bg-surface-700 px-1.5 py-0.5 text-[10px]">{t.count}</span>
            </button>
          ))}
        </div>

        {/* Orders Tab */}
        {(tab === "open" || tab === "history") && (
          <div className="card">
            {tab === "open" && openOrders.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">No open orders</p>
                <p className="text-sm mt-1">Place a new order from the Trade page</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-700 text-left text-xs text-gray-500">
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Symbol</th>
                      <th className="pb-2">Side</th>
                      <th className="pb-2">Type</th>
                      <th className="pb-2 text-right">Price</th>
                      <th className="pb-2 text-right">Quantity</th>
                      <th className="pb-2 text-right">Filled</th>
                      <th className="pb-2 text-right">Avg Price</th>
                      <th className="pb-2 text-right">Status</th>
                      {tab === "open" && <th className="pb-2 text-right">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {displayOrders.map((o) => (
                      <tr key={o.id} className="table-row">
                        <td className="py-2.5 text-xs text-gray-400">{formatDateTime(o.createdAt)}</td>
                        <td className="font-bold">{o.symbol}</td>
                        <td className={o.side === "BUY" ? "text-up font-medium" : "text-down font-medium"}>{o.side}</td>
                        <td className="text-gray-400">{o.type}</td>
                        <td className="text-right font-mono">
                          {o.type === "MARKET" ? "Market" : formatPrice(o.price)}
                        </td>
                        <td className="text-right">{o.quantity}</td>
                        <td className="text-right">{o.filledQuantity}</td>
                        <td className="text-right font-mono">
                          {o.averagePrice > 0 ? formatPrice(o.averagePrice) : "-"}
                        </td>
                        <td className="text-right">
                          <OrderBadge status={o.status} />
                        </td>
                        {tab === "open" && (
                          <td className="text-right">
                            <button className="text-xs text-red-400 hover:text-red-300 font-medium">
                              Cancel
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Trades Tab */}
        {tab === "trades" && (
          <div className="card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-700 text-left text-xs text-gray-500">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Trade ID</th>
                    <th className="pb-2">Symbol</th>
                    <th className="pb-2">Side</th>
                    <th className="pb-2 text-right">Price</th>
                    <th className="pb-2 text-right">Quantity</th>
                    <th className="pb-2 text-right">Value</th>
                    <th className="pb-2 text-right">Fee</th>
                    <th className="pb-2 text-right">Settlement</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t) => (
                    <tr key={t.id} className="table-row">
                      <td className="py-2.5 text-xs text-gray-400">{formatDateTime(t.timestamp)}</td>
                      <td className="text-xs text-gray-500 font-mono">{t.id}</td>
                      <td className="font-bold">{t.symbol}</td>
                      <td className={t.side === "BUY" ? "text-up font-medium" : "text-down font-medium"}>{t.side}</td>
                      <td className="text-right font-mono">{formatPrice(t.price)}</td>
                      <td className="text-right">{t.quantity}</td>
                      <td className="text-right font-mono">{formatCurrency(t.price * t.quantity)}</td>
                      <td className="text-right text-gray-400">{formatCurrency(t.fee)}</td>
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
          </div>
        )}
      </div>
    </AppShell>
  );
}

function OrderBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    PENDING: "badge-warning",
    OPEN: "badge-success",
    PARTIAL: "badge-warning",
    FILLED: "badge-success",
    CANCELLED: "badge-danger",
    REJECTED: "badge-danger",
  };
  return <span className={styles[status]}>{status}</span>;
}
