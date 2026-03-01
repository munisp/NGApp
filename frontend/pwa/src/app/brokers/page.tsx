"use client";

import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { useBrokers, useRouteOrder } from "@/lib/api-hooks";
import { cn } from "@/lib/utils";
import {
  Building2,
  Wifi,
  WifiOff,
  Shield,
  Users,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  ChevronDown,
  ChevronUp,
  Activity,
  Network,
  Server,
  ArrowRight,
} from "lucide-react";

const BROKER_TYPE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  FULLSERVICE: { color: "text-brand-400", bg: "bg-brand-500/10", label: "Full Service" },
  EXECUTIONONLY: { color: "text-blue-400", bg: "bg-blue-500/10", label: "Execution Only" },
  ALGOTRADER: { color: "text-purple-400", bg: "bg-purple-500/10", label: "Algo Trader" },
  INTRODUCING: { color: "text-amber-400", bg: "bg-amber-500/10", label: "Introducing" },
};

const PROTOCOL_COLORS: Record<string, string> = {
  FIX50: "text-emerald-400",
  FIX44: "text-green-400",
  BINARY: "text-purple-400",
  RESTAPI: "text-blue-400",
  WEBSOCKET: "text-cyan-400",
};

export default function BrokersPage() {
  const { brokers, loading } = useBrokers();
  const { routeOrder, loading: routing, result: routeResult, error: routeError } = useRouteOrder();
  const [expandedBroker, setExpandedBroker] = useState<string | null>(null);
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [routeForm, setRouteForm] = useState({
    broker_id: "BRK-001",
    client_account: "ACC-001",
    symbol: "GOLD",
    side: "BUY",
    quantity: 100,
  });

  const handleRouteOrder = async () => {
    await routeOrder(routeForm);
  };

  const connectedCount = brokers.filter((b) => {
    const conn = b.connectivity as Record<string, unknown> | undefined;
    return conn?.connected === true;
  }).length;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Broker Network</h1>
            <p className="mt-1 text-sm text-gray-500">
              {brokers.length} registered brokers | {connectedCount} connected
            </p>
          </div>
          <button
            onClick={() => setShowRouteForm(!showRouteForm)}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-brand-400 transition-all hover:bg-brand-500/10"
            style={{ background: "rgba(16, 185, 129, 0.06)", border: "1px solid rgba(16, 185, 129, 0.15)" }}
          >
            <Send className="h-4 w-4" />
            Route Order
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { icon: Building2, label: "Total Brokers", value: String(brokers.length), color: "brand" },
            { icon: Wifi, label: "Connected", value: String(connectedCount), color: "emerald" },
            { icon: WifiOff, label: "Disconnected", value: String(brokers.length - connectedCount), color: "red" },
            { icon: Users, label: "Total Clients", value: String(brokers.reduce((sum, b) => sum + ((b.clients as unknown[])?.length ?? 0), 0)), color: "blue" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="card !p-4">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    stat.color === "brand" ? "bg-brand-500/10" : stat.color === "emerald" ? "bg-emerald-500/10" : stat.color === "red" ? "bg-red-500/10" : "bg-blue-500/10"
                  )}>
                    <Icon className={cn(
                      "h-4 w-4",
                      stat.color === "brand" ? "text-brand-400" : stat.color === "emerald" ? "text-emerald-400" : stat.color === "red" ? "text-red-400" : "text-blue-400"
                    )} />
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{stat.label}</p>
                </div>
                <p className="text-xl font-bold font-mono">{stat.value}</p>
              </div>
            );
          })}
        </div>

        {/* Order Route Form */}
        {showRouteForm && (
          <div className="card">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10">
                <Send className="h-4 w-4 text-brand-400" />
              </div>
              <h2 className="text-[15px] font-semibold">Route Order via Broker</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Broker</label>
                <select
                  value={routeForm.broker_id}
                  onChange={(e) => setRouteForm({ ...routeForm, broker_id: e.target.value })}
                  className="input-field !rounded-xl w-full"
                >
                  {brokers.filter(b => b.status === "ACTIVE").map((b) => (
                    <option key={String(b.id)} value={String(b.id)}>{String(b.name)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Client Account</label>
                <input type="text" value={routeForm.client_account} onChange={(e) => setRouteForm({ ...routeForm, client_account: e.target.value })} className="input-field !rounded-xl w-full" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Symbol</label>
                <select
                  value={routeForm.symbol}
                  onChange={(e) => setRouteForm({ ...routeForm, symbol: e.target.value })}
                  className="input-field !rounded-xl w-full"
                >
                  {["GOLD", "SILVER", "CRUDE_OIL", "COFFEE", "COCOA", "MAIZE", "WHEAT", "SOYBEAN"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Side</label>
                <div className="flex gap-1">
                  {["BUY", "SELL"].map((side) => (
                    <button
                      key={side}
                      onClick={() => setRouteForm({ ...routeForm, side })}
                      className={cn(
                        "flex-1 rounded-xl py-2 text-[12px] font-bold transition-all",
                        routeForm.side === side
                          ? side === "BUY"
                            ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                            : "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"
                          : "text-gray-600 hover:text-gray-400"
                      )}
                      style={routeForm.side !== side ? { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.04)" } : undefined}
                    >
                      {side}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Quantity</label>
                <input type="number" value={routeForm.quantity} onChange={(e) => setRouteForm({ ...routeForm, quantity: Number(e.target.value) })} className="input-field !rounded-xl w-full" />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleRouteOrder}
                disabled={routing}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}
              >
                <ArrowRight className="h-4 w-4" />
                {routing ? "Routing..." : "Route Order"}
              </button>
              {routeResult && (
                <div className="flex items-center gap-2 text-sm text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> Order routed — {String((routeResult as Record<string, unknown>).route_status ?? "VALIDATED")}
                </div>
              )}
              {routeError && (
                <div className="flex items-center gap-2 text-sm text-red-400">
                  <XCircle className="h-4 w-4" /> {routeError}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Broker Cards */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-3">
            {brokers.map((broker) => {
              const id = String(broker.id);
              const typeStr = String(broker.broker_type);
              const statusStr = String(broker.status);
              const typeConfig = BROKER_TYPE_CONFIG[typeStr] ?? BROKER_TYPE_CONFIG.FULLSERVICE;
              const conn = broker.connectivity as Record<string, unknown> | undefined;
              const isConnected = conn?.connected === true;
              const clients = (broker.clients as Array<Record<string, unknown>>) ?? [];
              const isExpanded = expandedBroker === id;
              const permissions = broker.permissions as Record<string, unknown> | undefined;

              return (
                <div key={id} className="card !p-0 overflow-hidden">
                  <button
                    onClick={() => setExpandedBroker(isExpanded ? null : id)}
                    className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", typeConfig.bg)}>
                          <Building2 className={cn("h-5 w-5", typeConfig.color)} />
                        </div>
                        {/* Connection indicator */}
                        <div className={cn(
                          "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-900",
                          isConnected ? "bg-emerald-500" : "bg-gray-600"
                        )} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-[14px] font-bold">{String(broker.name)}</h3>
                          <span className={cn("rounded-lg px-2 py-0.5 text-[10px] font-bold", typeConfig.bg, typeConfig.color)}>
                            {typeConfig.label}
                          </span>
                          {statusStr === "PENDINGAPPROVAL" && (
                            <span className="rounded-lg px-2 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-400">
                              Pending Approval
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-gray-500 mt-0.5">
                          {id} | License: {String(broker.license_number)} | {clients.length} clients
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-5">
                      {conn && (
                        <div className="hidden md:flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-[10px] text-gray-600">Protocol</p>
                            <p className={cn("text-[12px] font-mono font-bold", PROTOCOL_COLORS[String(conn.protocol)] ?? "text-gray-400")}>
                              {String(conn.protocol)}
                            </p>
                          </div>
                          {conn.latency_us != null && (
                            <div className="text-right">
                              <p className="text-[10px] text-gray-600">Latency</p>
                              <p className="text-[12px] font-mono font-semibold">{Number(conn.latency_us)}us</p>
                            </div>
                          )}
                          <div className="text-right">
                            <p className="text-[10px] text-gray-600">Messages</p>
                            <p className="text-[12px] font-mono font-semibold">{Number(conn.messages_sent).toLocaleString()}</p>
                          </div>
                        </div>
                      )}
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-600" /> : <ChevronDown className="h-4 w-4 text-gray-600" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-white/[0.04] p-4 space-y-4">
                      {/* Connectivity Details */}
                      {conn && (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Connectivity</p>
                          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                            <div className="rounded-xl p-3" style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                              <p className="text-[10px] text-gray-600">Protocol</p>
                              <p className={cn("text-sm font-bold", PROTOCOL_COLORS[String(conn.protocol)] ?? "text-gray-400")}>{String(conn.protocol)}</p>
                            </div>
                            <div className="rounded-xl p-3" style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                              <p className="text-[10px] text-gray-600">Status</p>
                              <div className="flex items-center gap-1.5">
                                {isConnected ? <Wifi className="h-3.5 w-3.5 text-emerald-400" /> : <WifiOff className="h-3.5 w-3.5 text-gray-600" />}
                                <p className={cn("text-sm font-bold", isConnected ? "text-emerald-400" : "text-gray-500")}>{isConnected ? "Connected" : "Disconnected"}</p>
                              </div>
                            </div>
                            <div className="rounded-xl p-3" style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                              <p className="text-[10px] text-gray-600">Latency</p>
                              <p className="text-sm font-bold font-mono">{conn.latency_us != null ? `${conn.latency_us}us` : "—"}</p>
                            </div>
                            <div className="rounded-xl p-3" style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                              <p className="text-[10px] text-gray-600">Sent</p>
                              <p className="text-sm font-bold font-mono">{Number(conn.messages_sent).toLocaleString()}</p>
                            </div>
                            <div className="rounded-xl p-3" style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                              <p className="text-[10px] text-gray-600">Received</p>
                              <p className="text-sm font-bold font-mono">{Number(conn.messages_received ?? 0).toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Permissions */}
                      {permissions && (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Trading Permissions</p>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { key: "can_trade_futures", label: "Futures" },
                              { key: "can_trade_options", label: "Options" },
                              { key: "can_trade_spot", label: "Spot" },
                              { key: "can_use_algo", label: "Algo Trading" },
                            ].map(({ key, label }) => (
                              <span
                                key={key}
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold",
                                  permissions[key]
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : "bg-gray-500/10 text-gray-600"
                                )}
                              >
                                {permissions[key] ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                {label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Clients */}
                      {clients.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Registered Clients ({clients.length})</p>
                          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                            {clients.map((client) => (
                              <div key={String(client.client_id)} className="flex items-center gap-2.5 rounded-xl p-2.5" style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10">
                                  <Users className="h-3.5 w-3.5 text-blue-400" />
                                </div>
                                <div>
                                  <p className="text-[12px] font-semibold">{String(client.name)}</p>
                                  <p className="text-[10px] text-gray-600">{String(client.client_id)} | {String(client.account_id ?? "")}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
