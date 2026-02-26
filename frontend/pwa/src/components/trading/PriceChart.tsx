"use client";

import { useEffect, useRef, useState } from "react";
import { generateMockCandles, cn } from "@/lib/utils";

interface PriceChartProps {
  symbol: string;
  basePrice: number;
}

type TimeFrame = "1m" | "5m" | "15m" | "1H" | "4H" | "1D" | "1W";

export default function PriceChart({ symbol, basePrice }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("1H");
  const [chartType, setChartType] = useState<"candles" | "line">("candles");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    const candles = generateMockCandles(80, basePrice);
    const allPrices = candles.flatMap((c) => [c.high, c.low]);
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRange = maxPrice - minPrice || 1;

    const toY = (price: number) => h - 30 - ((price - minPrice) / priceRange) * (h - 50);
    const candleWidth = Math.max(2, (w - 60) / candles.length - 1);

    // Clear
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 5; i++) {
      const y = 20 + (i * (h - 50)) / 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      const price = maxPrice - (i * priceRange) / 4;
      ctx.fillStyle = "#64748b";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.fillText(price.toFixed(2), w - 5, y - 3);
    }

    if (chartType === "candles") {
      candles.forEach((candle, i) => {
        const x = 10 + i * (candleWidth + 1);
        const isUp = candle.close >= candle.open;

        // Wick
        ctx.strokeStyle = isUp ? "#22c55e" : "#ef4444";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + candleWidth / 2, toY(candle.high));
        ctx.lineTo(x + candleWidth / 2, toY(candle.low));
        ctx.stroke();

        // Body
        ctx.fillStyle = isUp ? "#22c55e" : "#ef4444";
        const bodyTop = toY(Math.max(candle.open, candle.close));
        const bodyBottom = toY(Math.min(candle.open, candle.close));
        const bodyHeight = Math.max(1, bodyBottom - bodyTop);
        ctx.fillRect(x, bodyTop, candleWidth, bodyHeight);
      });
    } else {
      // Line chart
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      candles.forEach((candle, i) => {
        const x = 10 + i * (candleWidth + 1) + candleWidth / 2;
        const y = toY(candle.close);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Gradient fill
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, "rgba(34, 197, 94, 0.15)");
      gradient.addColorStop(1, "rgba(34, 197, 94, 0)");
      ctx.lineTo(10 + (candles.length - 1) * (candleWidth + 1) + candleWidth / 2, h - 30);
      ctx.lineTo(10 + candleWidth / 2, h - 30);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // Volume bars at bottom
    const maxVol = Math.max(...candles.map((c) => c.volume));
    candles.forEach((candle, i) => {
      const x = 10 + i * (candleWidth + 1);
      const volHeight = (candle.volume / maxVol) * 25;
      const isUp = candle.close >= candle.open;
      ctx.fillStyle = isUp ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)";
      ctx.fillRect(x, h - volHeight, candleWidth, volHeight);
    });
  }, [symbol, basePrice, timeFrame, chartType]);

  const timeFrames: TimeFrame[] = ["1m", "5m", "15m", "1H", "4H", "1D", "1W"];

  return (
    <div className="flex flex-col h-full" ref={containerRef}>
      {/* Chart controls */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          {timeFrames.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeFrame(tf)}
              className={cn(
                "rounded px-2 py-1 text-[10px] font-medium transition-colors",
                timeFrame === tf ? "bg-surface-700 text-white" : "text-gray-500 hover:text-gray-300"
              )}
            >
              {tf}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
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
        </div>
      </div>

      {/* Canvas chart */}
      <div className="flex-1 rounded-lg bg-surface-900 overflow-hidden min-h-[300px]">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ display: "block" }}
        />
      </div>
    </div>
  );
}
