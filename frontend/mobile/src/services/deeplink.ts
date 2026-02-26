// ============================================================
// NEXCOM Exchange - Deep Linking Service
// ============================================================

import { Linking } from "react-native";

const DEEP_LINK_PREFIX = "nexcom://";
const UNIVERSAL_LINK_PREFIX = "https://nexcom.exchange/";

export interface DeepLinkRoute {
  screen: string;
  params?: Record<string, string>;
}

/**
 * Parse a deep link URL into a route
 */
export function parseDeepLink(url: string): DeepLinkRoute | null {
  try {
    let path = url;

    // Strip prefixes
    if (path.startsWith(DEEP_LINK_PREFIX)) {
      path = path.slice(DEEP_LINK_PREFIX.length);
    } else if (path.startsWith(UNIVERSAL_LINK_PREFIX)) {
      path = path.slice(UNIVERSAL_LINK_PREFIX.length);
    }

    // Remove leading/trailing slashes
    path = path.replace(/^\/+|\/+$/g, "");

    // Parse path and query params
    const [pathPart, queryPart] = path.split("?");
    const segments = pathPart.split("/").filter(Boolean);
    const params: Record<string, string> = {};

    if (queryPart) {
      const searchParams = new URLSearchParams(queryPart);
      searchParams.forEach((value, key) => {
        params[key] = value;
      });
    }

    // Route mapping
    if (segments.length === 0) {
      return { screen: "MainTabs", params: { tab: "Dashboard" } };
    }

    switch (segments[0]) {
      case "trade":
        return {
          screen: "TradeDetail",
          params: { symbol: segments[1] || params.symbol || "MAIZE", ...params },
        };
      case "markets":
        return { screen: "MainTabs", params: { tab: "Markets", ...params } };
      case "portfolio":
        return { screen: "MainTabs", params: { tab: "Portfolio", ...params } };
      case "account":
        return { screen: "MainTabs", params: { tab: "Account", ...params } };
      case "notifications":
        return { screen: "Notifications", params };
      case "order":
        return {
          screen: "TradeDetail",
          params: { orderId: segments[1] || params.orderId || "", ...params },
        };
      default:
        return { screen: "MainTabs", params };
    }
  } catch {
    return null;
  }
}

/**
 * Get the linking configuration for React Navigation
 */
export function getLinkingConfig() {
  return {
    prefixes: [DEEP_LINK_PREFIX, UNIVERSAL_LINK_PREFIX],
    config: {
      screens: {
        MainTabs: {
          screens: {
            Dashboard: "dashboard",
            Markets: "markets",
            Trade: "quick-trade",
            Portfolio: "portfolio",
            Account: "account",
          },
        },
        TradeDetail: "trade/:symbol",
        Notifications: "notifications",
      },
    },
  };
}

/**
 * Create a shareable deep link for a trade/symbol
 */
export function createTradeLink(symbol: string): string {
  return `${UNIVERSAL_LINK_PREFIX}trade/${symbol}`;
}

/**
 * Create a shareable deep link for an order
 */
export function createOrderLink(orderId: string): string {
  return `${UNIVERSAL_LINK_PREFIX}order/${orderId}`;
}

/**
 * Open an external URL
 */
export async function openExternalUrl(url: string): Promise<void> {
  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
  }
}

/**
 * Listen for incoming deep links
 */
export function addDeepLinkListener(
  callback: (route: DeepLinkRoute) => void
): { remove: () => void } {
  const subscription = Linking.addEventListener("url", (event) => {
    const route = parseDeepLink(event.url);
    if (route) {
      callback(route);
    }
  });
  return subscription;
}

/**
 * Get the initial deep link that launched the app
 */
export async function getInitialDeepLink(): Promise<DeepLinkRoute | null> {
  try {
    const url = await Linking.getInitialURL();
    if (url) {
      return parseDeepLink(url);
    }
    return null;
  } catch {
    return null;
  }
}
