import { ScrollView, Text, View, Pressable, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { LineChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  getCurrentCreditScore,
  getCreditScoreHistory,
  analyzeCreditFactors,
  getPersonalizedTips,
  getCreditScoreRange,
  getCreditAlerts,
  calculateCreditScoreTrend,
  type CreditScore,
  type CreditFactor,
  type CreditAlert,
} from "@/utils/credit-score";

const screenWidth = Dimensions.get("window").width;

export default function CreditScoreScreen() {
  const colors = useColors();
  const [currentScore, setCurrentScore] = useState<CreditScore | null>(null);
  const [scoreHistory, setScoreHistory] = useState<CreditScore[]>([]);
  const [factors, setFactors] = useState<CreditFactor[]>([]);
  const [tips, setTips] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<CreditAlert[]>([]);
  const [trend, setTrend] = useState<{
    trend: "improving" | "stable" | "declining";
    change: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<"overview" | "factors" | "tips" | "alerts">(
    "overview"
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const score = await getCurrentCreditScore();
      const history = await getCreditScoreHistory();
      const factorsData = await analyzeCreditFactors(score.score);
      const tipsData = await getPersonalizedTips(score.score);
      const alertsData = await getCreditAlerts();
      const trendData = await calculateCreditScoreTrend();

      setCurrentScore(score);
      setScoreHistory(history);
      setFactors(factorsData);
      setTips(tipsData);
      setAlerts(alertsData);
      setTrend(trendData);
    } catch (error) {
      console.error("Failed to load credit score data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (tab: typeof selectedTab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTab(tab);
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "high":
        return colors.error;
      case "medium":
        return colors.warning;
      case "low":
        return colors.success;
      default:
        return colors.muted;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "excellent":
        return colors.success;
      case "good":
        return "#4ADE80";
      case "fair":
        return colors.warning;
      case "poor":
        return colors.error;
      default:
        return colors.muted;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "improving":
        return "📈";
      case "declining":
        return "📉";
      default:
        return "➡️";
    }
  };

  if (isLoading || !currentScore) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-base text-muted mt-4">Loading credit score...</Text>
        </View>
      </ScreenContainer>
    );
  }

  const scoreRange = getCreditScoreRange(currentScore.score);

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View>
            <Text className="text-2xl font-bold text-foreground mb-2">Credit Score</Text>
            <Text className="text-sm text-muted">
              Monitor and improve your credit health
            </Text>
          </View>

          {/* Current Score Card */}
          <View
            style={{ backgroundColor: scoreRange.color + "20" }}
            className="rounded-2xl p-6 items-center"
          >
            <Text className="text-6xl font-bold text-foreground mb-2">
              {currentScore.score}
            </Text>
            <Text
              style={{ color: scoreRange.color }}
              className="text-xl font-bold mb-2"
            >
              {scoreRange.range}
            </Text>
            <Text className="text-sm text-muted text-center mb-4">
              {scoreRange.description}
            </Text>

            {trend && (
              <View className="flex-row items-center gap-2">
                <Text className="text-2xl">{getTrendIcon(trend.trend)}</Text>
                <Text
                  style={{
                    color:
                      trend.change > 0
                        ? colors.success
                        : trend.change < 0
                        ? colors.error
                        : colors.muted,
                  }}
                  className="text-base font-bold"
                >
                  {trend.change > 0 ? "+" : ""}
                  {trend.change} points
                </Text>
                <Text className="text-sm text-muted">this month</Text>
              </View>
            )}

            <Text className="text-xs text-muted mt-3">
              Last updated: {new Date(currentScore.date).toLocaleDateString()}
            </Text>
          </View>

          {/* Tabs */}
          <View className="flex-row gap-2">
            {(["overview", "factors", "tips", "alerts"] as const).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => handleTabChange(tab)}
                style={({ pressed }) => [
                  {
                    backgroundColor:
                      selectedTab === tab ? colors.primary : colors.surface,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                className="flex-1 rounded-xl px-4 py-3"
              >
                <Text
                  style={{
                    color:
                      selectedTab === tab ? colors.background : colors.foreground,
                  }}
                  className="text-center font-bold text-sm capitalize"
                >
                  {tab}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Tab Content */}
          {selectedTab === "overview" && (
            <View>
              <Text className="text-lg font-bold text-foreground mb-4">
                Score History
              </Text>

              {scoreHistory.length > 1 && (
                <View style={{ backgroundColor: colors.surface }} className="rounded-2xl p-4">
                  <LineChart
                    data={{
                      labels: scoreHistory
                        .slice(0, 6)
                        .reverse()
                        .map((s) => {
                          const date = new Date(s.date);
                          return `${date.getMonth() + 1}/${date.getDate()}`;
                        }),
                      datasets: [
                        {
                          data: scoreHistory.slice(0, 6).reverse().map((s) => s.score),
                        },
                      ],
                    }}
                    width={screenWidth - 80}
                    height={220}
                    chartConfig={{
                      backgroundColor: colors.surface,
                      backgroundGradientFrom: colors.surface,
                      backgroundGradientTo: colors.surface,
                      decimalPlaces: 0,
                      color: (opacity = 1) => colors.primary,
                      labelColor: (opacity = 1) => colors.muted,
                      style: {
                        borderRadius: 16,
                      },
                      propsForDots: {
                        r: "6",
                        strokeWidth: "2",
                        stroke: colors.primary,
                      },
                    }}
                    bezier
                    style={{
                      marginVertical: 8,
                      borderRadius: 16,
                    }}
                  />
                </View>
              )}
            </View>
          )}

          {selectedTab === "factors" && (
            <View>
              <Text className="text-lg font-bold text-foreground mb-4">
                Credit Factors
              </Text>

              {factors.map((factor, index) => (
                <View
                  key={index}
                  style={{ backgroundColor: colors.surface }}
                  className="rounded-2xl p-5 mb-4"
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-base font-bold text-foreground">
                      {factor.name}
                    </Text>
                    <View className="flex-row items-center gap-2">
                      <View
                        style={{
                          backgroundColor: getStatusColor(factor.status) + "20",
                        }}
                        className="rounded-full px-3 py-1"
                      >
                        <Text
                          style={{ color: getStatusColor(factor.status) }}
                          className="text-xs font-bold capitalize"
                        >
                          {factor.status}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Text className="text-sm text-muted mb-3">{factor.description}</Text>

                  <View className="flex-row items-center gap-3 mb-3">
                    <View className="flex-1">
                      <View
                        style={{ backgroundColor: colors.background }}
                        className="h-2 rounded-full overflow-hidden"
                      >
                        <View
                          style={{
                            backgroundColor: getImpactColor(factor.impact),
                            width: `${factor.percentage}%`,
                          }}
                          className="h-full"
                        />
                      </View>
                    </View>
                    <Text className="text-sm text-muted">{factor.percentage}%</Text>
                  </View>

                  <View
                    style={{ backgroundColor: colors.background }}
                    className="rounded-xl p-3"
                  >
                    <Text className="text-xs text-muted mb-2">Impact Level:</Text>
                    <View className="flex-row items-center gap-2">
                      <View
                        style={{
                          backgroundColor: getImpactColor(factor.impact) + "20",
                        }}
                        className="rounded-full px-3 py-1"
                      >
                        <Text
                          style={{ color: getImpactColor(factor.impact) }}
                          className="text-xs font-bold capitalize"
                        >
                          {factor.impact}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {selectedTab === "tips" && (
            <View>
              <Text className="text-lg font-bold text-foreground mb-4">
                Personalized Tips
              </Text>

              {tips.map((tip, index) => (
                <View
                  key={index}
                  style={{ backgroundColor: colors.surface }}
                  className="rounded-2xl p-5 mb-3"
                >
                  <View className="flex-row items-start gap-3">
                    <View
                      style={{ backgroundColor: colors.primary + "20" }}
                      className="rounded-full w-8 h-8 items-center justify-center"
                    >
                      <Text style={{ color: colors.primary }} className="font-bold">
                        {index + 1}
                      </Text>
                    </View>
                    <Text className="flex-1 text-sm text-foreground leading-relaxed">
                      {tip}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {selectedTab === "alerts" && (
            <View>
              <Text className="text-lg font-bold text-foreground mb-4">
                Recent Alerts
              </Text>

              {alerts.length === 0 ? (
                <View
                  style={{ backgroundColor: colors.surface }}
                  className="rounded-2xl p-8 items-center"
                >
                  <Text className="text-4xl mb-3">🔔</Text>
                  <Text className="text-base text-muted text-center">
                    No recent alerts
                  </Text>
                </View>
              ) : (
                alerts.map((alert) => (
                  <View
                    key={alert.id}
                    style={{ backgroundColor: colors.surface }}
                    className="rounded-2xl p-5 mb-3"
                  >
                    <View className="flex-row items-start gap-3">
                      <Text className="text-2xl">
                        {alert.severity === "critical"
                          ? "🚨"
                          : alert.severity === "warning"
                          ? "⚠️"
                          : "ℹ️"}
                      </Text>
                      <View className="flex-1">
                        <Text className="text-base font-bold text-foreground mb-1">
                          {alert.title}
                        </Text>
                        <Text className="text-sm text-muted mb-2">
                          {alert.description}
                        </Text>
                        <Text className="text-xs text-muted">
                          {new Date(alert.date).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
