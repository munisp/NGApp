"use client";

import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { useTradingStore } from "@/lib/store";
import { useOrders, useTrades, useCancelOrder } from "@/lib/api-hooks";
import { formatPrice, formatCurrency, formatDateTime, cn } from "@/lib/utils";
import type { OrderStatus } from "@/types";
import {
  ClipboardList,
  History,
  Activity,
  X,
  Package,
} from "lucide-react";

const TAB_ICONS = {
  open: ClipboardList,
  history: History,
  trades: Activity,
};

export default function OrdersPage() {
  const { orders } = useOrders();
  const { trades } = useTrades();
  const { cancelOrder } = useCancelOrder();
  const [tab, setTab] = useState<"open" | "history" | "trades">("open");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");

  const openOrders = orders.filter((o) => o.status === "OPEN" || o.status === "PENDING" || o.status === "PARTIAL");
  const historyOrders = orders.filter((o) => o.status === "FILLED" || o.status === "CANCELLED" || o.status === "REJECTED");

  const displayOrders = tab === "open" ? openOrders : historyOrders;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders & Trades</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your orders and view trade history</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1" style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
          {([
            { key: "open" as const, label: "Open Orders", count: openOrders.length },
            { key: "history" as const, label: "Order History", count: historyOrders.length },
            { key: "trades" as const, label: "Trade History", count: trades.length },
          ]).map((t) => {
            const Icon = TAB_ICONS[t.key];
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "relative flex items-center gap-2 px-4 pb-3 pt-1 text-[13px] font-medium transition-colors",
                  tab === t.key
                    ? "text-white"
                    : "text-gray-600 hover:text-gray-400"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  tab === t.key
                    ? "bg-brand-500/10 text-brand-400"
                    : "text-gray-600"
                )}
                  style={tab !== t.key ? { background: "rgba(255,255,255,0.03)" } : {}}
                >
                  {t.count}
                </span>
                {tab === t.key && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-10 rounded-full bg-brand-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* Orders Tab */}
        {(tab === "open" || tab === "history") && (
          <div className="card">
            {tab === "open" && openOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                <Package className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">No open orders</p>
                <p className="text-xs mt-1">Place a new order from the Trade page</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="table-header">Date</th>
                      <th className="table-header">Symbol</th>
                      <th className="table-header">Side</th>
                      <th className="table-header">Type</th>
                      <th className="table-header text-right">Price</th>
                      <th className="table-header text-right">Quantity</th>
                      <th className="table-header text-right">Filled</th>
                      <th className="table-header text-right">Avg Price</th>
                      <th className="table-header text-right">Status</th>
                      {tab === "open" && <th className="table-header text-right">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {displayOrders.map((o) => (
                      <tr key={o.id} className="table-row">
                        <td className="py-3 text-[11px] text-gray-500 font-mono">{formatDateTime(o.createdAt)}</td>
                        <td className="py-3 font-bold text-[13px]">{o.symbol}</td>
                        <td className="py-3">
                          <span className={cn("text-[11px] font-bold", o.side === "BUY" ? "text-emerald-400" : "text-red-400")}>
                            {o.side}
                          </span>
                        </td>
                        <td className="py-3 text-[13px] text-gray-400">{o.type}</td>
                        <td className="py-3 text-right font-mono text-[13px]">
                          {o.type === "MARKET" ? <span className="text-gray-500">Market</span> : formatPrice(o.price)}
                        </td>
                        <td className="py-3 text-right text-[13px]">{o.quantity}</td>
                        <td className="py-3 text-right text-[13px] text-gray-400">{o.filledQuantity}</td>
                        <td className="py-3 text-right font-mono text-[13px]">
                          {o.averagePrice > 0 ? formatPrice(o.averagePrice) : <span className="text-gray-600">-</span>}
                        </td>
                        <td className="py-3 text-right">
                          <OrderBadge status={o.status} />
                        </td>
                        {tab === "open" && (
                          <td className="py-3 text-right">
                            <button
                              onClick={() => cancelOrder(o.id)}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <X className="h-3 w-3" /> Cancel
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
                  <tr className="text-left">
                    <th className="table-header">Date</th>
                    <th className="table-header">Trade ID</th>
                    <th className="table-header">Symbol</th>
                    <th className="table-header">Side</th>
                    <th className="table-header text-right">Price</th>
                    <th className="table-header text-right">Quantity</th>
                    <th className="table-header text-right">Value</th>
                    <th className="table-header text-right">Fee</th>
                    <th className="table-header text-right">Settlement</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t) => (
                    <tr key={t.id} className="table-row">
                      <td className="py-3 text-[11px] text-gray-500 font-mono">{formatDateTime(t.timestamp)}</td>
                      <td className="py-3 text-[11px] text-gray-600 font-mono">{t.id}</td>
                      <td className="py-3 font-bold text-[13px]">{t.symbol}</td>
                      <td className="py-3">
                        <span className={cn("text-[11px] font-bold", t.side === "BUY" ? "text-emerald-400" : "text-red-400")}>
                          {t.side}
                        </span>
                      </td>
                      <td className="py-3 text-right font-mono text-[13px]">{formatPrice(t.price)}</td>
                      <td className="py-3 text-right text-[13px]">{t.quantity}</td>
                      <td className="py-3 text-right font-mono text-[13px]">{formatCurrency(t.price * t.quantity)}</td>
                      <td className="py-3 text-right text-[13px] text-gray-500">{formatCurrency(t.fee)}</td>
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
