"use client";

import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { useMarketStore } from "@/lib/store";
import { formatPrice, cn } from "@/lib/utils";

interface Alert {
  id: string;
  symbol: string;
  condition: "above" | "below";
  targetPrice: number;
  active: boolean;
  createdAt: string;
}

export default function AlertsPage() {
  const { commodities } = useMarketStore();
  const [alerts, setAlerts] = useState<Alert[]>([
    { id: "a1", symbol: "MAIZE", condition: "above", targetPrice: 290.00, active: true, createdAt: "2026-02-25T10:00:00Z" },
    { id: "a2", symbol: "GOLD", condition: "below", targetPrice: 2300.00, active: true, createdAt: "2026-02-24T15:00:00Z" },
    { id: "a3", symbol: "CRUDE_OIL", condition: "above", targetPrice: 80.00, active: false, createdAt: "2026-02-23T09:00:00Z" },
  ]);

  const [showForm, setShowForm] = useState(false);
  const [newSymbol, setNewSymbol] = useState("MAIZE");
  const [newCondition, setNewCondition] = useState<"above" | "below">("above");
  const [newPrice, setNewPrice] = useState("");

  const handleCreate = () => {
    if (!newPrice) return;
    const alert: Alert = {
      id: `a${Date.now()}`,
      symbol: newSymbol,
      condition: newCondition,
      targetPrice: Number(newPrice),
      active: true,
      createdAt: new Date().toISOString(),
    };
    setAlerts([alert, ...alerts]);
    setShowForm(false);
    setNewPrice("");
  };

  const toggleAlert = (id: string) => {
    setAlerts(alerts.map((a) => a.id === id ? { ...a, active: !a.active } : a));
  };

  const deleteAlert = (id: string) => {
    setAlerts(alerts.filter((a) => a.id !== id));
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Price Alerts</h1>
            <p className="text-sm text-gray-400">{alerts.filter((a) => a.active).length} active alerts</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            + New Alert
          </button>
        </div>

        {/* Create Alert Form */}
        {showForm && (
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold">Create Price Alert</h3>
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Commodity</label>
                <select
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value)}
                  className="input-field mt-1"
                >
                  {commodities.map((c) => (
                    <option key={c.symbol} value={c.symbol}>{c.symbol} - {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Condition</label>
                <select
                  value={newCondition}
                  onChange={(e) => setNewCondition(e.target.value as "above" | "below")}
                  className="input-field mt-1"
                >
                  <option value="above">Price goes above</option>
                  <option value="below">Price goes below</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Target Price</label>
                <input
                  type="number"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="input-field mt-1 font-mono"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
              <div className="flex items-end gap-2">
                <button onClick={handleCreate} className="btn-primary flex-1">Create</button>
                <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
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

            return (
              <div key={alert.id} className={cn(
                "card flex items-center justify-between",
                !alert.active && "opacity-50"
              )}>
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg text-lg",
                    alert.condition === "above" ? "bg-up/20" : "bg-down/20"
                  )}>
                    {alert.condition === "above" ? "↑" : "↓"}
                  </div>
                  <div>
                    <p className="font-bold">{alert.symbol}</p>
                    <p className="text-xs text-gray-400">
                      Alert when price {alert.condition === "above" ? "rises above" : "drops below"}{" "}
                      <span className="font-mono font-medium text-white">{formatPrice(alert.targetPrice)}</span>
                    </p>
                    <p className="text-[10px] text-gray-600">
                      Current: {formatPrice(currentPrice)} &middot;{" "}
                      {isTriggered ? (
                        <span className="text-yellow-400">Condition met!</span>
                      ) : (
                        <span>
                          {Math.abs(((alert.targetPrice - currentPrice) / currentPrice) * 100).toFixed(2)}% away
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleAlert(alert.id)}
                    className={cn(
                      "relative h-6 w-11 rounded-full transition-colors",
                      alert.active ? "bg-brand-600" : "bg-surface-700"
                    )}
                  >
                    <span className={cn(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                      alert.active ? "left-[22px]" : "left-0.5"
                    )} />
                  </button>
                  <button
                    onClick={() => deleteAlert(alert.id)}
                    className="text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {alerts.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">No alerts set</p>
            <p className="text-sm mt-1">Create a price alert to get notified when a commodity reaches your target price</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
