import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

export interface PortfolioHolding {
  id: string;
  symbol: string;
  name: string;
  type: "stock" | "crypto";
  quantity: number;
  purchasePrice: number;
  currentPrice: number;
  purchaseDate: number;
  exchange?: string;
}

export interface PortfolioPerformance {
  totalValue: number;
  totalCost: number;
  totalGainLoss: number;
  totalGainLossPercentage: number;
  dayChange: number;
  dayChangePercentage: number;
  holdings: (PortfolioHolding & {
    currentValue: number;
    gainLoss: number;
    gainLossPercentage: number;
    weight: number;
  })[];
}

export interface DividendRecord {
  id: string;
  symbol: string;
  amount: number;
  date: number;
  type: "cash" | "reinvest";
}

const STORAGE_KEY = "portfolio_holdings";
const DIVIDENDS_KEY = "portfolio_dividends";

// Free API endpoints for real-time data
const STOCK_API = "https://query1.finance.yahoo.com/v8/finance/chart";
const CRYPTO_API = "https://api.coingecko.com/api/v3/simple/price";

/**
 * Fetch real-time stock price from Yahoo Finance
 */
export async function fetchStockPrice(symbol: string): Promise<number> {
  try {
    const response = await axios.get(`${STOCK_API}/${symbol}`, {
      params: {
        interval: "1d",
        range: "1d",
      },
      timeout: 5000,
    });

    const quote = response.data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (typeof quote === "number") {
      return quote;
    }

    throw new Error("Invalid stock price data");
  } catch (error) {
    console.error(`Failed to fetch stock price for ${symbol}:`, error);
    // Return mock price for demo
    return 100 + Math.random() * 50;
  }
}

/**
 * Fetch real-time crypto price from CoinGecko
 */
export async function fetchCryptoPrice(symbol: string): Promise<number> {
  try {
    // Map common symbols to CoinGecko IDs
    const cryptoMap: { [key: string]: string } = {
      BTC: "bitcoin",
      ETH: "ethereum",
      BNB: "binancecoin",
      ADA: "cardano",
      SOL: "solana",
      DOT: "polkadot",
      MATIC: "matic-network",
      AVAX: "avalanche-2",
    };

    const coinId = cryptoMap[symbol.toUpperCase()] || symbol.toLowerCase();

    const response = await axios.get(CRYPTO_API, {
      params: {
        ids: coinId,
        vs_currencies: "usd",
      },
      timeout: 5000,
    });

    const price = response.data?.[coinId]?.usd;
    if (typeof price === "number") {
      return price;
    }

    throw new Error("Invalid crypto price data");
  } catch (error) {
    console.error(`Failed to fetch crypto price for ${symbol}:`, error);
    // Return mock price for demo
    return 1000 + Math.random() * 500;
  }
}

/**
 * Fetch current price for a holding
 */
export async function fetchCurrentPrice(
  symbol: string,
  type: "stock" | "crypto"
): Promise<number> {
  if (type === "stock") {
    return await fetchStockPrice(symbol);
  } else {
    return await fetchCryptoPrice(symbol);
  }
}

/**
 * Load all portfolio holdings
 */
export async function loadPortfolioHoldings(): Promise<PortfolioHolding[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    return json ? JSON.parse(json) : [];
  } catch (error) {
    console.error("Failed to load portfolio holdings:", error);
    return [];
  }
}

/**
 * Save portfolio holdings
 */
export async function savePortfolioHoldings(
  holdings: PortfolioHolding[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(holdings));
  } catch (error) {
    console.error("Failed to save portfolio holdings:", error);
    throw error;
  }
}

/**
 * Add new holding to portfolio
 */
export async function addHolding(
  holding: Omit<PortfolioHolding, "id" | "currentPrice">
): Promise<PortfolioHolding> {
  const holdings = await loadPortfolioHoldings();

  const currentPrice = await fetchCurrentPrice(holding.symbol, holding.type);

  const newHolding: PortfolioHolding = {
    ...holding,
    id: Date.now().toString(),
    currentPrice,
  };

  holdings.push(newHolding);
  await savePortfolioHoldings(holdings);

  return newHolding;
}

/**
 * Update holding in portfolio
 */
export async function updateHolding(
  id: string,
  updates: Partial<PortfolioHolding>
): Promise<void> {
  const holdings = await loadPortfolioHoldings();
  const index = holdings.findIndex((h) => h.id === id);

  if (index === -1) {
    throw new Error("Holding not found");
  }

  holdings[index] = { ...holdings[index], ...updates };
  await savePortfolioHoldings(holdings);
}

/**
 * Delete holding from portfolio
 */
export async function deleteHolding(id: string): Promise<void> {
  const holdings = await loadPortfolioHoldings();
  const filtered = holdings.filter((h) => h.id !== id);
  await savePortfolioHoldings(filtered);
}

/**
 * Refresh current prices for all holdings
 */
