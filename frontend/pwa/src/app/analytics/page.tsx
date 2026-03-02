"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useMarketStore } from "@/lib/store";
import { useAnalyticsDashboard, usePnLReport, useGeospatial, useAIInsights, usePriceForecast } from "@/lib/api-hooks";
import { formatPrice, formatPercent, cn } from "@/lib/utils";
import {
  BarChart3,
  Globe2,
  Sparkles,
  FileText,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Download,
  Users,
  Zap,
  ShieldCheck,
  AlertTriangle,
  Activity,
  MapPin,
} from "lucide-react";

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
  { timestamp: "2026-02-26T10:15:00Z", symbol: "COFFEE", type: "price_spike", severity: "high" as const, description: "Unusual price spike of +3.2% in 5 minutes detected" },
  { timestamp: "2026-02-26T09:42:00Z", symbol: "MAIZE", type: "volume_surge", severity: "medium" as const, description: "Trading volume 5x above 30-day average" },
  { timestamp: "2026-02-25T16:30:00Z", symbol: "CARBON", type: "spread_widening", severity: "low" as const, description: "Bid-ask spread widened to 2.1% from avg 0.3%" },
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
  const { data: dashboardData } = useAnalyticsDashboard();
  const { data: insightsData } = useAIInsights();
  const { data: geospatialRaw } = useGeospatial("MAIZE");

  // Use API data with fallback to mock
  const dashboard = dashboardData as Record<string, unknown> | null;
  const insights = insightsData as Record<string, unknown> | null;
  const geospatial = geospatialRaw as Record<string, unknown> | null;
  const forecasts = (insights?.forecasts as typeof MOCK_FORECAST) ?? MOCK_FORECAST;
  const anomalies = (insights?.anomalies as typeof MOCK_ANOMALIES) ?? MOCK_ANOMALIES;
  const geospatialData = (geospatial?.regions as typeof MOCK_GEOSPATIAL) ?? MOCK_GEOSPATIAL;
  const sentiment = (insights?.sentiment as { bullish: number; neutral: number; bearish: number }) ?? { bullish: 62, neutral: 24, bearish: 14 };

  const tabs: { key: AnalyticsTab; label: string; icon: typeof BarChart3 }[] = [
    { key: "overview", label: "Overview", icon: BarChart3 },
    { key: "geospatial", label: "Geospatial", icon: Globe2 },
    { key: "ai", label: "AI/ML Insights", icon: Sparkles },
    { key: "reports", label: "Reports", icon: FileText },
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
      <motion.div variants={item} className="flex gap-1 rounded-xl p-1" style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.03)" }} role="tablist">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              role="tab"
              aria-selected={activeTab === tab.key}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-all",
                activeTab === tab.key
                  ? "text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-400"
              )}
              style={activeTab === tab.key ? {
                background: "linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))",
                border: "1px solid rgba(255, 255, 255, 0.06)",
              } : undefined}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </motion.div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Market Summary Cards */}
          <motion.div variants={item} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total Market Cap", value: dashboard?.marketCap ? `$${(Number(dashboard.marketCap) / 1e9).toFixed(2)}B` : "$2.47B", change: "+1.24% (24h)", icon: BarChart3, color: "brand" },
              { label: "24h Volume", value: dashboard?.volume24h ? `$${(Number(dashboard.volume24h) / 1e6).toFixed(0)}M` : "$847M", change: "+15.3%", icon: Activity, color: "blue" },
              { label: "Active Traders", value: (dashboard?.activeTraders as number)?.toLocaleString() ?? "12,847", sub: `Across ${dashboard?.activePairs ?? 42} pairs`, icon: Users, color: "purple" },
              { label: "Settlement Rate", value: "99.7%", sub: "T+0 via TigerBeetle", icon: Zap, color: "amber" },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="card !p-4">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg",
                      stat.color === "brand" ? "bg-brand-500/10" :
                      stat.color === "blue" ? "bg-blue-500/10" :
                      stat.color === "purple" ? "bg-purple-500/10" : "bg-amber-500/10"
                    )}>
                      <Icon className={cn(
                        "h-4 w-4",
                        stat.color === "brand" ? "text-brand-400" :
                        stat.color === "blue" ? "text-blue-400" :
                        stat.color === "purple" ? "text-purple-400" : "text-amber-400"
                      )} />
                    </div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{stat.label}</p>
                  </div>
                  <p className="text-2xl font-bold font-mono">{stat.value}</p>
                  {stat.change && <p className="text-xs text-emerald-400 mt-0.5">{stat.change}</p>}
                  {stat.sub && <p className="text-xs text-gray-500 mt-0.5">{stat.sub}</p>}
                </div>
              );
            })}
          </motion.div>

          {/* Market Heatmap */}
          <motion.div variants={item} className="card">
            <h3 className="text-[15px] font-semibold mb-4">Market Heatmap</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {commodities.map((c) => {
                const isUp = c.changePercent24h >= 0;
                return (
                  <div
                    key={c.id}
                    className="rounded-xl p-3 text-center transition-all cursor-pointer hover:-translate-y-0.5"
                    style={{
                      background: isUp
                        ? "linear-gradient(135deg, rgba(16, 185, 129, 0.06), rgba(16, 185, 129, 0.02))"
                        : "linear-gradient(135deg, rgba(239, 68, 68, 0.06), rgba(239, 68, 68, 0.02))",
                      border: isUp
                        ? "1px solid rgba(16, 185, 129, 0.1)"
                        : "1px solid rgba(239, 68, 68, 0.1)",
                    }}
                  >
                    <p className="text-[11px] font-bold">{c.symbol}</p>
                    <p className="text-sm font-mono mt-1">{formatPrice(c.lastPrice)}</p>
                    <p className={cn("text-[11px] font-mono font-semibold", isUp ? "text-emerald-400" : "text-red-400")}>
                      {formatPercent(c.changePercent24h)}
                    </p>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Volume Distribution */}
          <motion.div variants={item} className="card">
            <h3 className="text-[15px] font-semibold mb-4">Volume Distribution by Category</h3>
            <div className="space-y-3">
              {[
                { category: "Agricultural", percent: 45, gradient: "from-emerald-500 to-green-400" },
                { category: "Precious Metals", percent: 25, gradient: "from-amber-500 to-yellow-400" },
                { category: "Energy", percent: 22, gradient: "from-blue-500 to-cyan-400" },
                { category: "Carbon Credits", percent: 8, gradient: "from-purple-500 to-violet-400" },
              ].map((cat) => (
                <div key={cat.category}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-400">{cat.category}</span>
                    <span className="font-mono font-semibold">{cat.percent}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <motion.div
                      className={cn("h-full rounded-full bg-gradient-to-r", cat.gradient)}
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
            <div className="flex items-center gap-2.5 mb-2">
              <Globe2 className="h-4 w-4 text-brand-400" />
              <h3 className="text-[15px] font-semibold">Commodity Production Regions</h3>
            </div>
            <p className="text-xs text-gray-600 mb-4">Powered by Apache Sedona geospatial analytics</p>

            {/* Simplified map visualization */}
            <div className="relative rounded-xl p-4 min-h-[400px] overflow-hidden" style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.03)" }}>
              {/* Africa outline (simplified SVG) */}
              <svg viewBox="0 0 400 450" className="w-full h-full opacity-[0.08]" fill="none" stroke="#334155" strokeWidth="1">
                <path d="M200 20 L250 50 L280 100 L300 150 L310 200 L320 250 L300 300 L280 350 L250 400 L200 430 L150 400 L120 350 L100 300 L90 250 L100 200 L120 150 L140 100 L170 50 Z" />
              </svg>

              {/* Data points */}
              {geospatialData.map((point: typeof MOCK_GEOSPATIAL[number], i: number) => {
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
                    <div className="mt-1 rounded-lg px-2 py-1 text-[9px] whitespace-nowrap backdrop-blur-md"
                      style={{ background: "rgba(15, 23, 42, 0.85)", border: "1px solid rgba(255, 255, 255, 0.06)" }}
                    >
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
            <h3 className="text-[15px] font-semibold mb-4">Regional Production Data</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider" style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                  <th className="pb-2.5 pr-4">Region</th>
                  <th className="pb-2.5 pr-4">Commodity</th>
                  <th className="pb-2.5 pr-4 text-right">Production (MT)</th>
                  <th className="pb-2.5 text-right">Spot Price</th>
                </tr>
              </thead>
              <tbody>
                {geospatialData.map((point: typeof MOCK_GEOSPATIAL[number], i: number) => (
                  <tr key={i} className="table-row">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-gray-600" />
                        <span className="font-medium">{point.region}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-400">{point.commodity}</td>
                    <td className="py-2.5 pr-4 text-right font-mono">{point.production.toLocaleString()}</td>
                    <td className="py-2.5 text-right font-mono text-brand-400">{formatPrice(point.price)}</td>
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
            <div className="flex items-center gap-2.5 mb-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <h3 className="text-[15px] font-semibold">AI Price Forecasts (7-Day)</h3>
            </div>
            <p className="text-xs text-gray-600 mb-4">Powered by Ray + LSTM/Transformer models</p>

            <div className="space-y-3">
              {forecasts.map((f: typeof MOCK_FORECAST[number]) => (
                <div key={f.symbol} className="flex items-center gap-4 rounded-xl p-3.5"
                  style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.03)" }}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{f.symbol}</span>
                      <span className={cn(
                        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                        f.direction === "up" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                      )}>
                        {f.direction === "up" ? "BULLISH" : "BEARISH"}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs">
                      <span className="text-gray-500">Current: <span className="text-white font-mono">{formatPrice(f.current)}</span></span>
                      <ArrowRight className="h-3 w-3 text-gray-600" />
                      <span className={cn("font-mono font-semibold", f.direction === "up" ? "text-emerald-400" : "text-red-400")}>
                        {formatPrice(f.predicted)}
                      </span>
                    </div>
                  </div>

                  {/* Confidence meter */}
                  <div className="text-center">
                    <div className="relative h-12 w-12">
                      <svg className="h-12 w-12 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="3" />
                        <circle
                          cx="18" cy="18" r="14" fill="none"
                          stroke={f.confidence > 0.75 ? "#10b981" : f.confidence > 0.5 ? "#f59e0b" : "#ef4444"}
                          strokeWidth="3"
                          strokeDasharray={`${f.confidence * 88} ${88 - f.confidence * 88}`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
                        {Math.round(f.confidence * 100)}%
                      </span>
                    </div>
                    <span className="text-[9px] text-gray-600">Confidence</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Anomaly Detection */}
          <motion.div variants={item} className="card">
            <div className="flex items-center gap-2.5 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <h3 className="text-[15px] font-semibold">Anomaly Detection</h3>
            </div>
            <p className="text-xs text-gray-600 mb-4">Real-time market anomaly detection via Apache Flink</p>

            <div className="space-y-2">
              {anomalies.map((a: typeof MOCK_ANOMALIES[number], i: number) => (
                <div key={i} className={cn(
                  "rounded-xl p-3",
                  a.severity === "high" ? "bg-red-500/[0.04]" :
                  a.severity === "medium" ? "bg-amber-500/[0.04]" :
                  "bg-blue-500/[0.04]"
                )}
                  style={{
                    border: a.severity === "high" ? "1px solid rgba(239, 68, 68, 0.1)" :
                      a.severity === "medium" ? "1px solid rgba(245, 158, 11, 0.1)" :
                      "1px solid rgba(59, 130, 246, 0.1)"
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase",
                      a.severity === "high" ? "bg-red-500/15 text-red-400" :
                      a.severity === "medium" ? "bg-amber-500/15 text-amber-400" :
                      "bg-blue-500/15 text-blue-400"
                    )}>
                      {a.severity}
                    </span>
                    <span className="text-xs font-medium">{a.symbol}</span>
                    <span className="text-[10px] text-gray-500 ml-auto">
                      {new Date(a.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{a.description}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Sentiment Analysis */}
          <motion.div variants={item} className="card">
            <h3 className="text-[15px] font-semibold mb-4">Market Sentiment (NLP Analysis)</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl p-4" style={{ background: "rgba(16, 185, 129, 0.04)", border: "1px solid rgba(16, 185, 129, 0.08)" }}>
                <TrendingUp className="h-5 w-5 text-emerald-400 mx-auto mb-1.5" />
                <p className="text-3xl font-bold text-emerald-400 font-mono">{sentiment.bullish}%</p>
                <p className="text-[11px] text-gray-500 mt-1">Bullish</p>
              </div>
              <div className="rounded-xl p-4" style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                <Activity className="h-5 w-5 text-gray-500 mx-auto mb-1.5" />
                <p className="text-3xl font-bold text-gray-400 font-mono">{sentiment.neutral}%</p>
                <p className="text-[11px] text-gray-500 mt-1">Neutral</p>
              </div>
              <div className="rounded-xl p-4" style={{ background: "rgba(239, 68, 68, 0.04)", border: "1px solid rgba(239, 68, 68, 0.08)" }}>
                <TrendingDown className="h-5 w-5 text-red-400 mx-auto mb-1.5" />
                <p className="text-3xl font-bold text-red-400 font-mono">{sentiment.bearish}%</p>
                <p className="text-[11px] text-gray-500 mt-1">Bearish</p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          <motion.div variants={item} className="card">
            <h3 className="text-[15px] font-semibold mb-4">Available Reports</h3>
            <div className="space-y-2">
              {[
                { title: "P&L Statement", description: "Profit and loss summary for all positions", period: "Monthly", icon: TrendingUp },
                { title: "Tax Report", description: "Capital gains and trading income for tax filing", period: "Annual", icon: FileText },
                { title: "Trade Confirmations", description: "Settlement confirmations for all executed trades", period: "Daily", icon: ShieldCheck },
                { title: "Margin Report", description: "Margin requirements and utilization across positions", period: "Real-time", icon: AlertTriangle },
                { title: "Regulatory Compliance", description: "CMA Kenya and cross-border compliance reporting", period: "Quarterly", icon: ShieldCheck },
              ].map((report, i) => {
                const Icon = report.icon;
                return (
                  <div key={i} className="flex items-center gap-4 rounded-xl p-4 transition-all cursor-pointer hover:-translate-y-0.5"
                    style={{
                      background: "linear-gradient(135deg, rgba(15, 23, 42, 0.5), rgba(15, 23, 42, 0.3))",
                      border: "1px solid rgba(255, 255, 255, 0.03)",
                    }}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10">
                      <Icon className="h-5 w-5 text-brand-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{report.title}</p>
                      <p className="text-xs text-gray-500">{report.description}</p>
                    </div>
                    <div className="text-right">
                      <span className="rounded-md px-2 py-0.5 text-[10px] font-medium text-gray-500"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.04)" }}
                      >{report.period}</span>
                    </div>
                    <Download className="h-4 w-4 text-gray-600" />
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
