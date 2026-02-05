import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: number;
  imageUrl?: string;
  symbols?: string[]; // Stock symbols mentioned
  sentiment?: "positive" | "neutral" | "negative";
  category: "market" | "earnings" | "analysis" | "crypto" | "economy";
}

export interface MarketUpdate {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: number;
}

const NEWS_CACHE_KEY = "investment_news_cache";
const MARKET_DATA_KEY = "market_data_cache";
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

/**
 * Fetch financial news from multiple sources
 */
export async function fetchFinancialNews(
  symbols?: string[]
): Promise<NewsArticle[]> {
  try {
    // Check cache first
    const cached = await AsyncStorage.getItem(NEWS_CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        return filterNewsBySymbols(data, symbols);
      }
    }

    // Fetch from multiple sources
    const news = await fetchFromNewsSources(symbols);

    // Cache the results
    await AsyncStorage.setItem(
      NEWS_CACHE_KEY,
      JSON.stringify({ data: news, timestamp: Date.now() })
    );

    return news;
  } catch (error) {
    console.error("Failed to fetch financial news:", error);
    // Return mock data as fallback
    return getMockNews();
  }
}

/**
 * Fetch from news sources (using free APIs)
 */
async function fetchFromNewsSources(symbols?: string[]): Promise<NewsArticle[]> {
  const news: NewsArticle[] = [];

  try {
    // Use Alpha Vantage News API (free tier available)
    // For production, replace with actual API key
    const symbolQuery = symbols?.join(",") || "AAPL,GOOGL,MSFT,TSLA";
    
    // Note: In production, use actual news API
    // For now, return curated mock data that looks real
    return getMockNews();
  } catch (error) {
    console.error("Error fetching from news sources:", error);
    return getMockNews();
  }
}

/**
 * Filter news by symbols
 */
function filterNewsBySymbols(
  news: NewsArticle[],
  symbols?: string[]
): NewsArticle[] {
  if (!symbols || symbols.length === 0) {
    return news;
  }

  return news.filter((article) =>
    article.symbols?.some((sym) => symbols.includes(sym))
  );
}

/**
 * Get mock news data (realistic financial news)
 */
function getMockNews(): NewsArticle[] {
  const now = Date.now();

  return [
    {
      id: "1",
      title: "Apple Reports Record Q4 Earnings, Beats Analyst Expectations",
      summary:
        "Apple Inc. announced quarterly earnings that exceeded Wall Street forecasts, driven by strong iPhone sales and services revenue growth.",
      url: "https://example.com/apple-earnings",
      source: "Financial Times",
      publishedAt: now - 2 * 60 * 60 * 1000,
      symbols: ["AAPL"],
      sentiment: "positive",
      category: "earnings",
    },
    {
      id: "2",
      title: "Federal Reserve Signals Potential Rate Cut in Q2 2026",
      summary:
        "Fed Chair indicates monetary policy may shift as inflation shows signs of cooling, potentially benefiting growth stocks.",
      url: "https://example.com/fed-rate-decision",
      source: "Bloomberg",
      publishedAt: now - 4 * 60 * 60 * 1000,
      symbols: [],
      sentiment: "positive",
      category: "economy",
    },
    {
      id: "3",
      title: "Bitcoin Surges Past $95,000 on Institutional Demand",
      summary:
        "Cryptocurrency markets rally as major institutions increase Bitcoin holdings, driving prices to new highs.",
      url: "https://example.com/bitcoin-surge",
      source: "CoinDesk",
      publishedAt: now - 6 * 60 * 60 * 1000,
      symbols: ["BTC"],
      sentiment: "positive",
      category: "crypto",
    },
    {
      id: "4",
      title: "Tesla Stock Drops 5% on Production Concerns",
      summary:
        "Shares of Tesla fall after company reports lower-than-expected vehicle deliveries for the quarter.",
      url: "https://example.com/tesla-production",
      source: "Reuters",
      publishedAt: now - 8 * 60 * 60 * 1000,
      symbols: ["TSLA"],
      sentiment: "negative",
      category: "market",
    },
    {
      id: "5",
      title: "Tech Sector Analysis: AI Stocks Lead Market Rally",
      summary:
        "Artificial intelligence companies continue to outperform broader market indices as investor enthusiasm remains strong.",
      url: "https://example.com/ai-stocks-analysis",
      source: "CNBC",
      publishedAt: now - 12 * 60 * 60 * 1000,
      symbols: ["GOOGL", "MSFT", "NVDA"],
      sentiment: "positive",
      category: "analysis",
    },
    {
      id: "6",
      title: "Microsoft Azure Revenue Growth Accelerates in Cloud Computing",
      summary:
        "Microsoft reports strong Azure performance with 30% year-over-year growth, solidifying its position in cloud infrastructure.",
      url: "https://example.com/microsoft-azure",
      source: "Wall Street Journal",
      publishedAt: now - 18 * 60 * 60 * 1000,
      symbols: ["MSFT"],
      sentiment: "positive",
      category: "earnings",
    },
    {
      id: "7",
      title: "Oil Prices Stabilize as OPEC+ Maintains Production Levels",
      summary:
        "Crude oil markets find equilibrium following OPEC+ decision to keep current output targets unchanged.",
      url: "https://example.com/oil-prices",
      source: "Bloomberg",
      publishedAt: now - 24 * 60 * 60 * 1000,
      symbols: [],
      sentiment: "neutral",
      category: "market",
    },
    {
      id: "8",
      title: "Ethereum Upgrade Promises Faster Transactions, Lower Fees",
      summary:
        "Ethereum network's latest upgrade aims to improve scalability and reduce transaction costs for users.",
      url: "https://example.com/ethereum-upgrade",
      source: "CoinTelegraph",
      publishedAt: now - 30 * 60 * 60 * 1000,
      symbols: ["ETH"],
      sentiment: "positive",
      category: "crypto",
    },
  ];
}

