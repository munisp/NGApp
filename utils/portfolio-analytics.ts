import AsyncStorage from "@react-native-async-storage/async-storage";

export interface PortfolioHolding {
  id: string;
  symbol: string;
  name: string;
  type: "stock" | "crypto" | "etf" | "bond";
  sector: string;
  shares: number;
  avgCostBasis: number;
  currentPrice: number;
  totalValue: number;
  totalCost: number;
  gainLoss: number;
  gainLossPercent: number;
  dayChange: number;
  dayChangePercent: number;
}

export interface PortfolioPerformance {
  totalValue: number;
  totalCost: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  dayChange: number;
  dayChangePercent: number;
  weekChange: number;
  monthChange: number;
  yearChange: number;
  allTimeHigh: number;
  allTimeLow: number;
}

export interface AssetAllocation {
  type: string;
  value: number;
  percentage: number;
  color: string;
}

export interface SectorAllocation {
  sector: string;
  value: number;
  percentage: number;
  color: string;
}

export interface HistoricalPerformance {
  date: number;
  value: number;
  benchmark: number; // S&P 500 equivalent
}

export interface PerformanceMetrics {
  sharpeRatio: number;
  volatility: number;
  beta: number;
  alpha: number;
  maxDrawdown: number;
  winRate: number;
}

const HOLDINGS_KEY = "@portfolio_holdings";
const HISTORY_KEY = "@portfolio_history";

const SECTOR_COLORS: Record<string, string> = {
  Technology: "#3B82F6",
  Healthcare: "#10B981",
  Finance: "#F59E0B",
  "Consumer Goods": "#EF4444",
  Energy: "#8B5CF6",
  Telecommunications: "#06B6D4",
  Utilities: "#84CC16",
  "Real Estate": "#F97316",
  Materials: "#6366F1",
  Industrials: "#14B8A6",
  Cryptocurrency: "#FBBF24",
  Other: "#9CA3AF",
};

const TYPE_COLORS: Record<string, string> = {
  stock: "#3B82F6",
  crypto: "#FBBF24",
  etf: "#10B981",
  bond: "#8B5CF6",
};

export async function getPortfolioHoldings(): Promise<PortfolioHolding[]> {
  const data = await AsyncStorage.getItem(HOLDINGS_KEY);
  if (!data) return [];
  return JSON.parse(data);
}

export async function calculatePortfolioPerformance(): Promise<PortfolioPerformance> {
  const holdings = await getPortfolioHoldings();

  const totalValue = holdings.reduce((sum, h) => sum + h.totalValue, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.totalCost, 0);
  const totalGainLoss = totalValue - totalCost;
  const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
  const dayChange = holdings.reduce((sum, h) => sum + h.dayChange, 0);
  const dayChangePercent = totalValue > 0 ? (dayChange / (totalValue - dayChange)) * 100 : 0;

  // Simulate historical changes
  const weekChange = totalValue * 0.03; // 3% weekly change
  const monthChange = totalValue * 0.08; // 8% monthly change
  const yearChange = totalValue * 0.15; // 15% yearly change

  const allTimeHigh = totalValue * 1.2;
  const allTimeLow = totalValue * 0.7;

  return {
    totalValue,
    totalCost,
    totalGainLoss,
    totalGainLossPercent,
    dayChange,
    dayChangePercent,
    weekChange,
    monthChange,
    yearChange,
    allTimeHigh,
    allTimeLow,
  };
}

export async function getAssetAllocation(): Promise<AssetAllocation[]> {
  const holdings = await getPortfolioHoldings();
  const totalValue = holdings.reduce((sum, h) => sum + h.totalValue, 0);

  const allocationMap = new Map<string, number>();

  holdings.forEach((holding) => {
    const current = allocationMap.get(holding.type) || 0;
    allocationMap.set(holding.type, current + holding.totalValue);
  });

  const allocation: AssetAllocation[] = [];
  allocationMap.forEach((value, type) => {
    allocation.push({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      value,
      percentage: (value / totalValue) * 100,
      color: TYPE_COLORS[type] || "#9CA3AF",
    });
  });

  return allocation.sort((a, b) => b.value - a.value);
}

export async function getSectorAllocation(): Promise<SectorAllocation[]> {
  const holdings = await getPortfolioHoldings();
  const totalValue = holdings.reduce((sum, h) => sum + h.totalValue, 0);

  const sectorMap = new Map<string, number>();

  holdings.forEach((holding) => {
    const current = sectorMap.get(holding.sector) || 0;
    sectorMap.set(holding.sector, current + holding.totalValue);
  });

  const allocation: SectorAllocation[] = [];
  sectorMap.forEach((value, sector) => {
    allocation.push({
      sector,
      value,
      percentage: (value / totalValue) * 100,
      color: SECTOR_COLORS[sector] || "#9CA3AF",
    });
  });

  return allocation.sort((a, b) => b.value - a.value);
}

