"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { OrderSide, OrderType } from "@/types";

interface OrderEntryProps {
  symbol: string;
  currentPrice: number;
  onSubmit?: (order: {
    symbol: string;
    side: OrderSide;
    type: OrderType;
    price: number;
    quantity: number;
    stopPrice?: number;
  }) => void;
}

export default function OrderEntry({ symbol, currentPrice, onSubmit }: OrderEntryProps) {
  const [side, setSide] = useState<OrderSide>("BUY");
  const [orderType, setOrderType] = useState<OrderType>("LIMIT");
  const [price, setPrice] = useState(currentPrice.toString());
  const [quantity, setQuantity] = useState("");
  const [stopPrice, setStopPrice] = useState("");

  const total = Number(price) * Number(quantity) || 0;

  const handleSubmit = () => {
    onSubmit?.({
      symbol,
      side,
      type: orderType,
      price: Number(price),
      quantity: Number(quantity),
      stopPrice: stopPrice ? Number(stopPrice) : undefined,
    });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Place Order</h3>

      {/* Buy/Sell Toggle */}
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-900 p-1">
        <button
          onClick={() => setSide("BUY")}
          className={cn(
            "rounded-md py-2 text-sm font-semibold transition-colors",
            side === "BUY" ? "bg-up text-white" : "text-gray-400 hover:text-white"
          )}
        >
          Buy
        </button>
        <button
          onClick={() => setSide("SELL")}
          className={cn(
            "rounded-md py-2 text-sm font-semibold transition-colors",
            side === "SELL" ? "bg-down text-white" : "text-gray-400 hover:text-white"
          )}
        >
          Sell
        </button>
      </div>

      {/* Order Type */}
      <div className="flex gap-1">
        {(["MARKET", "LIMIT", "STOP", "STOP_LIMIT"] as OrderType[]).map((t) => (
          <button
            key={t}
            onClick={() => setOrderType(t)}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-[10px] font-medium transition-colors",
              orderType === t
                ? "bg-surface-700 text-white"
                : "text-gray-500 hover:text-gray-300"
            )}
          >
            {t.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Price (not for market orders) */}
      {orderType !== "MARKET" && (
        <div>
          <label className="text-[10px] text-gray-500 uppercase">Price</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="input-field mt-1 font-mono"
            step="0.01"
          />
        </div>
      )}

      {/* Stop Price */}
      {(orderType === "STOP" || orderType === "STOP_LIMIT") && (
        <div>
          <label className="text-[10px] text-gray-500 uppercase">Stop Price</label>
          <input
            type="number"
            value={stopPrice}
            onChange={(e) => setStopPrice(e.target.value)}
            className="input-field mt-1 font-mono"
            step="0.01"
          />
        </div>
      )}

      {/* Quantity */}
      <div>
        <label className="text-[10px] text-gray-500 uppercase">Quantity (lots)</label>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="input-field mt-1 font-mono"
          min="1"
        />
        <div className="mt-1 flex gap-1">
          {[25, 50, 75, 100].map((pct) => (
            <button
              key={pct}
              onClick={() => setQuantity(String(pct))}
              className="flex-1 rounded bg-surface-700 py-1 text-[10px] text-gray-400 hover:text-white transition-colors"
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* Total */}
      <div className="flex items-center justify-between rounded-lg bg-surface-900 px-3 py-2">
        <span className="text-xs text-gray-500">Total</span>
        <span className="font-mono text-sm font-medium">
          ${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </span>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={!quantity || (orderType !== "MARKET" && !price)}
        className={cn(
          "w-full rounded-lg py-3 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          side === "BUY"
            ? "bg-up hover:bg-green-400 text-white"
            : "bg-down hover:bg-red-400 text-white"
        )}
      >
        {side === "BUY" ? "Buy" : "Sell"} {symbol}
      </button>

      {/* Margin info */}
      <div className="space-y-1 text-[10px] text-gray-500">
        <div className="flex justify-between">
          <span>Est. Margin Required</span>
          <span className="font-mono">${(total * 0.1).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Est. Fee</span>
          <span className="font-mono">${(total * 0.001).toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
