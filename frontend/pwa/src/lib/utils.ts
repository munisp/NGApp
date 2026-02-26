import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(price);
}

export function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) return `${(volume / 1_000_000_000).toFixed(1)}B`;
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(1)}M`;
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(1)}K`;
  return volume.toFixed(0);
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function formatTimeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function getPriceColorClass(change: number): string {
  if (change > 0) return "price-up";
  if (change < 0) return "price-down";
  return "text-gray-400";
}

export function getCategoryIcon(category: string): string {
  switch (category) {
    case "agricultural": return "🌾";
    case "precious_metals": return "🥇";
    case "energy": return "⚡";
    case "carbon_credits": return "🌿";
    default: return "📦";
  }
}

export function generateMockCandles(count: number, basePrice: number): Array<{
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}> {
  const candles = [];
  let price = basePrice;
  const now = Math.floor(Date.now() / 1000);

  for (let i = count; i > 0; i--) {
    const open = price;
    const change = (Math.random() - 0.48) * basePrice * 0.02;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * basePrice * 0.005;
    const low = Math.min(open, close) - Math.random() * basePrice * 0.005;
    const volume = Math.floor(Math.random() * 10000) + 1000;

    candles.push({
      time: now - i * 3600,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });

    price = close;
  }

  return candles;
}
