"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useMarketStore } from "@/lib/store";
import { formatPrice, formatPercent, cn } from "@/lib/utils";

// ============================================================
// Analytics & Data Platform Dashboard
// ============================================================

type AnalyticsTab = "overview" | "geospatial" | "ai" | "reports";

const MOCK_FORECAST = [
  { symbol: "MAIZE", current: 285.5, predicted: 292.3, confidence: 0.87, direction: "up" as const, horizon: "7d" },
  { symbol: "GOLD", current: 2345.6, predicted: 2380.0, confidence: 0.72, direction: "up" as const, horizon: "7d" },
  { symbol: "COFFEE", current: 4520.0, predicted: 4485.0, confidence: 0.65, direction: "down" as const, horizon: "7d" },
  { symbol: "CRUDE_OIL", current: 78.42, predicted: 80.15, confidence: 0.78, direction: "up" as const, horizon: "7d" },
  { symbol: "WHEAT", current: 342.8, predicted: 338.5, confidence: 0.71, direction: "down" as const, horizon: "7d" },
];

const MOCK_ANOMALIES = [
  { timestamp: "2026-02-26T10:15:00Z", symbol: "COFFEE", type: "price_spike", severity: "high", description: "Unusual price spike of +3.2% in 5 minutes detected" },
  { timestamp: "2026-02-26T09:42:00Z", symbol: "MAIZE", type: "volume_surge", severity: "medium", description: "Trading volume 5x above 30-day average" },
  { timestamp: "2026-02-25T16:30:00Z", symbol: "CARBON", type: "spread_widening", severity: "low", description: "Bid-ask spread widened to 2.1% from avg 0.3%" },
];

