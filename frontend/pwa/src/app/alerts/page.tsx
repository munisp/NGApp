"use client";

import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { useMarketStore } from "@/lib/store";
import { useMarkets, useAlerts } from "@/lib/api-hooks";
import { formatPrice, cn } from "@/lib/utils";
import {
  Bell,
  Plus,
  TrendingUp,
  TrendingDown,
  Trash2,
  BellOff,
} from "lucide-react";

export default function AlertsPage() {
  const { commodities } = useMarkets();
  const { alerts, createAlert, updateAlert, deleteAlert } = useAlerts();
  const [showForm, setShowForm] = useState(false);
  const [newSymbol, setNewSymbol] = useState("MAIZE");
  const [newCondition, setNewCondition] = useState<"above" | "below">("above");
  const [newPrice, setNewPrice] = useState("");

  const handleCreate = async () => {
    if (!newPrice) return;
    await createAlert({
      symbol: newSymbol,
      condition: newCondition,
      targetPrice: Number(newPrice),
    });
    setShowForm(false);
    setNewPrice("");
  };

  const toggleAlert = (id: string) => {
    const alert = alerts.find((a) => a.id === id);
    if (alert) updateAlert(id, { active: !alert.active });
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Price Alerts</h1>
            <p className="mt-1 text-sm text-gray-500">{alerts.filter((a) => a.active).length} active alerts</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> New Alert
          </button>
        </div>

        {/* Create Alert Form */}
        {showForm && (
          <div className="card !p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10">
                <Bell className="h-4 w-4 text-brand-400" />
              </div>
              <h3 className="text-[15px] font-semibold">Create Price Alert</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Commodity</label>
                <select
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value)}
                  className="input-field mt-1.5"
                >
                  {commodities.map((c) => (
                    <option key={c.symbol} value={c.symbol}>{c.symbol} - {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Condition</label>
                <select
                  value={newCondition}
                  onChange={(e) => setNewCondition(e.target.value as "above" | "below")}
                  className="input-field mt-1.5"
                >
                  <option value="above">Price goes above</option>
                  <option value="below">Price goes below</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Target Price</label>
                <input
                  type="number"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="input-field mt-1.5 font-mono"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
              <div className="flex items-end gap-2">
                <button onClick={handleCreate} className="btn-primary flex-1">Create</button>
                <button onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Alerts List */}
        <div className="space-y-3">
          {alerts.map((alert) => {
            const commodity = commodities.find((c) => c.symbol === alert.symbol);
            const currentPrice = commodity?.lastPrice ?? 0;
            const isTriggered = alert.condition === "above"
              ? currentPrice >= alert.targetPrice
              : currentPrice <= alert.targetPrice;
            const distancePct = Math.abs(((alert.targetPrice - currentPrice) / currentPrice) * 100);

            return (
              <div
                key={alert.id}
                className={cn(
                  "group flex items-center justify-between rounded-2xl p-4 transition-all",
                  !alert.active && "opacity-40"
                )}
                style={{
                  background: "linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.7))",
                  border: "1px solid rgba(255, 255, 255, 0.04)",
                }}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    alert.condition === "above" ? "bg-emerald-500/10" : "bg-red-500/10"
                  )}>
                    {alert.condition === "above"
                      ? <TrendingUp className="h-5 w-5 text-emerald-400" />
                      : <TrendingDown className="h-5 w-5 text-red-400" />}
                  </div>
                  <div>
                    <p className="text-[15px] font-bold">{alert.symbol}</p>
                    <p className="text-xs text-gray-400">
                      Alert when price {alert.condition === "above" ? "rises above" : "drops below"}{" "}
                      <span className="font-mono font-semibold text-white">{formatPrice(alert.targetPrice)}</span>
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-gray-600">
                      <span>Current: <span className="font-mono text-gray-400">{formatPrice(currentPrice)}</span></span>
                      <span className="opacity-40">|</span>
                      {isTriggered ? (
                        <span className="font-semibold text-amber-400">Condition met!</span>
                      ) : (
                        <span>{distancePct.toFixed(2)}% away</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleAlert(alert.id)}
                    className={cn(
                      "toggle-switch",
                      alert.active ? "bg-brand-600" : "bg-surface-700"
                    )}
                  >
                    <span className={cn(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform shadow-sm",
                      alert.active ? "left-[22px]" : "left-0.5"
                    )} />
                  </button>
                  <button
                    onClick={() => deleteAlert(alert.id)}
                    className="rounded-lg p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {alerts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-600">
            <BellOff className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No alerts set</p>
            <p className="text-xs mt-1">Create a price alert to get notified when a commodity reaches your target</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
