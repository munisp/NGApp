"use client";

import { useState, useEffect, useMemo } from "react";
import { getMockOrderBook } from "@/lib/store";
import { formatPrice, formatVolume } from "@/lib/utils";
import { api } from "@/lib/api-client";

interface OrderBookProps {
  symbol: string;
  onPriceClick?: (price: number) => void;
}

interface BookLevel {
  price: number;
  quantity: number;
  total: number;
}

interface BookData {
  bids: BookLevel[];
  asks: BookLevel[];
  spread: string;
  spreadPercent: string;
}

export default function OrderBookView({ symbol, onPriceClick }: OrderBookProps) {
  const mockBook = useMemo(() => {
    const raw = getMockOrderBook(symbol);
    return {
      bids: raw.bids,
      asks: raw.asks,
      spread: String(raw.spread),
      spreadPercent: String(raw.spreadPercent),
    };
  }, [symbol]);
  const [book, setBook] = useState<BookData>(mockBook);

  // Fetch orderbook from API, fall back to mock
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.markets.orderbook(symbol);
        const data = res as Record<string, unknown>;
        const apiBook = (data?.data ?? data) as Record<string, unknown>;
        if (mounted && apiBook?.bids && apiBook?.asks) {
          const bids = apiBook.bids as BookLevel[];
          const asks = apiBook.asks as BookLevel[];
          // Calculate running totals if not present
          let bidRunning = 0;
          const bidsWithTotal = bids.map(b => {
            bidRunning += b.quantity;
            return { ...b, total: b.total || bidRunning };
          });
          let askRunning = 0;
          const asksWithTotal = asks.map(a => {
            askRunning += a.quantity;
            return { ...a, total: a.total || askRunning };
          });
          const spread = bidsWithTotal[0] && asksWithTotal[0]
            ? (asksWithTotal[0].price - bidsWithTotal[0].price).toFixed(2)
            : "0.00";
          const spreadPct = bidsWithTotal[0] && asksWithTotal[0]
            ? ((asksWithTotal[0].price - bidsWithTotal[0].price) / asksWithTotal[0].price * 100).toFixed(2)
            : "0.00";
          setBook({ bids: bidsWithTotal, asks: asksWithTotal, spread, spreadPercent: spreadPct });
          return;
        }
      } catch {
        // Fall back to mock data
      }
      if (mounted) {
        setBook({
          bids: mockBook.bids,
          asks: mockBook.asks,
          spread: String(mockBook.spread),
          spreadPercent: String(mockBook.spreadPercent),
        });
      }
    })();
    return () => { mounted = false; };
  }, [symbol, mockBook]);
  const maxTotal = Math.max(
    book.bids[book.bids.length - 1]?.total ?? 0,
    book.asks[book.asks.length - 1]?.total ?? 0
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Order Book</h3>
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <span>Spread: {book.spread} ({book.spreadPercent}%)</span>
        </div>
      </div>

      {/* Header */}
      <div className="flex text-[10px] text-gray-500 border-b border-surface-700 pb-1 mb-1">
        <span className="flex-1">Price</span>
        <span className="flex-1 text-right">Qty</span>
        <span className="flex-1 text-right">Total</span>
      </div>

      {/* Asks (reversed, lowest ask at bottom) */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="flex flex-col-reverse">
          {book.asks.slice(0, 12).map((level, i) => (
            <div
              key={`ask-${i}`}
              className="relative flex cursor-pointer py-0.5 text-xs hover:bg-surface-700/50"
              onClick={() => onPriceClick?.(level.price)}
            >
              <div
                className="absolute inset-y-0 right-0 bg-red-500/10"
                style={{ width: `${(level.total / maxTotal) * 100}%` }}
              />
              <span className="flex-1 font-mono text-down relative z-10">{formatPrice(level.price)}</span>
              <span className="flex-1 text-right font-mono text-gray-300 relative z-10">{formatVolume(level.quantity)}</span>
              <span className="flex-1 text-right font-mono text-gray-500 relative z-10">{formatVolume(level.total)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Spread indicator */}
      <div className="flex items-center justify-center border-y border-surface-700 py-1.5 my-1">
        <span className="font-mono text-sm font-bold text-white">{formatPrice(book.asks[0]?.price ?? 0)}</span>
      </div>

      {/* Bids */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {book.bids.slice(0, 12).map((level, i) => (
          <div
            key={`bid-${i}`}
            className="relative flex cursor-pointer py-0.5 text-xs hover:bg-surface-700/50"
            onClick={() => onPriceClick?.(level.price)}
          >
            <div
              className="absolute inset-y-0 right-0 bg-green-500/10"
              style={{ width: `${(level.total / maxTotal) * 100}%` }}
            />
            <span className="flex-1 font-mono text-up relative z-10">{formatPrice(level.price)}</span>
            <span className="flex-1 text-right font-mono text-gray-300 relative z-10">{formatVolume(level.quantity)}</span>
            <span className="flex-1 text-right font-mono text-gray-500 relative z-10">{formatVolume(level.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