const MOCK_GEOSPATIAL = [
  { region: "Kenya", lat: -1.286, lng: 36.817, commodity: "MAIZE", production: 4200000, price: 285.5 },
  { region: "Ethiopia", lat: 9.025, lng: 38.747, commodity: "COFFEE", production: 8900000, price: 4520.0 },
  { region: "Ghana", lat: 5.603, lng: -0.187, commodity: "COCOA", production: 1050000, price: 7850.0 },
  { region: "Tanzania", lat: -6.369, lng: 34.889, commodity: "WHEAT", production: 180000, price: 342.8 },
  { region: "Nigeria", lat: 9.082, lng: 7.491, commodity: "SOYBEAN", production: 750000, price: 1245.0 },
  { region: "South Africa", lat: -25.747, lng: 28.229, commodity: "GOLD", production: 100, price: 2345.6 },
];

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("overview");
  const { commodities } = useMarketStore();

  const tabs: { key: AnalyticsTab; label: string; icon: string }[] = [
    { key: "overview", label: "Overview", icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" },
    { key: "geospatial", label: "Geospatial", icon: "M20.893 13.393l-1.135-1.135a2.252 2.252 0 01-.421-.585l-1.08-2.16a.414.414 0 00-.663-.107.827.827 0 01-.812.21l-1.273-.363a.89.89 0 00-.738 1.595l.587.39c.59.395.674 1.23.172 1.732l-.2.2c-.212.212-.33.498-.33.796v.41c0 .409-.11.809-.32 1.158l-1.315 2.191a2.11 2.11 0 01-1.81 1.025 1.055 1.055 0 01-1.055-1.055v-1.172c0-.92-.56-1.747-1.414-2.089l-.655-.261a2.25 2.25 0 01-1.383-2.46l.007-.042a2.25 2.25 0 01.29-.787l.09-.15a2.25 2.25 0 012.37-1.048l1.178.236a1.125 1.125 0 001.302-.795l.208-.73a1.125 1.125 0 00-.578-1.315l-.665-.332-.091.091a2.25 2.25 0 01-1.591.659h-.18c-.249 0-.487.1-.662.274a.931.931 0 01-1.458-1.137l1.411-2.353a2.25 2.25 0 00.286-.76m11.928 9.869A9 9 0 008.965 3.525m11.928 9.868A9 9 0 118.965 3.525" },
    { key: "ai", label: "AI/ML Insights", icon: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" },
    { key: "reports", label: "Reports", icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" },
  ];

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <motion.div className="space-y-6 p-4 lg:p-6" variants={container} initial="hidden" animate="show">
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics & Insights</h1>
          <p className="text-sm text-gray-400">Powered by Delta Lake, Apache Spark, Flink, Sedona & Ray</p>
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <motion.div variants={item} className="flex gap-1 rounded-lg bg-surface-800 p-1" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            role="tab"
            aria-selected={activeTab === tab.key}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.key ? "bg-surface-700 text-white" : "text-gray-500 hover:text-gray-300"
            )}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </motion.div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Market Summary Cards */}
          <motion.div variants={item} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card">
              <p className="text-xs text-gray-500 uppercase">Total Market Cap</p>
              <p className="mt-1 text-2xl font-bold">$2.47B</p>
              <p className="text-xs text-up">+1.24% (24h)</p>
            </div>
            <div className="card">
              <p className="text-xs text-gray-500 uppercase">24h Volume</p>
              <p className="mt-1 text-2xl font-bold">$847M</p>
              <p className="text-xs text-up">+15.3%</p>
            </div>
            <div className="card">
              <p className="text-xs text-gray-500 uppercase">Active Traders</p>
              <p className="mt-1 text-2xl font-bold">12,847</p>
              <p className="text-xs text-gray-400">Across 42 countries</p>
            </div>
            <div className="card">
              <p className="text-xs text-gray-500 uppercase">Settlement Rate</p>
              <p className="mt-1 text-2xl font-bold">99.7%</p>
              <p className="text-xs text-gray-400">T+0 via TigerBeetle</p>
            </div>
          </motion.div>

          {/* Market Heatmap */}
          <motion.div variants={item} className="card">
            <h3 className="text-sm font-semibold mb-4">Market Heatmap</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {commodities.map((c) => {
                const isUp = c.changePercent24h >= 0;
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "rounded-lg p-3 text-center transition-colors cursor-pointer hover:opacity-80",
                      isUp ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"
                    )}
                  >
                    <p className="text-xs font-bold">{c.symbol}</p>
                    <p className="text-sm font-mono mt-1">{formatPrice(c.lastPrice)}</p>
                    <p className={cn("text-xs font-mono", isUp ? "text-up" : "text-down")}>
                      {formatPercent(c.changePercent24h)}
                    </p>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Volume Distribution */}
          <motion.div variants={item} className="card">
            <h3 className="text-sm font-semibold mb-4">Volume Distribution by Category</h3>
            <div className="space-y-3">
              {[
                { category: "Agricultural", percent: 45, color: "bg-green-500" },
                { category: "Precious Metals", percent: 25, color: "bg-yellow-500" },
                { category: "Energy", percent: 22, color: "bg-blue-500" },
                { category: "Carbon Credits", percent: 8, color: "bg-purple-500" },
              ].map((cat) => (
                <div key={cat.category}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">{cat.category}</span>
                    <span className="font-mono">{cat.percent}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-700 overflow-hidden">
                    <motion.div
                      className={cn("h-full rounded-full", cat.color)}
                      initial={{ width: 0 }}
                      animate={{ width: `${cat.percent}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* Geospatial Tab */}
      {activeTab === "geospatial" && (
        <div className="space-y-6">
          <motion.div variants={item} className="card">
            <h3 className="text-sm font-semibold mb-2">Commodity Production Regions</h3>
            <p className="text-xs text-gray-500 mb-4">Powered by Apache Sedona geospatial analytics</p>

            {/* Simplified map visualization */}
            <div className="relative rounded-lg bg-surface-900 p-4 min-h-[400px] overflow-hidden">
              {/* Africa outline (simplified SVG) */}
              <svg viewBox="0 0 400 450" className="w-full h-full opacity-20" fill="none" stroke="#334155" strokeWidth="1">
                <path d="M200 20 L250 50 L280 100 L300 150 L310 200 L320 250 L300 300 L280 350 L250 400 L200 430 L150 400 L120 350 L100 300 L90 250 L100 200 L120 150 L140 100 L170 50 Z" />
              </svg>

              {/* Data points */}
              {MOCK_GEOSPATIAL.map((point, i) => {
                // Simplified coordinate mapping for Africa
                const x = 50 + ((point.lng + 20) / 60) * 300;
                const y = 50 + ((point.lat * -1 + 10) / 40) * 350;
                return (
                  <motion.div
                    key={i}
                    className="absolute flex flex-col items-center"
                    style={{ left: `${(x / 400) * 100}%`, top: `${(y / 450) * 100}%` }}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.1, type: "spring" }}
                  >
                    <div className="relative">
                      <div className="h-4 w-4 rounded-full bg-brand-500 animate-ping absolute inset-0 opacity-30" />
                      <div className="h-4 w-4 rounded-full bg-brand-500 relative z-10 border-2 border-brand-300" />
                    </div>
                    <div className="mt-1 rounded bg-surface-800/90 px-2 py-1 text-[9px] whitespace-nowrap backdrop-blur-sm border border-surface-700">
                      <span className="font-bold">{point.region}</span>
                      <br />
                      <span className="text-gray-400">{point.commodity}</span>
                      <span className="text-brand-400 ml-1">{formatPrice(point.price)}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Regional Data Table */}
          <motion.div variants={item} className="card overflow-x-auto">
            <h3 className="text-sm font-semibold mb-4">Regional Production Data</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700 text-left text-xs text-gray-500">
                  <th className="pb-2 pr-4">Region</th>
                  <th className="pb-2 pr-4">Commodity</th>
                  <th className="pb-2 pr-4 text-right">Production (MT)</th>
                  <th className="pb-2 text-right">Spot Price</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_GEOSPATIAL.map((point, i) => (
                  <tr key={i} className="table-row">
                    <td className="py-2 pr-4 font-medium">{point.region}</td>
                    <td className="py-2 pr-4 text-gray-400">{point.commodity}</td>
                    <td className="py-2 pr-4 text-right font-mono">{point.production.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono text-brand-400">{formatPrice(point.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      )}

      {/* AI/ML Insights Tab */}
      {activeTab === "ai" && (
        <div className="space-y-6">
          {/* Price Forecasts */}
          <motion.div variants={item} className="card">
            <h3 className="text-sm font-semibold mb-2">AI Price Forecasts (7-Day)</h3>
            <p className="text-xs text-gray-500 mb-4">Powered by Ray + LSTM/Transformer models</p>

            <div className="space-y-3">
              {MOCK_FORECAST.map((f) => (
                <div key={f.symbol} className="flex items-center gap-4 rounded-lg bg-surface-900 p-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{f.symbol}</span>
                      <span className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium",
                        f.direction === "up" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                      )}>
                        {f.direction === "up" ? "BULLISH" : "BEARISH"}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs">
                      <span className="text-gray-400">Current: <span className="text-white font-mono">{formatPrice(f.current)}</span></span>
                      <svg className="h-3 w-3 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                      <span className={cn("font-mono", f.direction === "up" ? "text-up" : "text-down")}>
                        {formatPrice(f.predicted)}
                      </span>
                    </div>
                  </div>

                  {/* Confidence meter */}
                  <div className="text-center">
                    <div className="relative h-12 w-12">
                      <svg className="h-12 w-12 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#1e293b" strokeWidth="3" />
                        <circle
                          cx="18" cy="18" r="14" fill="none"
                          stroke={f.confidence > 0.75 ? "#22c55e" : f.confidence > 0.5 ? "#f59e0b" : "#ef4444"}
                          strokeWidth="3"
                          strokeDasharray={`${f.confidence * 88} ${88 - f.confidence * 88}`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
                        {Math.round(f.confidence * 100)}%
                      </span>
                    </div>
                    <span className="text-[9px] text-gray-500">Confidence</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Anomaly Detection */}
          <motion.div variants={item} className="card">
            <h3 className="text-sm font-semibold mb-2">Anomaly Detection</h3>
            <p className="text-xs text-gray-500 mb-4">Real-time market anomaly detection via Apache Flink</p>

            <div className="space-y-2">
              {MOCK_ANOMALIES.map((a, i) => (
                <div key={i} className={cn(
                  "rounded-lg border p-3",
                  a.severity === "high" ? "border-red-500/30 bg-red-500/5" :
                  a.severity === "medium" ? "border-yellow-500/30 bg-yellow-500/5" :
                  "border-blue-500/30 bg-blue-500/5"
                )}>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                      a.severity === "high" ? "bg-red-500/20 text-red-400" :
                      a.severity === "medium" ? "bg-yellow-500/20 text-yellow-400" :
                      "bg-blue-500/20 text-blue-400"
                    )}>
                      {a.severity}
                    </span>
                    <span className="text-xs font-medium">{a.symbol}</span>
                    <span className="text-[10px] text-gray-500 ml-auto">
                      {new Date(a.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">{a.description}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Sentiment Analysis */}
          <motion.div variants={item} className="card">
            <h3 className="text-sm font-semibold mb-4">Market Sentiment (NLP Analysis)</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg bg-green-500/10 p-4">
                <p className="text-3xl font-bold text-green-400">62%</p>
                <p className="text-xs text-gray-400 mt-1">Bullish</p>
              </div>
              <div className="rounded-lg bg-surface-700/50 p-4">
                <p className="text-3xl font-bold text-gray-400">24%</p>
                <p className="text-xs text-gray-400 mt-1">Neutral</p>
              </div>
              <div className="rounded-lg bg-red-500/10 p-4">
                <p className="text-3xl font-bold text-red-400">14%</p>
                <p className="text-xs text-gray-400 mt-1">Bearish</p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          <motion.div variants={item} className="card">
            <h3 className="text-sm font-semibold mb-4">Available Reports</h3>
            <div className="space-y-2">
              {[
                { title: "P&L Statement", description: "Profit and loss summary for all positions", period: "Monthly", icon: "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" },
                { title: "Tax Report", description: "Capital gains and trading income for tax filing", period: "Annual", icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" },
                { title: "Trade Confirmations", description: "Settlement confirmations for all executed trades", period: "Daily", icon: "M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.745 3.745 0 011.043 3.296A3.745 3.745 0 0121 12z" },
                { title: "Margin Report", description: "Margin requirements and utilization across positions", period: "Real-time", icon: "M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.248-8.25-3.285z" },
                { title: "Regulatory Compliance", description: "CMA Kenya and cross-border compliance reporting", period: "Quarterly", icon: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" },
              ].map((report, i) => (
                <div key={i} className="flex items-center gap-4 rounded-lg bg-surface-900 p-4 hover:bg-surface-700/50 transition-colors cursor-pointer">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600/20">
                    <svg className="h-5 w-5 text-brand-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d={report.icon} />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{report.title}</p>
                    <p className="text-xs text-gray-500">{report.description}</p>
                  </div>
                  <div className="text-right">
                    <span className="rounded bg-surface-700 px-2 py-0.5 text-[10px] text-gray-400">{report.period}</span>
                  </div>
                  <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
