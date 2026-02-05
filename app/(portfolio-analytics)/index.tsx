import { ScrollView, Text, View, TouchableOpacity, Dimensions, RefreshControl, Platform } from "react-native";
import { useState, useEffect } from "react";
import { LineChart, PieChart } from "react-native-chart-kit";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  calculatePortfolioPerformance,
  getAssetAllocation,
  getSectorAllocation,
  getHistoricalPerformance,
  calculatePerformanceMetrics,
  getBenchmarkComparison,
  getDiversificationScore,
  type PortfolioPerformance,
  type AssetAllocation,
  type SectorAllocation,
  type HistoricalPerformance,
  type PerformanceMetrics,
} from "@/utils/portfolio-analytics";

const screenWidth = Dimensions.get("window").width;

export default function PortfolioAnalyticsScreen() {
  const colors = useColors();
  const [performance, setPerformance] = useState<PortfolioPerformance | null>(null);
  const [assetAllocation, setAssetAllocation] = useState<AssetAllocation[]>([]);
  const [sectorAllocation, setSectorAllocation] = useState<SectorAllocation[]>([]);
  const [history, setHistory] = useState<HistoricalPerformance[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [diversificationScore, setDiversificationScore] = useState<any>(null);
  const [timeRange, setTimeRange] = useState<"1M" | "3M" | "1Y">("1M");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const loadData = async () => {
    const [perf, assets, sectors, hist, met, div] = await Promise.all([
      calculatePortfolioPerformance(),
      getAssetAllocation(),
      getSectorAllocation(),
      getHistoricalPerformance(timeRange === "1M" ? 30 : timeRange === "3M" ? 90 : 365),
      calculatePerformanceMetrics(),
      getDiversificationScore(),
    ]);

    setPerformance(perf);
    setAssetAllocation(assets);
    setSectorAllocation(sectors);
    setHistory(hist);
    setMetrics(met);
    setDiversificationScore(div);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (!performance || !metrics) {
    return (
      <ScreenContainer className="p-4 justify-center items-center">
        <Text className="text-muted">Loading portfolio analytics...</Text>
      </ScreenContainer>
    );
  }

  const portfolioReturn = ((history[history.length - 1]?.value - history[0]?.value) / history[0]?.value) * 100 || 0;
  const benchmarkReturn =
    ((history[history.length - 1]?.benchmark - history[0]?.benchmark) / history[0]?.benchmark) * 100 || 0;
  const comparison = getBenchmarkComparison(portfolioReturn, benchmarkReturn);

  const chartConfig = {
    backgroundGradientFrom: colors.surface,
    backgroundGradientTo: colors.surface,
    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    propsForDots: {
      r: "0",
    },
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Header */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground">Portfolio Analytics</Text>
          <Text className="text-sm text-muted mt-1">Comprehensive performance analysis</Text>
        </View>

        {/* Performance Summary */}
        <View className="bg-surface rounded-2xl p-6 mb-4 border border-border">
          <Text className="text-sm text-muted mb-2">Total Portfolio Value</Text>
          <Text className="text-4xl font-bold text-foreground mb-4">${performance.totalValue.toFixed(2)}</Text>

          <View className="flex-row justify-between">
            <View>
              <Text className="text-xs text-muted mb-1">Total Gain/Loss</Text>
              <Text
                className={`text-lg font-bold ${performance.totalGainLoss >= 0 ? "text-success" : "text-error"}`}
              >
                {performance.totalGainLoss >= 0 ? "+" : ""}${performance.totalGainLoss.toFixed(2)}
              </Text>
              <Text
                className={`text-sm ${performance.totalGainLossPercent >= 0 ? "text-success" : "text-error"}`}
              >
                {performance.totalGainLossPercent >= 0 ? "+" : ""}
                {performance.totalGainLossPercent.toFixed(2)}%
              </Text>
            </View>

            <View>
              <Text className="text-xs text-muted mb-1">Day Change</Text>
              <Text className={`text-lg font-bold ${performance.dayChange >= 0 ? "text-success" : "text-error"}`}>
                {performance.dayChange >= 0 ? "+" : ""}${performance.dayChange.toFixed(2)}
              </Text>
              <Text className={`text-sm ${performance.dayChangePercent >= 0 ? "text-success" : "text-error"}`}>
                {performance.dayChangePercent >= 0 ? "+" : ""}
                {performance.dayChangePercent.toFixed(2)}%
              </Text>
            </View>
          </View>
        </View>

        {/* Time Range Selector */}
        <View className="flex-row mb-4 bg-surface rounded-xl p-1">
          {(["1M", "3M", "1Y"] as const).map((range) => (
            <TouchableOpacity
              key={range}
              onPress={() => {
                setTimeRange(range);
                if (Platform.OS !== "web") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
              className={`flex-1 py-2 rounded-lg ${timeRange === range ? "bg-primary" : ""}`}
            >
              <Text
                className={`text-center font-semibold ${timeRange === range ? "text-background" : "text-muted"}`}
              >
                {range}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Historical Performance Chart */}
        {history.length > 0 && (
          <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
            <Text className="text-lg font-bold text-foreground mb-4">Historical Performance</Text>

            <LineChart
              data={{
                labels: [],
                datasets: [
                  {
                    data: history.map((h) => h.value),
                    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                    strokeWidth: 2,
                  },
                  {
                    data: history.map((h) => h.benchmark),
                    color: (opacity = 1) => `rgba(156, 163, 175, ${opacity})`,
                    strokeWidth: 2,
                    withDots: false,
                  },
                ],
                legend: ["Portfolio", "S&P 500"],
              }}
              width={screenWidth - 64}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={{ borderRadius: 16 }}
              yAxisLabel="$"
              yAxisSuffix=""
              withVerticalLabels={false}
              withHorizontalLabels={true}
            />

            <View className="flex-row justify-between mt-4">
              <View>
                <Text className="text-xs text-muted mb-1">Portfolio Return</Text>
                <Text className={`text-base font-bold ${portfolioReturn >= 0 ? "text-success" : "text-error"}`}>
                  {portfolioReturn >= 0 ? "+" : ""}
                  {portfolioReturn.toFixed(2)}%
                </Text>
              </View>
              <View>
                <Text className="text-xs text-muted mb-1">Benchmark Return</Text>
                <Text className={`text-base font-bold ${benchmarkReturn >= 0 ? "text-success" : "text-error"}`}>
                  {benchmarkReturn >= 0 ? "+" : ""}
                  {benchmarkReturn.toFixed(2)}%
                </Text>
              </View>
              <View>
                <Text className="text-xs text-muted mb-1">Outperformance</Text>
                <Text
                  className={`text-base font-bold ${
                    comparison.status === "outperforming" ? "text-success" : comparison.status === "underperforming" ? "text-error" : "text-muted"
                  }`}
                >
                  {comparison.outperformance >= 0 ? "+" : ""}
                  {comparison.outperformance.toFixed(2)}%
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Asset Allocation */}
        {assetAllocation.length > 0 && (
          <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
            <Text className="text-lg font-bold text-foreground mb-4">Asset Allocation</Text>

            <PieChart
              data={assetAllocation.map((a) => ({
                name: a.type,
                population: a.value,
                color: a.color,
                legendFontColor: colors.muted,
                legendFontSize: 12,
              }))}
              width={screenWidth - 64}
              height={200}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />

            <View className="mt-4">
              {assetAllocation.map((asset) => (
                <View key={asset.type} className="flex-row justify-between items-center mb-3">
                  <View className="flex-row items-center flex-1">
                    <View className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: asset.color }} />
                    <Text className="text-sm text-foreground">{asset.type}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-base font-bold text-foreground">${asset.value.toFixed(2)}</Text>
                    <Text className="text-xs text-muted">{asset.percentage.toFixed(1)}%</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Sector Allocation */}
        {sectorAllocation.length > 0 && (
          <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
            <Text className="text-lg font-bold text-foreground mb-4">Sector Breakdown</Text>

            {sectorAllocation.map((sector) => (
              <View key={sector.sector} className="mb-4">
                <View className="flex-row justify-between mb-2">
                  <Text className="text-sm text-foreground">{sector.sector}</Text>
                  <Text className="text-sm font-bold text-foreground">{sector.percentage.toFixed(1)}%</Text>
                </View>
                <View className="bg-background rounded-full h-2">
                  <View
                    className="rounded-full h-2"
                    style={{ width: `${sector.percentage}%`, backgroundColor: sector.color }}
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Performance Metrics */}
        <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
          <Text className="text-lg font-bold text-foreground mb-4">Performance Metrics</Text>

          <View className="flex-row flex-wrap">
            <View className="w-1/2 mb-4 pr-2">
              <Text className="text-xs text-muted mb-1">Sharpe Ratio</Text>
              <Text className="text-2xl font-bold text-foreground">{metrics.sharpeRatio}</Text>
              <Text className="text-xs text-muted">Risk-adjusted return</Text>
            </View>

            <View className="w-1/2 mb-4 pl-2">
              <Text className="text-xs text-muted mb-1">Volatility</Text>
              <Text className="text-2xl font-bold text-foreground">{metrics.volatility}%</Text>
              <Text className="text-xs text-muted">Annualized</Text>
            </View>

            <View className="w-1/2 mb-4 pr-2">
              <Text className="text-xs text-muted mb-1">Beta</Text>
              <Text className="text-2xl font-bold text-foreground">{metrics.beta}</Text>
              <Text className="text-xs text-muted">Market correlation</Text>
            </View>

            <View className="w-1/2 mb-4 pl-2">
              <Text className="text-xs text-muted mb-1">Alpha</Text>
              <Text className={`text-2xl font-bold ${metrics.alpha >= 0 ? "text-success" : "text-error"}`}>
                {metrics.alpha >= 0 ? "+" : ""}
                {metrics.alpha}%
              </Text>
              <Text className="text-xs text-muted">Excess return</Text>
            </View>

            <View className="w-1/2 pr-2">
              <Text className="text-xs text-muted mb-1">Max Drawdown</Text>
              <Text className="text-2xl font-bold text-error">-{metrics.maxDrawdown}%</Text>
              <Text className="text-xs text-muted">Peak to trough</Text>
            </View>

            <View className="w-1/2 pl-2">
              <Text className="text-xs text-muted mb-1">Win Rate</Text>
              <Text className="text-2xl font-bold text-success">{metrics.winRate}%</Text>
              <Text className="text-xs text-muted">Positive days</Text>
            </View>
          </View>
        </View>

        {/* Diversification Score */}
        {diversificationScore && (
          <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
            <Text className="text-lg font-bold text-foreground mb-4">Diversification Analysis</Text>

            <View className="items-center mb-4">
              <Text className="text-5xl font-bold text-primary">{diversificationScore.score}</Text>
              <Text className="text-base text-muted mt-1">{diversificationScore.rating}</Text>
            </View>

            <View className="bg-background rounded-full h-3 mb-4">
              <View
                className="bg-primary rounded-full h-3"
                style={{ width: `${diversificationScore.score}%` }}
              />
            </View>

            <Text className="text-sm font-semibold text-foreground mb-2">Recommendations:</Text>
            {diversificationScore.recommendations.map((rec: string, index: number) => (
              <View key={index} className="flex-row items-start mb-2">
                <Text className="text-primary mr-2">•</Text>
                <Text className="text-sm text-foreground flex-1">{rec}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
