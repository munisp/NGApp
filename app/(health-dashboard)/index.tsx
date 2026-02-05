import { ScrollView, Text, View, TouchableOpacity, RefreshControl } from "react-native";
import { useState, useEffect } from "react";
import { LineChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  calculateFinancialHealth,
  generateRecommendations,
  getHealthHistory,
  saveHealthSnapshot,
  getHealthRating,
  getHealthColor,
  type FinancialHealthMetrics,
  type HealthRecommendation,
} from "@/utils/financial-health-dashboard";

const screenWidth = Dimensions.get("window").width;

export default function FinancialHealthDashboardScreen() {
  const colors = useColors();
  const [metrics, setMetrics] = useState<FinancialHealthMetrics | null>(null);
  const [recommendations, setRecommendations] = useState<HealthRecommendation[]>([]);
  const [history, setHistory] = useState<{ date: Date; score: number }[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const healthMetrics = await calculateFinancialHealth();
      const recs = await generateRecommendations(healthMetrics);
      const historyData = await getHealthHistory();

      setMetrics(healthMetrics);
      setRecommendations(recs);
      setHistory(historyData);

      // Save snapshot
      await saveHealthSnapshot(healthMetrics.overallScore);
    } catch (error) {
      console.error("Failed to load health data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading || !metrics) {
    return (
      <ScreenContainer className="p-4 justify-center items-center">
        <Text className="text-muted">Loading financial health data...</Text>
      </ScreenContainer>
    );
  }

  const healthRating = getHealthRating(metrics.overallScore);
  const healthColorName = getHealthColor(metrics.overallScore);
  const healthColor =
    healthColorName === "success" ? colors.success : healthColorName === "warning" ? colors.warning : colors.error;

  return (
    <ScreenContainer className="p-4">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Header */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground">Financial Health</Text>
          <Text className="text-sm text-muted mt-1">Comprehensive view of your financial wellness</Text>
        </View>

        {/* Overall Score */}
        <View className="bg-surface rounded-2xl p-6 mb-4 border border-border items-center">
          <Text className="text-sm text-muted mb-2">Overall Health Score</Text>
          <Text className="text-6xl font-bold mb-2" style={{ color: healthColor }}>
            {metrics.overallScore}
          </Text>
          <View className="px-4 py-2 rounded-full" style={{ backgroundColor: healthColor + "20" }}>
            <Text className="font-semibold" style={{ color: healthColor }}>
              {healthRating}
            </Text>
          </View>
        </View>

        {/* Score History Chart */}
        {history.length > 1 && (
          <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
            <Text className="text-base font-semibold text-foreground mb-3">Score Trend</Text>
            <LineChart
              data={{
                labels: history.slice(-6).map((h) => {
                  const date = new Date(h.date);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }),
                datasets: [
                  {
                    data: history.slice(-6).map((h) => h.score),
                  },
                ],
              }}
              width={screenWidth - 64}
              height={180}
              chartConfig={{
                backgroundColor: colors.surface,
                backgroundGradientFrom: colors.surface,
                backgroundGradientTo: colors.surface,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(10, 126, 164, ${opacity})`,
                labelColor: (opacity = 1) => colors.muted,
                style: {
                  borderRadius: 16,
                },
                propsForDots: {
                  r: "4",
                  strokeWidth: "2",
                  stroke: colors.primary,
                },
              }}
              bezier
              style={{
                borderRadius: 16,
              }}
              yAxisLabel=""
              yAxisSuffix=""
            />
          </View>
        )}

        {/* Component Metrics */}
        <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
          <Text className="text-base font-semibold text-foreground mb-4">Health Components</Text>

          {/* Credit Score */}
          <View className="mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-sm text-foreground">Credit Score</Text>
              <Text className="text-base font-bold text-foreground">{metrics.creditScore.score}</Text>
            </View>
            <View className="flex-row items-center">
              <View className="flex-1 bg-background rounded-full h-2 mr-2">
                <View
                  className="bg-primary rounded-full h-2"
                  style={{ width: `${(metrics.creditScore.score / 850) * 100}%` }}
                />
              </View>
              <Text className="text-xs text-muted">{metrics.creditScore.rating}</Text>
            </View>
          </View>

          {/* Net Worth */}
          <View className="mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-sm text-foreground">Net Worth</Text>
              <Text className="text-base font-bold text-foreground">${metrics.netWorth.value.toFixed(0)}</Text>
            </View>
            <View className="flex-row items-center">
              <View className="flex-1 bg-background rounded-full h-2 mr-2">
                <View
                  className="bg-primary rounded-full h-2"
                  style={{ width: `${Math.min((metrics.netWorth.value / 100000) * 100, 100)}%` }}
                />
              </View>
              <Text className="text-xs text-muted">Target: $100k</Text>
            </View>
          </View>

          {/* Budget Adherence */}
          <View className="mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-sm text-foreground">Budget Adherence</Text>
              <Text className="text-base font-bold text-foreground">{metrics.budgetAdherence.score}%</Text>
            </View>
            <View className="flex-row items-center">
              <View className="flex-1 bg-background rounded-full h-2 mr-2">
                <View className="bg-primary rounded-full h-2" style={{ width: `${metrics.budgetAdherence.score}%` }} />
              </View>
              <Text className="text-xs text-muted">
                {metrics.budgetAdherence.categoriesOnTrack}/{metrics.budgetAdherence.totalCategories} on track
              </Text>
            </View>
          </View>

          {/* Savings Progress */}
          <View className="mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-sm text-foreground">Savings Goals</Text>
              <Text className="text-base font-bold text-foreground">{metrics.savingsProgress.score}%</Text>
            </View>
            <View className="flex-row items-center">
              <View className="flex-1 bg-background rounded-full h-2 mr-2">
                <View className="bg-primary rounded-full h-2" style={{ width: `${metrics.savingsProgress.score}%` }} />
              </View>
              <Text className="text-xs text-muted">
                {metrics.savingsProgress.goalsOnTrack}/{metrics.savingsProgress.totalGoals} on track
              </Text>
            </View>
          </View>

          {/* Debt-to-Income */}
          <View>
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-sm text-foreground">Debt-to-Income Ratio</Text>
              <Text className="text-base font-bold text-foreground">{metrics.debtToIncome.ratio}%</Text>
            </View>
            <View className="flex-row items-center">
              <View className="flex-1 bg-background rounded-full h-2 mr-2">
                <View
                  className="bg-primary rounded-full h-2"
                  style={{ width: `${Math.min(metrics.debtToIncome.ratio, 100)}%` }}
                />
              </View>
              <Text className="text-xs text-muted">{metrics.debtToIncome.rating}</Text>
            </View>
          </View>
        </View>

        {/* AI Recommendations */}
        <View className="mb-4">
          <Text className="text-xl font-bold text-foreground mb-3">AI Recommendations</Text>
          {recommendations.length === 0 ? (
            <View className="bg-surface rounded-xl p-6 border border-border items-center">
              <Text className="text-success text-center font-semibold mb-1">Excellent Financial Health!</Text>
              <Text className="text-muted text-center text-sm">
                Keep up the great work. Your finances are in excellent shape.
              </Text>
            </View>
          ) : (
            recommendations.map((rec) => (
              <View key={rec.id} className="bg-surface rounded-xl p-4 mb-3 border border-border">
                <View className="flex-row justify-between items-start mb-2">
                  <View className="flex-1">
                    <Text className="text-base font-bold text-foreground mb-1">{rec.title}</Text>
                    <View
                      className={`self-start px-2 py-1 rounded-full ${
                        rec.priority === "high"
                          ? "bg-error"
                          : rec.priority === "medium"
                          ? "bg-warning"
                          : "bg-primary"
                      }`}
                    >
                      <Text className="text-background text-xs font-semibold capitalize">{rec.priority} Priority</Text>
                    </View>
                  </View>
                </View>
                <Text className="text-sm text-muted mb-3">{rec.description}</Text>
                <View className="bg-background rounded-lg p-3 mb-2">
                  <Text className="text-xs text-muted mb-1">Recommended Action:</Text>
                  <Text className="text-sm text-foreground">{rec.action}</Text>
                </View>
                <View className="flex-row items-center">
                  <Text className="text-xs text-success font-semibold">💡 {rec.potentialImpact}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
