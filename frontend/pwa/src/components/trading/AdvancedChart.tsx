"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, type IChartApi, type ISeriesApi, type CandlestickData, type LineData, type HistogramData, ColorType, CrosshairMode } from "lightweight-charts";
import { generateMockCandles, cn } from "@/lib/utils";

// ============================================================
// Advanced Chart with lightweight-charts (TradingView)
// ============================================================

interface AdvancedChartProps {
  symbol: string;
  basePrice: number;
}

type TimeFrame = "1m" | "5m" | "15m" | "1H" | "4H" | "1D" | "1W";
type ChartType = "candles" | "line";
type Indicator = "MA20" | "MA50" | "RSI" | "MACD" | "BB";

export default function AdvancedChart({ symbol, basePrice }: AdvancedChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const indicatorSeriesRefs = useRef<Map<string, ISeriesApi<"Line">>>(new Map());

  const [timeFrame, setTimeFrame] = useState<TimeFrame>("1H");
  const [chartType, setChartType] = useState<ChartType>("candles");
  const [activeIndicators, setActiveIndicators] = useState<Set<Indicator>>(new Set(["MA20"]));
  const [showIndicatorMenu, setShowIndicatorMenu] = useState(false);

  // Calculate indicators
  const calcMA = useCallback((data: { close: number; time: string }[], period: number): LineData[] => {
    const result: LineData[] = [];
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b.close, 0);
      result.push({ time: data[i].time as unknown as LineData["time"], value: sum / period });
    }
    return result;
  }, []);

  const calcBollingerBands = useCallback((data: { close: number; time: string }[], period = 20, stdDev = 2) => {
    const upper: LineData[] = [];
    const lower: LineData[] = [];
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b.close, 0) / period;
      const variance = slice.reduce((a, b) => a + Math.pow(b.close - mean, 2), 0) / period;
      const std = Math.sqrt(variance);
      upper.push({ time: data[i].time as unknown as LineData["time"], value: mean + stdDev * std });
      lower.push({ time: data[i].time as unknown as LineData["time"], value: mean - stdDev * std });
    }
    return { upper, lower };
  }, []);

  // Initialize chart
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "#020617" },
        textColor: "#64748b",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#1e293b" },
        horzLines: { color: "#1e293b" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#334155", width: 1, style: 2, labelBackgroundColor: "#16a34a" },
        horzLine: { color: "#334155", width: 1, style: 2, labelBackgroundColor: "#16a34a" },
      },
      rightPriceScale: {
        borderColor: "#1e293b",
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: "#1e293b",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    chartRef.current = chart;

    // Generate data
    const candles = generateMockCandles(200, basePrice);
    const now = new Date();

    const chartData = candles.map((c, i) => ({
      time: new Date(now.getTime() - (candles.length - i) * 3600000).toISOString().split("T")[0],
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));

    // Main series
    if (chartType === "candles") {
      const candleSeries = chart.addCandlestickSeries({
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderUpColor: "#22c55e",
        borderDownColor: "#ef4444",
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });
      candleSeries.setData(
        chartData.map((d) => ({
          time: d.time as unknown as CandlestickData["time"],
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        }))
      );
      candleSeriesRef.current = candleSeries;
    } else {
      const lineSeries = chart.addLineSeries({
        color: "#22c55e",
        lineWidth: 2,
      });
      lineSeries.setData(
        chartData.map((d) => ({
          time: d.time as unknown as LineData["time"],
          value: d.close,
        }))
      );
      lineSeriesRef.current = lineSeries;
    }

    // Volume
    const volumeSeries = chart.addHistogramSeries({
      color: "#334155",
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeries.setData(
      chartData.map((d) => ({
        time: d.time as unknown as HistogramData["time"],
        value: d.volume,
        color: d.close >= d.open ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)",
      }))
    );
    volumeSeriesRef.current = volumeSeries;

    // Indicators
    const closeData = chartData.map((d) => ({ close: d.close, time: d.time }));

    if (activeIndicators.has("MA20")) {
      const ma20Series = chart.addLineSeries({ color: "#f59e0b", lineWidth: 1 });
      ma20Series.setData(calcMA(closeData, 20));
      indicatorSeriesRefs.current.set("MA20", ma20Series);
    }

    if (activeIndicators.has("MA50")) {
      const ma50Series = chart.addLineSeries({ color: "#8b5cf6", lineWidth: 1 });
      ma50Series.setData(calcMA(closeData, 50));
      indicatorSeriesRefs.current.set("MA50", ma50Series);
    }

    if (activeIndicators.has("BB")) {
      const { upper, lower } = calcBollingerBands(closeData);
      const bbUpper = chart.addLineSeries({ color: "#06b6d4", lineWidth: 1, lineStyle: 2 });
      const bbLower = chart.addLineSeries({ color: "#06b6d4", lineWidth: 1, lineStyle: 2 });
      bbUpper.setData(upper);
      bbLower.setData(lower);
      indicatorSeriesRefs.current.set("BB_upper", bbUpper);
      indicatorSeriesRefs.current.set("BB_lower", bbLower);
    }

    chart.timeScale().fitContent();

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      indicatorSeriesRefs.current.clear();
      chart.remove();
      chartRef.current = null;
    };
  }, [symbol, basePrice, timeFrame, chartType, activeIndicators, calcMA, calcBollingerBands]);

  const toggleIndicator = (ind: Indicator) => {
    setActiveIndicators((prev) => {
      const next = new Set(prev);
      if (next.has(ind)) next.delete(ind);
      else next.add(ind);
      return next;
    });
  };

  const timeFrames: TimeFrame[] = ["1m", "5m", "15m", "1H", "4H", "1D", "1W"];
  const indicators: { key: Indicator; label: string; color: string }[] = [
    { key: "MA20", label: "MA(20)", color: "text-yellow-400" },
    { key: "MA50", label: "MA(50)", color: "text-purple-400" },
    { key: "BB", label: "Bollinger", color: "text-cyan-400" },
    { key: "RSI", label: "RSI", color: "text-pink-400" },
    { key: "MACD", label: "MACD", color: "text-orange-400" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Chart controls */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        {/* Time frames */}
        <div className="flex items-center gap-1">
          {timeFrames.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeFrame(tf)}
              className={cn(
                "rounded px-2 py-1 text-[10px] font-medium transition-colors",
                timeFrame === tf ? "bg-surface-700 text-white" : "text-gray-500 hover:text-gray-300"
              )}
              aria-label={`Set timeframe to ${tf}`}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {/* Chart type */}
          <button
            onClick={() => setChartType("candles")}
            className={cn(
              "rounded px-2 py-1 text-[10px]",
              chartType === "candles" ? "bg-surface-700 text-white" : "text-gray-500"
            )}
          >
            Candles
          </button>
          <button
            onClick={() => setChartType("line")}
            className={cn(
              "rounded px-2 py-1 text-[10px]",
              chartType === "line" ? "bg-surface-700 text-white" : "text-gray-500"
            )}
          >
            Line
          </button>

          <div className="w-px h-4 bg-surface-700 mx-1" />

          {/* Indicators */}
          <div className="relative">
            <button
              onClick={() => setShowIndicatorMenu(!showIndicatorMenu)}
              className="rounded px-2 py-1 text-[10px] text-gray-500 hover:text-white hover:bg-surface-700 transition-colors flex items-center gap-1"
              aria-expanded={showIndicatorMenu}
              aria-haspopup="true"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              Indicators
            </button>

            {showIndicatorMenu && (
              <div className="absolute right-0 top-full mt-1 z-20 rounded-lg bg-surface-800 border border-surface-700 shadow-xl p-2 min-w-[160px]">
                {indicators.map((ind) => (
                  <button
                    key={ind.key}
                    onClick={() => toggleIndicator(ind.key)}
                    className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-xs hover:bg-surface-700 transition-colors"
                  >
                    <span className={cn("h-2 w-2 rounded-full", activeIndicators.has(ind.key) ? ind.color.replace("text-", "bg-") : "bg-surface-700")} />
                    <span className={activeIndicators.has(ind.key) ? "text-white" : "text-gray-500"}>{ind.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active indicator pills */}
      {activeIndicators.size > 0 && (
        <div className="flex gap-1 mb-1">
          {Array.from(activeIndicators).map((ind) => {
            const config = indicators.find((i) => i.key === ind);
            return (
              <span
                key={ind}
                className={cn("rounded px-1.5 py-0.5 text-[9px] font-medium", config?.color || "text-gray-400", "bg-surface-700/50")}
              >
                {config?.label || ind}
              </span>
            );
          })}
        </div>
      )}

      {/* Chart container */}
      <div ref={chartContainerRef} className="flex-1 rounded-lg overflow-hidden min-h-[300px]" />
    </div>
  );
}
