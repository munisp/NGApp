// ============================================================
// NEXCOM Exchange - Share Service
// ============================================================

import { Share, Platform } from "react-native";

export interface ShareContent {
  title: string;
  message: string;
  url?: string;
}

/**
 * Share a trade confirmation
 */
export async function shareTradeConfirmation(params: {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  orderId: string;
}): Promise<boolean> {
  const { symbol, side, quantity, price, orderId } = params;
  const total = quantity * price;
  const message = [
    `NEXCOM Exchange - Trade Confirmation`,
    ``,
    `${side} ${quantity} ${symbol} @ $${price.toLocaleString()}`,
    `Total: $${total.toLocaleString()}`,
    `Order ID: ${orderId}`,
    ``,
    `https://nexcom.exchange/order/${orderId}`,
  ].join("\n");

  return shareContent({
    title: `${side} ${symbol} - NEXCOM Exchange`,
    message,
    url: `https://nexcom.exchange/order/${orderId}`,
  });
}

/**
 * Share a commodity/market link
 */
export async function shareMarketLink(params: {
  symbol: string;
  name: string;
  price: number;
  change: number;
}): Promise<boolean> {
  const { symbol, name, price, change } = params;
  const direction = change >= 0 ? "up" : "down";
  const message = [
    `${name} (${symbol}) - $${price.toLocaleString()}`,
    `${change >= 0 ? "+" : ""}${change.toFixed(2)}% ${direction} today`,
    ``,
    `Trade on NEXCOM Exchange:`,
    `https://nexcom.exchange/trade/${symbol}`,
  ].join("\n");

  return shareContent({
    title: `${symbol} - NEXCOM Exchange`,
    message,
    url: `https://nexcom.exchange/trade/${symbol}`,
  });
}

/**
 * Share portfolio performance
 */
export async function sharePortfolioPerformance(params: {
  totalValue: number;
  pnl: number;
  pnlPercent: number;
}): Promise<boolean> {
  const { totalValue, pnl, pnlPercent } = params;
  const message = [
    `My NEXCOM Exchange Portfolio`,
    ``,
    `Total Value: $${totalValue.toLocaleString()}`,
    `P&L: ${pnl >= 0 ? "+" : ""}$${pnl.toLocaleString()} (${pnlPercent >= 0 ? "+" : ""}${pnlPercent.toFixed(2)}%)`,
    ``,
    `Trade commodities on NEXCOM Exchange`,
    `https://nexcom.exchange`,
  ].join("\n");

  return shareContent({
    title: "My Portfolio - NEXCOM Exchange",
    message,
    url: "https://nexcom.exchange",
  });
}

/**
 * Generic share content
 */
async function shareContent(content: ShareContent): Promise<boolean> {
  try {
    const shareOptions: { title: string; message: string; url?: string } = {
      title: content.title,
      message: content.message,
    };

    // iOS supports separate url field; Android embeds URL in message
    if (Platform.OS === "ios" && content.url) {
      shareOptions.url = content.url;
    }

    const result = await Share.share(shareOptions);

    if (result.action === Share.sharedAction) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