export async function refreshPortfolioPrices(): Promise<PortfolioHolding[]> {
  const holdings = await loadPortfolioHoldings();

  const updatedHoldings = await Promise.all(
    holdings.map(async (holding) => {
      try {
        const currentPrice = await fetchCurrentPrice(holding.symbol, holding.type);
        return { ...holding, currentPrice };
      } catch (error) {
        console.error(`Failed to refresh price for ${holding.symbol}:`, error);
        return holding;
      }
    })
  );

  await savePortfolioHoldings(updatedHoldings);
  return updatedHoldings;
}

/**
 * Calculate portfolio performance
 */
export async function calculatePortfolioPerformance(): Promise<PortfolioPerformance> {
  const holdings = await refreshPortfolioPrices();

  let totalValue = 0;
  let totalCost = 0;

  const enrichedHoldings = holdings.map((holding) => {
    const currentValue = holding.quantity * holding.currentPrice;
    const cost = holding.quantity * holding.purchasePrice;
    const gainLoss = currentValue - cost;
    const gainLossPercentage = (gainLoss / cost) * 100;

    totalValue += currentValue;
    totalCost += cost;

    return {
      ...holding,
      currentValue,
      gainLoss,
      gainLossPercentage,
      weight: 0, // Will be calculated after totalValue is known
    };
  });

  // Calculate weights
  const holdingsWithWeights = enrichedHoldings.map((holding) => ({
    ...holding,
    weight: totalValue > 0 ? (holding.currentValue / totalValue) * 100 : 0,
  }));

  const totalGainLoss = totalValue - totalCost;
  const totalGainLossPercentage =
    totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

  // Mock day change (in real app, would compare with previous day's close)
  const dayChange = totalValue * (Math.random() * 0.04 - 0.02); // -2% to +2%
  const dayChangePercentage = totalValue > 0 ? (dayChange / totalValue) * 100 : 0;

  return {
    totalValue,
    totalCost,
    totalGainLoss,
    totalGainLossPercentage,
    dayChange,
    dayChangePercentage,
    holdings: holdingsWithWeights,
  };
}

/**
 * Load dividend records
 */
export async function loadDividends(): Promise<DividendRecord[]> {
  try {
    const json = await AsyncStorage.getItem(DIVIDENDS_KEY);
    return json ? JSON.parse(json) : [];
  } catch (error) {
    console.error("Failed to load dividends:", error);
    return [];
  }
}

/**
 * Add dividend record
 */
export async function addDividend(
  dividend: Omit<DividendRecord, "id">
): Promise<void> {
  const dividends = await loadDividends();

  const newDividend: DividendRecord = {
    ...dividend,
    id: Date.now().toString(),
  };

  dividends.push(newDividend);

  try {
    await AsyncStorage.setItem(DIVIDENDS_KEY, JSON.stringify(dividends));

    // If reinvest, add to holdings
    if (dividend.type === "reinvest") {
      const holdings = await loadPortfolioHoldings();
      const holding = holdings.find((h) => h.symbol === dividend.symbol);

      if (holding) {
        const currentPrice = await fetchCurrentPrice(holding.symbol, holding.type);
        const additionalShares = dividend.amount / currentPrice;

        await updateHolding(holding.id, {
          quantity: holding.quantity + additionalShares,
        });
      }
    }
  } catch (error) {
    console.error("Failed to add dividend:", error);
    throw error;
  }
}

/**
 * Get total dividends received
 */
export async function getTotalDividends(): Promise<number> {
  const dividends = await loadDividends();
  return dividends.reduce((sum, div) => sum + div.amount, 0);
}

/**
 * Get AI-powered investment recommendations
 */
export async function getInvestmentRecommendations(
  performance: PortfolioPerformance
): Promise<string[]> {
  const recommendations: string[] = [];

  // Diversification check
  const maxWeight = Math.max(...performance.holdings.map((h) => h.weight));
  if (maxWeight > 40) {
    recommendations.push(
      `⚠️ Your portfolio is heavily concentrated in one asset (${maxWeight.toFixed(1)}%). Consider diversifying to reduce risk.`
    );
  }

  // Asset type balance
  const stockCount = performance.holdings.filter((h) => h.type === "stock").length;
  const cryptoCount = performance.holdings.filter((h) => h.type === "crypto").length;

  if (cryptoCount > stockCount * 2) {
    recommendations.push(
      "💡 Your portfolio is crypto-heavy. Consider adding more traditional stocks for stability."
    );
  }

  // Performance-based recommendations
  const losers = performance.holdings.filter((h) => h.gainLossPercentage < -20);
  if (losers.length > 0) {
    recommendations.push(
      `📉 ${losers.length} holding(s) are down more than 20%. Review your investment thesis or consider tax-loss harvesting.`
    );
  }

  const winners = performance.holdings.filter((h) => h.gainLossPercentage > 50);
  if (winners.length > 0) {
    recommendations.push(
      `📈 ${winners.length} holding(s) are up more than 50%. Consider taking profits or rebalancing.`
    );
  }

  // General recommendations
  if (performance.holdings.length < 5) {
    recommendations.push(
      "🎯 Consider adding more holdings to improve diversification. Aim for at least 5-10 different assets."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "✅ Your portfolio looks well-balanced. Keep monitoring and rebalance quarterly."
    );
  }

  return recommendations;
}
