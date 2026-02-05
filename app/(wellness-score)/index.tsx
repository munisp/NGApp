import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  calculateFinancialHealthScore,
  getHealthScoreHistory,
  type FinancialHealthScore,
  type FinancialData,
} from "@/utils/financial-health-score";

export default function WellnessScoreScreen() {
  const colors = useColors();
  const [healthScore, setHealthScore] = useState<FinancialHealthScore | null>(null);
  const [history, setHistory] = useState<FinancialHealthScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    
    // Mock financial data - in production, this would come from the backend
    const mockData: FinancialData = {
      monthly_income: 5000,
      monthly_expenses: 3500,
      total_savings: 15000,
      total_debt: 8000,
      monthly_debt_payments: 500,
      budgeted_amount: 4000,
      actual_spending: 3800,
      credit_limit: 10000,
      credit_used: 2500,
    };

    const score = await calculateFinancialHealthScore(mockData);
    setHealthScore(score);

    const historyData = await getHealthScoreHistory();
    setHistory(historyData);

    setIsLoading(false);
  };

  const handleRecalculate = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsCalculating(true);

    // Simulate recalculation
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await loadData();

    setIsCalculating(false);
    Alert.alert("Success", "Financial wellness score updated");
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return colors.success;
    if (score >= 60) return colors.primary;
    if (score >= 40) return colors.warning;
    return colors.error;
  };

  const getGradeEmoji = (grade: string) => {
    switch (grade) {
      case "Excellent":
        return "🌟";
      case "Good":
        return "👍";
      case "Fair":
        return "👌";
      case "Needs Improvement":
        return "⚠️";
      case "Critical":
        return "🚨";
      default:
        return "📊";
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer className="p-6 items-center justify-center">
        <Text className="text-lg text-muted">Calculating wellness score...</Text>
      </ScreenContainer>
    );
  }

  if (!healthScore) {
    return (
      <ScreenContainer className="p-6 items-center justify-center">
        <Text className="text-lg text-muted">No data available</Text>
      </ScreenContainer>
    );
  }

  const scoreColor = getScoreColor(healthScore.overall_score);

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View>
            <Text className="text-2xl font-bold text-foreground">Financial Wellness</Text>
            <Text className="text-base text-muted mt-2">
              Comprehensive health score based on multiple metrics
            </Text>
          </View>

          {/* Overall Score Card */}
          <View
            className="rounded-xl p-6 items-center border"
            style={{
              backgroundColor: scoreColor + "10",
              borderColor: scoreColor,
              borderWidth: 2,
            }}
          >
            <Text className="text-5xl mb-2">{getGradeEmoji(healthScore.grade)}</Text>
            <Text className="text-6xl font-bold mb-2" style={{ color: scoreColor }}>
              {healthScore.overall_score}
            </Text>
            <Text className="text-xl font-semibold text-foreground mb-1">{healthScore.grade}</Text>
            <Text className="text-sm text-muted text-center">
              Your overall financial wellness score
            </Text>
          </View>

          {/* Metric Breakdown */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Score Breakdown</Text>

            {[
              {
                name: "Savings Rate",
                score: healthScore.breakdown.savings_score,
                value: `${healthScore.metrics.savings_rate.toFixed(1)}%`,
                icon: "💰",
                max: 20,
              },
              {
                name: "Debt Management",
                score: healthScore.breakdown.debt_score,
                value: `${healthScore.metrics.debt_to_income_ratio.toFixed(1)}%`,
                icon: "📊",
                max: 20,
              },
              {
                name: "Emergency Fund",
                score: healthScore.breakdown.emergency_fund_score,
                value: `${healthScore.metrics.emergency_fund_months.toFixed(1)} months`,
                icon: "🛡️",
                max: 20,
              },
              {
                name: "Budget Adherence",
                score: healthScore.breakdown.budget_score,
                value: `${healthScore.metrics.budget_adherence.toFixed(1)}%`,
                icon: "📋",
                max: 20,
              },
              {
                name: "Credit Utilization",
                score: healthScore.breakdown.credit_score,
                value: `${healthScore.metrics.credit_utilization.toFixed(1)}%`,
                icon: "💳",
                max: 20,
              },
            ].map((metric) => {
              const percentage = (metric.score / metric.max) * 100;
              const metricColor = getScoreColor(percentage);

              return (
                <View
                  key={metric.name}
                  className="rounded-xl p-4 border"
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  }}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center gap-2 flex-1">
                      <Text className="text-xl">{metric.icon}</Text>
                      <Text className="text-base font-semibold text-foreground">{metric.name}</Text>
                    </View>
                    <Text className="text-lg font-bold" style={{ color: metricColor }}>
                      {metric.score}/{metric.max}
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-2">
                    <View
                      className="flex-1 h-2 rounded-full"
                      style={{ backgroundColor: colors.border }}
                    >
                      <View
                        className="h-2 rounded-full"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: metricColor,
                        }}
                      />
                    </View>
                    <Text className="text-sm text-muted w-20 text-right">{metric.value}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Key Insights */}
          {healthScore.insights.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">Key Insights</Text>

              {healthScore.insights.map((insight, index) => (
                <View
                  key={index}
                  className="rounded-xl p-4 border"
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  }}
                >
                  <Text className="text-sm text-foreground leading-relaxed">💡 {insight}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Recommendations */}
          {healthScore.recommendations.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">Action Plan</Text>

              {healthScore.recommendations.map((recommendation, index) => (
                <View
                  key={index}
                  className="rounded-xl p-4 border"
                  style={{
                    backgroundColor: colors.primary + "10",
                    borderColor: colors.primary,
                  }}
                >
                  <Text className="text-sm text-foreground leading-relaxed">
                    ✅ {recommendation}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* History Trend */}
          {history.length > 1 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">Score History</Text>

              <View
                className="rounded-xl p-4 border"
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                }}
              >
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-base font-semibold text-foreground">Last 6 Months</Text>
                  {history.length >= 2 && (
                    <View className="flex-row items-center gap-1">
                      <Text
                        className="text-sm font-medium"
                        style={{
                          color:
                            history[0].overall_score > history[1].overall_score
                              ? colors.success
                              : colors.error,
                        }}
                      >
                        {history[0].overall_score > history[1].overall_score ? "↑" : "↓"}
                        {Math.abs(history[0].overall_score - history[1].overall_score).toFixed(0)}
                      </Text>
                    </View>
                  )}
                </View>

                <View className="flex-row items-end justify-between h-32">
                  {history.slice(0, 6).reverse().map((item, index) => {
                    const barHeight = (item.overall_score / 100) * 100;
                    const barColor = getScoreColor(item.overall_score);

                    return (
                      <View key={index} className="flex-1 items-center gap-2">
                        <View className="flex-1 w-full items-center justify-end">
                          <View
                            className="w-8 rounded-t"
                            style={{
                              height: `${barHeight}%`,
                              backgroundColor: barColor,
                            }}
                          />
                        </View>
                        <Text className="text-xs text-muted">
                          {new Date(item.calculated_at).toLocaleDateString("en-US", {
                            month: "short",
                          })}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          )}

          {/* Recalculate Button */}
          <TouchableOpacity
            onPress={handleRecalculate}
            disabled={isCalculating}
            className="rounded-xl p-4 items-center"
            style={{
              backgroundColor: isCalculating ? colors.border : colors.primary,
            }}
          >
            <Text className="text-base font-semibold text-white">
              {isCalculating ? "Recalculating..." : "Recalculate Score"}
            </Text>
          </TouchableOpacity>

          {/* Info */}
          <View
            className="rounded-xl p-4"
            style={{ backgroundColor: colors.surface }}
          >
            <Text className="text-sm text-muted leading-relaxed">
              Your financial wellness score is calculated based on five key metrics: savings rate,
              debt management, emergency fund, budget adherence, and credit utilization. The score
              updates automatically as your financial situation changes.
            </Text>
          </View>

          {/* Bottom Spacing */}
          <View className="h-8" />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