export async function getHistoricalPerformance(days: number = 30): Promise<HistoricalPerformance[]> {
  const data = await AsyncStorage.getItem(HISTORY_KEY);
  let history: HistoricalPerformance[] = [];

  if (data) {
    history = JSON.parse(data);
  }

  // If no history or insufficient data, generate simulated data
  if (history.length < days) {
    const currentPerformance = await calculatePortfolioPerformance();
    const startValue = currentPerformance.totalValue * 0.85; // Start 15% lower
    const endValue = currentPerformance.totalValue;

    history = [];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    for (let i = days - 1; i >= 0; i--) {
      const date = now - i * dayMs;
      const progress = (days - i) / days;

      // Portfolio value with some volatility
      const trend = startValue + (endValue - startValue) * progress;
      const volatility = trend * 0.02 * (Math.random() - 0.5);
      const value = trend + volatility;

      // Benchmark (S&P 500) - slightly different performance
      const benchmarkTrend = startValue * 0.95 + (endValue * 0.95 - startValue * 0.95) * progress;
      const benchmarkVolatility = benchmarkTrend * 0.015 * (Math.random() - 0.5);
      const benchmark = benchmarkTrend + benchmarkVolatility;

      history.push({ date, value, benchmark });
    }

    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  return history.slice(-days);
}

export async function calculatePerformanceMetrics(): Promise<PerformanceMetrics> {
  const history = await getHistoricalPerformance(252); // 1 year of trading days
  const performance = await calculatePortfolioPerformance();

  // Calculate daily returns
  const returns: number[] = [];
  for (let i = 1; i < history.length; i++) {
    const dailyReturn = (history[i].value - history[i - 1].value) / history[i - 1].value;
    returns.push(dailyReturn);
  }

  // Calculate benchmark returns
  const benchmarkReturns: number[] = [];
  for (let i = 1; i < history.length; i++) {
    const dailyReturn = (history[i].benchmark - history[i - 1].benchmark) / history[i - 1].benchmark;
    benchmarkReturns.push(dailyReturn);
  }

  // Sharpe Ratio (assuming 2% risk-free rate)
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const stdDev = Math.sqrt(
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
  );
  const riskFreeRate = 0.02 / 252; // Daily risk-free rate
  const sharpeRatio = stdDev > 0 ? ((avgReturn - riskFreeRate) / stdDev) * Math.sqrt(252) : 0;

  // Volatility (annualized)
  const volatility = stdDev * Math.sqrt(252) * 100;

  // Beta (correlation with benchmark)
  const avgBenchmarkReturn = benchmarkReturns.reduce((sum, r) => sum + r, 0) / benchmarkReturns.length;
  const covariance =
    returns.reduce((sum, r, i) => sum + (r - avgReturn) * (benchmarkReturns[i] - avgBenchmarkReturn), 0) /
    returns.length;
  const benchmarkVariance =
    benchmarkReturns.reduce((sum, r) => sum + Math.pow(r - avgBenchmarkReturn, 2), 0) / benchmarkReturns.length;
  const beta = benchmarkVariance > 0 ? covariance / benchmarkVariance : 1;

  // Alpha (excess return over benchmark)
  const portfolioReturn = (history[history.length - 1].value - history[0].value) / history[0].value;
  const benchmarkReturn = (history[history.length - 1].benchmark - history[0].benchmark) / history[0].benchmark;
  const alpha = (portfolioReturn - benchmarkReturn) * 100;

  // Max Drawdown
  let maxDrawdown = 0;
  let peak = history[0].value;
  for (const point of history) {
    if (point.value > peak) {
      peak = point.value;
    }
    const drawdown = ((peak - point.value) / peak) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  // Win Rate (percentage of positive days)
  const positiveDays = returns.filter((r) => r > 0).length;
  const winRate = (positiveDays / returns.length) * 100;

  return {
    sharpeRatio: Number(sharpeRatio.toFixed(2)),
    volatility: Number(volatility.toFixed(2)),
    beta: Number(beta.toFixed(2)),
    alpha: Number(alpha.toFixed(2)),
    maxDrawdown: Number(maxDrawdown.toFixed(2)),
    winRate: Number(winRate.toFixed(2)),
  };
}

export function getBenchmarkComparison(
  portfolioReturn: number,
  benchmarkReturn: number
): {
  outperformance: number;
  status: "outperforming" | "underperforming" | "matching";
} {
  const outperformance = portfolioReturn - benchmarkReturn;
  let status: "outperforming" | "underperforming" | "matching";

  if (Math.abs(outperformance) < 0.5) {
    status = "matching";
  } else if (outperformance > 0) {
    status = "outperforming";
  } else {
    status = "underperforming";
  }

  return { outperformance, status };
}

export async function getDiversificationScore(): Promise<{
  score: number;
  rating: string;
  recommendations: string[];
}> {
  const assetAllocation = await getAssetAllocation();
  const sectorAllocation = await getSectorAllocation();

  // Calculate concentration (Herfindahl index)
  const assetConcentration = assetAllocation.reduce((sum, a) => sum + Math.pow(a.percentage / 100, 2), 0);
  const sectorConcentration = sectorAllocation.reduce((sum, s) => sum + Math.pow(s.percentage / 100, 2), 0);

  // Diversification score (0-100, higher is better)
  const assetScore = (1 - assetConcentration) * 100;
  const sectorScore = (1 - sectorConcentration) * 100;
  const score = (assetScore + sectorScore) / 2;

  let rating: string;
  if (score >= 80) rating = "Excellent";
  else if (score >= 60) rating = "Good";
  else if (score >= 40) rating = "Fair";
  else rating = "Poor";

  const recommendations: string[] = [];

  // Check for over-concentration
  const topAsset = assetAllocation[0];
  if (topAsset && topAsset.percentage > 70) {
    recommendations.push(`Consider reducing ${topAsset.type} allocation (currently ${topAsset.percentage.toFixed(1)}%)`);
  }

  const topSector = sectorAllocation[0];
  if (topSector && topSector.percentage > 40) {
    recommendations.push(`Diversify away from ${topSector.sector} sector (currently ${topSector.percentage.toFixed(1)}%)`);
  }

  if (assetAllocation.length < 3) {
    recommendations.push("Add more asset types to improve diversification");
  }

  if (sectorAllocation.length < 5) {
    recommendations.push("Expand into more sectors for better risk management");
  }

  if (recommendations.length === 0) {
    recommendations.push("Portfolio is well-diversified. Maintain current allocation.");
  }

  return {
    score: Number(score.toFixed(1)),
    rating,
    recommendations,
  };
}
