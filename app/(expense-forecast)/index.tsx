import { ScrollView, Text, View, Pressable, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { LineChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import axios from "axios";

const screenWidth = Dimensions.get("window").width;

interface Forecast {
  date: number;
  amount: number;
  confidence: number;
  dateStr: string;
}

interface Pattern {
  daily_average: number;
  weekly_average: number;
  monthly_average: number;
  volatility: number;
  trend: "increasing" | "stable" | "decreasing";
}

interface UpcomingExpense {
  merchant: string;
  expectedDate: number;
  expectedAmount: number;
  daysUntil: number;
  frequency: string;
  confidence: number;
}

export default function ExpenseForecastScreen() {
  const colors = useColors();
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [patterns, setPatterns] = useState<Pattern | null>(null);
  const [upcomingExpenses, setUpcomingExpenses] = useState<UpcomingExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<"forecast" | "patterns" | "upcoming">("forecast");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Generate mock transactions for the last 90 days
      const transactions = generateMockTransactions();

      // Fetch forecasts
      const forecastResponse = await axios.post("http://127.0.0.1:3000/api/trpc/expenseForecast.forecast", {
        transactions,
        days: 30,
      });

      // Fetch patterns
      const patternsResponse = await axios.post("http://127.0.0.1:3000/api/trpc/expenseForecast.analyzePatterns", {
        transactions,
      });

      // Fetch upcoming expenses
      const upcomingResponse = await axios.post("http://127.0.0.1:3000/api/trpc/expenseForecast.upcomingExpenses", {
        transactions,
      });

      setForecasts(forecastResponse.data.result.data);
      setPatterns(patternsResponse.data.result.data);
      setUpcomingExpenses(upcomingResponse.data.result.data);
    } catch (error) {
      console.error("Failed to load expense forecast data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockTransactions = () => {
    const transactions = [];
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    const merchants = ["Grocery Store", "Gas Station", "Restaurant", "Coffee Shop", "Pharmacy"];
    const categories = ["Food", "Transportation", "Dining", "Shopping", "Healthcare"];

    for (let i = 0; i < 90; i++) {
      const numTransactions = Math.floor(Math.random() * 3) + 1;

      for (let j = 0; j < numTransactions; j++) {
        const merchantIndex = Math.floor(Math.random() * merchants.length);
        transactions.push({
          id: `${i}-${j}`,
          amount: Math.random() * 100 + 10,
          date: now - i * oneDay - Math.random() * oneDay,
          merchant: merchants[merchantIndex],
          description: `Purchase at ${merchants[merchantIndex]}`,
          category: categories[merchantIndex],
        });
      }
    }

    return transactions;
  };

  const handleTabChange = (tab: typeof selectedTab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTab(tab);
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "increasing":
        return "📈";
      case "decreasing":
        return "📉";
      default:
        return "➡️";
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "increasing":
        return colors.error;
      case "decreasing":
        return colors.success;
      default:
        return colors.muted;
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-base text-muted mt-4">Analyzing spending patterns...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View>
            <Text className="text-2xl font-bold text-foreground mb-2">Expense Forecast</Text>
            <Text className="text-sm text-muted">
              ML-powered predictions for your future expenses
            </Text>
          </View>

          {/* Summary Card */}
          {patterns && (
            <View
              style={{ backgroundColor: colors.surface }}
              className="rounded-2xl p-6"
            >
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-lg font-bold text-foreground">Spending Trend</Text>
                <View className="flex-row items-center gap-2">
                  <Text className="text-2xl">{getTrendIcon(patterns.trend)}</Text>
                  <Text
                    style={{ color: getTrendColor(patterns.trend) }}
                    className="text-base font-bold capitalize"
                  >
                    {patterns.trend}
                  </Text>
                </View>
              </View>

              <View className="flex-row gap-4">
                <View className="flex-1">
                  <Text className="text-2xl font-bold text-foreground">
                    ${patterns.daily_average.toFixed(0)}
                  </Text>
                  <Text className="text-xs text-muted">Daily Average</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-2xl font-bold text-foreground">
                    ${patterns.monthly_average.toFixed(0)}
                  </Text>
                  <Text className="text-xs text-muted">Monthly Forecast</Text>
                </View>
              </View>
            </View>
          )}

          {/* Tabs */}
          <View className="flex-row gap-2">
            {(["forecast", "patterns", "upcoming"] as const).map((tab) => (
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
          {selectedTab === "forecast" && forecasts.length > 0 && (
            <View>
              <Text className="text-lg font-bold text-foreground mb-4">
                30-Day Forecast
              </Text>

              <View style={{ backgroundColor: colors.surface }} className="rounded-2xl p-4 mb-4">
                <LineChart
                  data={{
                    labels: forecasts
                      .filter((_, i) => i % 5 === 0)
                      .map((f) => {
                        const date = new Date(f.date);
                        return `${date.getMonth() + 1}/${date.getDate()}`;
                      }),
                    datasets: [
                      {
                        data: forecasts.filter((_, i) => i % 5 === 0).map((f) => f.amount),
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

              {/* Weekly Breakdown */}
              <View>
                <Text className="text-base font-bold text-foreground mb-3">
                  Weekly Breakdown
                </Text>
                {[0, 7, 14, 21].map((startDay) => {
                  const weekForecasts = forecasts.slice(startDay, startDay + 7);
                  const weekTotal = weekForecasts.reduce((sum, f) => sum + f.amount, 0);
                  const avgConfidence =
                    weekForecasts.reduce((sum, f) => sum + f.confidence, 0) /
                    weekForecasts.length;

                  return (
                    <View
                      key={startDay}
                      style={{ backgroundColor: colors.surface }}
                      className="rounded-2xl p-5 mb-3"
                    >
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-base font-bold text-foreground">
                          Week {startDay / 7 + 1}
                        </Text>
                        <Text className="text-xl font-bold text-foreground">
                          ${weekTotal.toFixed(0)}
                        </Text>
                      </View>

                      <View className="flex-row items-center gap-2">
                        <View
                          style={{ backgroundColor: colors.background }}
                          className="h-2 flex-1 rounded-full overflow-hidden"
                        >
                          <View
                            style={{
                              backgroundColor: colors.primary,
                              width: `${avgConfidence}%`,
                            }}
                            className="h-full"
                          />
                        </View>
                        <Text className="text-xs text-muted">
                          {avgConfidence.toFixed(0)}% confidence
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {selectedTab === "patterns" && patterns && (
            <View>
              <Text className="text-lg font-bold text-foreground mb-4">
                Spending Patterns
              </Text>

              <View
                style={{ backgroundColor: colors.surface }}
                className="rounded-2xl p-5 mb-4"
              >
                <Text className="text-base font-bold text-foreground mb-4">
                  Average Spending
                </Text>

                <View className="gap-3">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-muted">Daily</Text>
                    <Text className="text-base font-bold text-foreground">
                      ${patterns.daily_average.toFixed(2)}
                    </Text>
                  </View>

                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-muted">Weekly</Text>
                    <Text className="text-base font-bold text-foreground">
                      ${patterns.weekly_average.toFixed(2)}
                    </Text>
                  </View>

                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-muted">Monthly</Text>
                    <Text className="text-base font-bold text-foreground">
                      ${patterns.monthly_average.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>

              <View
                style={{ backgroundColor: colors.surface }}
                className="rounded-2xl p-5"
              >
                <Text className="text-base font-bold text-foreground mb-4">
                  Spending Volatility
                </Text>

                <View className="flex-row items-center gap-3">
                  <View className="flex-1">
                    <View
                      style={{ backgroundColor: colors.background }}
                      className="h-4 rounded-full overflow-hidden"
                    >
                      <View
                        style={{
                          backgroundColor:
                            patterns.volatility < 20
                              ? colors.success
                              : patterns.volatility < 50
                              ? colors.warning
                              : colors.error,
                          width: `${Math.min(100, (patterns.volatility / 100) * 100)}%`,
                        }}
                        className="h-full"
                      />
                    </View>
                  </View>
                  <Text className="text-base font-bold text-foreground">
                    ${patterns.volatility.toFixed(0)}
                  </Text>
                </View>

                <Text className="text-xs text-muted mt-3">
                  {patterns.volatility < 20
                    ? "Your spending is very consistent"
                    : patterns.volatility < 50
                    ? "Your spending varies moderately"
                    : "Your spending is highly variable"}
                </Text>
              </View>
            </View>
          )}

          {selectedTab === "upcoming" && (
            <View>
              <Text className="text-lg font-bold text-foreground mb-4">
                Upcoming Expenses
              </Text>

              {upcomingExpenses.length === 0 ? (
                <View
                  style={{ backgroundColor: colors.surface }}
                  className="rounded-2xl p-8 items-center"
                >
                  <Text className="text-4xl mb-3">📅</Text>
                  <Text className="text-base text-muted text-center">
                    No recurring expenses detected
                  </Text>
                </View>
              ) : (
                upcomingExpenses.map((expense, index) => (
                  <View
                    key={index}
                    style={{ backgroundColor: colors.surface }}
                    className="rounded-2xl p-5 mb-3"
                  >
                    <View className="flex-row items-center justify-between mb-3">
                      <Text className="text-base font-bold text-foreground">
                        {expense.merchant}
                      </Text>
                      <Text className="text-xl font-bold text-foreground">
                        ${expense.expectedAmount.toFixed(0)}
                      </Text>
                    </View>

                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-sm text-muted">
                        Expected in {expense.daysUntil} days
                      </Text>
                      <Text className="text-sm text-muted capitalize">
                        {expense.frequency}
                      </Text>
                    </View>

                    <View className="flex-row items-center gap-2">
                      <View
                        style={{ backgroundColor: colors.background }}
                        className="h-2 flex-1 rounded-full overflow-hidden"
                      >
                        <View
                          style={{
                            backgroundColor: colors.primary,
                            width: `${expense.confidence}%`,
                          }}
                          className="h-full"
                        />
                      </View>
                      <Text className="text-xs text-muted">
                        {expense.confidence}% confidence
                      </Text>
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
