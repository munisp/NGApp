"use client";

import { useEffect, useRef } from "react";
import { getMockOrderBook } from "@/lib/store";

// ============================================================
// Order Book Depth Chart Visualization
// ============================================================

interface DepthChartProps {
  symbol: string;
}

export default function DepthChart({ symbol }: DepthChartProps) {
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

    const book = getMockOrderBook(symbol);

    // Clear
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, w, h);

    if (book.bids.length === 0 || book.asks.length === 0) return;

    // Calculate cumulative volumes
    const bidCumulative: { price: number; total: number }[] = [];
    let bidTotal = 0;
    for (const level of [...book.bids].reverse()) {
      bidTotal += level.quantity;
      bidCumulative.push({ price: level.price, total: bidTotal });
    }
    bidCumulative.reverse();

    const askCumulative: { price: number; total: number }[] = [];
    let askTotal = 0;
    for (const level of book.asks) {
      askTotal += level.quantity;
      askCumulative.push({ price: level.price, total: askTotal });
    }

    const allPrices = [...bidCumulative.map((b) => b.price), ...askCumulative.map((a) => a.price)];
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRange = maxPrice - minPrice || 1;
    const maxVolume = Math.max(bidTotal, askTotal);

    const padding = { top: 20, bottom: 30, left: 10, right: 10 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    const toX = (price: number) => padding.left + ((price - minPrice) / priceRange) * chartW;
    const toY = (vol: number) => padding.top + chartH - (vol / maxVolume) * chartH;

    // Grid
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (i * chartH) / 4;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();

      const vol = maxVolume - (i * maxVolume) / 4;
      ctx.fillStyle = "#64748b";
      ctx.font = "9px monospace";
      ctx.textAlign = "left";
      ctx.fillText(vol.toFixed(0), padding.left + 2, y - 2);
    }

    // Bid side (green, left)
    ctx.beginPath();
    ctx.moveTo(toX(bidCumulative[0].price), toY(0));
    for (const level of bidCumulative) {
      ctx.lineTo(toX(level.price), toY(level.total));
    }
    ctx.lineTo(toX(bidCumulative[bidCumulative.length - 1].price), toY(0));
    ctx.closePath();

    const bidGradient = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
    bidGradient.addColorStop(0, "rgba(34, 197, 94, 0.3)");
    bidGradient.addColorStop(1, "rgba(34, 197, 94, 0.02)");
    ctx.fillStyle = bidGradient;
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < bidCumulative.length; i++) {
      const { price, total } = bidCumulative[i];
      if (i === 0) ctx.moveTo(toX(price), toY(total));
      else ctx.lineTo(toX(price), toY(total));
    }
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Ask side (red, right)
    ctx.beginPath();
    ctx.moveTo(toX(askCumulative[0].price), toY(0));
    for (const level of askCumulative) {
      ctx.lineTo(toX(level.price), toY(level.total));
    }
    ctx.lineTo(toX(askCumulative[askCumulative.length - 1].price), toY(0));
    ctx.closePath();

    const askGradient = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
    askGradient.addColorStop(0, "rgba(239, 68, 68, 0.3)");
    askGradient.addColorStop(1, "rgba(239, 68, 68, 0.02)");
    ctx.fillStyle = askGradient;
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < askCumulative.length; i++) {
      const { price, total } = askCumulative[i];
      if (i === 0) ctx.moveTo(toX(price), toY(total));
      else ctx.lineTo(toX(price), toY(total));
    }
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Mid price indicator
    const midPrice = (book.bids[0].price + book.asks[0].price) / 2;
    const midX = toX(midPrice);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(midX, padding.top);
    ctx.lineTo(midX, h - padding.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(midPrice.toFixed(2), midX, h - padding.bottom + 15);

    // Labels
    ctx.fillStyle = "#22c55e";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Bids", padding.left + 5, padding.top + 15);

    ctx.fillStyle = "#ef4444";
    ctx.textAlign = "right";
    ctx.fillText("Asks", w - padding.right - 5, padding.top + 15);
  }, [symbol]);

  return (
    <div className="rounded-lg bg-surface-900 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ display: "block", height: "200px" }}
        aria-label={`Depth chart for ${symbol}`}
        role="img"
      />
    </div>
  );
}