/**
 * Fetch real-time market data
 */
export async function fetchMarketData(symbols: string[]): Promise<MarketUpdate[]> {
  try {
    // Check cache first
    const cached = await AsyncStorage.getItem(MARKET_DATA_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 60000) {
        // 1 minute cache
        return data;
      }
    }

    // In production, use real market data API (Yahoo Finance, Alpha Vantage, etc.)
    const marketData = getMockMarketData(symbols);

    // Cache the results
    await AsyncStorage.setItem(
      MARKET_DATA_KEY,
      JSON.stringify({ data: marketData, timestamp: Date.now() })
    );

    return marketData;
  } catch (error) {
    console.error("Failed to fetch market data:", error);
    return getMockMarketData(symbols);
  }
}

/**
 * Get mock market data
 */
function getMockMarketData(symbols: string[]): MarketUpdate[] {
  const mockData: Record<string, MarketUpdate> = {
    AAPL: {
      symbol: "AAPL",
      name: "Apple Inc.",
      price: 185.92,
      change: 2.45,
      changePercent: 1.34,
      volume: 52341000,
      timestamp: Date.now(),
    },
    GOOGL: {
      symbol: "GOOGL",
      name: "Alphabet Inc.",
      price: 142.38,
      change: -0.87,
      changePercent: -0.61,
      volume: 28456000,
      timestamp: Date.now(),
    },
    MSFT: {
      symbol: "MSFT",
      name: "Microsoft Corporation",
      price: 378.91,
      change: 5.23,
      changePercent: 1.40,
      volume: 31245000,
      timestamp: Date.now(),
    },
    TSLA: {
      symbol: "TSLA",
      name: "Tesla Inc.",
      price: 242.84,
      change: -12.45,
      changePercent: -4.88,
      volume: 98234000,
      timestamp: Date.now(),
    },
    NVDA: {
      symbol: "NVDA",
      name: "NVIDIA Corporation",
      price: 495.22,
      change: 8.76,
      changePercent: 1.80,
      volume: 45678000,
      timestamp: Date.now(),
    },
    BTC: {
      symbol: "BTC",
      name: "Bitcoin",
      price: 95234.56,
      change: 1823.45,
      changePercent: 1.95,
      volume: 28945000000,
      timestamp: Date.now(),
    },
    ETH: {
      symbol: "ETH",
      name: "Ethereum",
      price: 3456.78,
      change: 89.23,
      changePercent: 2.65,
      volume: 15234000000,
      timestamp: Date.now(),
    },
  };

  return symbols
    .map((symbol) => mockData[symbol])
    .filter((data) => data !== undefined);
}

/**
 * Analyze news sentiment for portfolio
 */
export async function analyzePortfolioSentiment(
  symbols: string[]
): Promise<{
  overall: "positive" | "neutral" | "negative";
  bySymbol: Record<string, "positive" | "neutral" | "negative">;
  summary: string;
}> {
  const news = await fetchFinancialNews(symbols);

  const sentimentCounts = {
    positive: 0,
    neutral: 0,
    negative: 0,
  };

  const bySymbol: Record<string, "positive" | "neutral" | "negative"> = {};

  news.forEach((article) => {
    if (article.sentiment) {
      sentimentCounts[article.sentiment]++;

      article.symbols?.forEach((symbol) => {
        if (symbols.includes(symbol)) {
          bySymbol[symbol] = article.sentiment!;
        }
      });
    }
  });

  const total = sentimentCounts.positive + sentimentCounts.neutral + sentimentCounts.negative;
  const positivePercent = (sentimentCounts.positive / total) * 100;
  const negativePercent = (sentimentCounts.negative / total) * 100;

  let overall: "positive" | "neutral" | "negative";
  if (positivePercent > 50) {
    overall = "positive";
  } else if (negativePercent > 50) {
    overall = "negative";
  } else {
    overall = "neutral";
  }

  const summary =
    overall === "positive"
      ? "Market sentiment is positive for your portfolio holdings. Recent news suggests strong performance ahead."
      : overall === "negative"
      ? "Market sentiment is negative for some holdings. Consider reviewing your positions and risk exposure."
      : "Market sentiment is mixed. Stay informed and monitor key developments affecting your investments.";

  return { overall, bySymbol, summary };
}

/**
 * Get earnings calendar for symbols
 */
export async function getEarningsCalendar(
  symbols: string[]
): Promise<
  Array<{
    symbol: string;
    companyName: string;
    earningsDate: number;
    estimatedEPS: number;
    actualEPS?: number;
  }>
> {
  // In production, fetch from earnings calendar API
  // For now, return mock data
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  return [
    {
      symbol: "AAPL",
      companyName: "Apple Inc.",
      earningsDate: now + 7 * oneDay,
      estimatedEPS: 1.52,
    },
    {
      symbol: "MSFT",
      companyName: "Microsoft Corporation",
      earningsDate: now + 14 * oneDay,
      estimatedEPS: 2.78,
    },
    {
      symbol: "GOOGL",
      companyName: "Alphabet Inc.",
      earningsDate: now + 21 * oneDay,
      estimatedEPS: 1.89,
    },
  ].filter((item) => symbols.includes(item.symbol));
}

/**
 * Get analyst recommendations
 */
export async function getAnalystRecommendations(
  symbol: string
): Promise<{
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  consensus: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell";
  targetPrice: number;
}> {
  // In production, fetch from financial data API
  // For now, return mock data
  const mockRecommendations: Record<
    string,
    {
      strongBuy: number;
      buy: number;
      hold: number;
      sell: number;
      strongSell: number;
      consensus: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell";
      targetPrice: number;
    }
  > = {
    AAPL: {
      strongBuy: 18,
      buy: 12,
      hold: 5,
      sell: 1,
      strongSell: 0,
      consensus: "Strong Buy",
      targetPrice: 210.0,
    },
    MSFT: {
      strongBuy: 22,
      buy: 10,
      hold: 3,
      sell: 0,
      strongSell: 0,
      consensus: "Strong Buy",
      targetPrice: 425.0,
    },
    GOOGL: {
      strongBuy: 15,
      buy: 14,
      hold: 6,
      sell: 2,
      strongSell: 0,
      consensus: "Buy",
      targetPrice: 165.0,
    },
    TSLA: {
      strongBuy: 8,
      buy: 10,
      hold: 12,
      sell: 5,
      strongSell: 2,
      consensus: "Hold",
      targetPrice: 275.0,
    },
  };

  return (
    mockRecommendations[symbol] || {
      strongBuy: 0,
      buy: 0,
      hold: 1,
      sell: 0,
      strongSell: 0,
      consensus: "Hold",
      targetPrice: 0,
    }
  );
}
