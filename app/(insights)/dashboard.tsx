import { ScrollView, Text, View, Pressable, Dimensions, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import { LineChart, BarChart, PieChart } from "react-native-chart-kit";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

const screenWidth = Dimensions.get("window").width;

interface SpendingTrend {
  month: string;
  amount: number;
}

interface CategorySpending {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

interface BudgetComparison {
  category: string;
  budget: number;
  actual: number;
  difference: number;
}

export default function InsightsDashboardScreen() {
  const colors = useColors();
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"3M" | "6M" | "1Y">("6M");
  const [spendingTrends, setSpendingTrends] = useState<SpendingTrend[]>([]);
  const [categorySpending, setCategorySpending] = useState<CategorySpending[]>([]);
  const [budgetComparison, setBudgetComparison] = useState<BudgetComparison[]>([]);
  const [totalSpending, setTotalSpending] = useState(0);
  const [averageMonthly, setAverageMonthly] = useState(0);
  const [recommendations, setRecommendations] = useState<string[]>([]);

  useEffect(() => {
    loadInsights();
  }, [timeRange]);

  const loadInsights = async () => {
    try {
      setIsLoading(true);
      
      // Fetch transactions
      const response = await fetch("http://127.0.0.1:3000/api/trpc/getTransactions", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch transactions");
      }

      const data = await response.json();
      const transactions = data.result?.data || [];

      // Get categorization stats
      const statsResponse = await fetch("http://127.0.0.1:3000/api/categorization/stats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transactions: transactions.map((t: any) => ({
            id: t.id,
            description: t.description || t.recipient || "Transaction",
            merchant: t.recipient,
            amount: Math.abs(t.amount),
            type: t.amount < 0 ? "debit" : "credit",
          })),
        }),
      });

      if (!statsResponse.ok) {
        throw new Error("Failed to get category stats");
      }

      const statsData = await statsResponse.json();
      
      // Calculate spending trends
      const trends = calculateSpendingTrends(transactions, timeRange);
      setSpendingTrends(trends);
      
      // Process category spending
      const categoryColors = [
        "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF",
        "#FF9F40", "#FF6384", "#C9CBCF", "#4BC0C0", "#FF6384"
      ];
      
      const categories: CategorySpending[] = (statsData.stats || []).slice(0, 6).map((stat: any, index: number) => ({
        category: stat.category_name,
        amount: stat.total_amount,
        percentage: stat.percentage,
        color: categoryColors[index % categoryColors.length],
      }));
      
      setCategorySpending(categories);
      
      // Calculate budget comparison
      const budgets = await loadBudgets();
      const comparison = calculateBudgetComparison(categories, budgets);
      setBudgetComparison(comparison);
      
      // Calculate totals
      const total = categories.reduce((sum, c) => sum + c.amount, 0);
      setTotalSpending(total);
      setAverageMonthly(total / getMonthCount(timeRange));
      
      // Generate recommendations
      const recs = generateRecommendations(categories, comparison, total);
      setRecommendations(recs);
      
    } catch (error) {
      console.error("Failed to load insights:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateSpendingTrends = (transactions: any[], range: string): SpendingTrend[] => {
    const months = getMonthCount(range);
    const now = new Date();
    const trends: SpendingTrend[] = [];
    
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString("en-US", { month: "short" });
      
      const monthStart = date.getTime();
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59).getTime();
      
      const monthTransactions = transactions.filter((t: any) => {
        const tDate = new Date(t.created_at || t.date || Date.now()).getTime();
        return tDate >= monthStart && tDate <= monthEnd && t.amount < 0;
      });
      
      const amount = monthTransactions.reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);
      trends.push({ month: monthName, amount });
    }
    
    return trends;
  };

  const loadBudgets = async (): Promise<Record<string, number>> => {
    try {
      const budgetsJson = await fetch("http://127.0.0.1:3000/api/trpc/getBudgets").then(r => r.json());
      const budgets: Record<string, number> = {};
      
      (budgetsJson.result?.data || []).forEach((b: any) => {
        budgets[b.category] = b.limit;
      });
      
      return budgets;
    } catch {
      return {};
    }
  };

  const calculateBudgetComparison = (
    categories: CategorySpending[],
    budgets: Record<string, number>
  ): BudgetComparison[] => {
    return categories.map(cat => {
      const budget = budgets[cat.category] || cat.amount * 1.2;
      return {
        category: cat.category,
        budget,
        actual: cat.amount,
        difference: budget - cat.amount,
      };
    });
  };

  const generateRecommendations = (
    categories: CategorySpending[],
    comparison: BudgetComparison[],
    total: number
  ): string[] => {
    const recs: string[] = [];
    
    // Check for overspending
    const overspent = comparison.filter(c => c.difference < 0);
    if (overspent.length > 0) {
      recs.push(`You're over budget in ${overspent.length} ${overspent.length === 1 ? 'category' : 'categories'}. Consider reducing spending in ${overspent[0].category}.`);
    }
    
    // Check top spending category
    if (categories.length > 0) {
      const top = categories[0];
      if (top.percentage > 30) {
        recs.push(`${top.category} accounts for ${top.percentage.toFixed(0)}% of your spending. Look for ways to reduce costs here.`);
      }
    }
    
    // Savings recommendation
    const savingsRate = 0.2; // 20% recommended
    const recommendedSavings = total * savingsRate;
    recs.push(`Try to save at least $${recommendedSavings.toFixed(2)} per month (20% of spending).`);
    
    // Positive feedback
    const underBudget = comparison.filter(c => c.difference > 0);
    if (underBudget.length > 0) {
      recs.push(`Great job! You're under budget in ${underBudget.length} ${underBudget.length === 1 ? 'category' : 'categories'}.`);
    }
    
    return recs;
  };

  const getMonthCount = (range: string): number => {
    switch (range) {
      case "3M": return 3;
      case "6M": return 6;
      case "1Y": return 12;
      default: return 6;
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-sm text-muted mt-4">Analyzing spending...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">
              Spending Insights
            </Text>
            <Text className="text-sm text-muted">
              AI-powered analysis of your spending patterns
            </Text>
          </View>

          {/* Time Range Selector */}
          <View className="flex-row gap-2">
            {(["3M", "6M", "1Y"] as const).map((range) => (
              <Pressable
                key={range}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setTimeRange(range);
                }}
                style={{
                  backgroundColor: timeRange === range ? colors.primary : colors.surface,
                  borderColor: colors.border,
                }}
                className="flex-1 border rounded-xl py-3"
              >
                <Text
                  style={{
                    color: timeRange === range ? colors.background : colors.foreground,
                  }}
                  className="text-center font-semibold"
                >
                  {range}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Summary Cards */}
          <View className="flex-row gap-3">
            <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-sm text-muted mb-1">Total Spending</Text>
              <Text className="text-xl font-bold text-foreground">
                ${totalSpending.toFixed(2)}
              </Text>
            </View>
            <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-sm text-muted mb-1">Monthly Avg</Text>
              <Text className="text-xl font-bold text-foreground">
                ${averageMonthly.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Spending Trends Chart */}
          {spendingTrends.length > 0 && (
            <View className="bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-lg font-semibold text-foreground mb-4">
                Spending Trends
              </Text>
              <LineChart
                data={{
                  labels: spendingTrends.map(t => t.month),
                  datasets: [{
                    data: spendingTrends.map(t => t.amount),
                  }],
                }}
                width={screenWidth - 80}
                height={220}
                chartConfig={{
                  backgroundColor: colors.surface,
                  backgroundGradientFrom: colors.surface,
                  backgroundGradientTo: colors.surface,
                  decimalPlaces: 0,
                  color: (opacity = 1) => colors.primary,
                  labelColor: (opacity = 1) => colors.foreground,
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
                  marginVertical: 8,
                  borderRadius: 16,
                }}
              />
            </View>
          )}

          {/* Category Breakdown */}
          {categorySpending.length > 0 && (
            <View className="bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-lg font-semibold text-foreground mb-4">
                Spending by Category
              </Text>
              <PieChart
                data={categorySpending.map(cat => ({
                  name: cat.category,
                  population: cat.amount,
                  color: cat.color,
                  legendFontColor: colors.foreground,
                  legendFontSize: 12,
                }))}
                width={screenWidth - 80}
                height={220}
                chartConfig={{
                  color: (opacity = 1) => colors.primary,
                }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute
              />
            </View>
          )}

          {/* Budget vs Actual */}
          {budgetComparison.length > 0 && (
            <View className="bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-lg font-semibold text-foreground mb-4">
                Budget vs Actual
              </Text>
              <BarChart
                yAxisLabel="$"
                yAxisSuffix=""
                data={{
                  labels: budgetComparison.map(b => b.category.substring(0, 8)),
                  datasets: [
                    {
                      data: budgetComparison.map(b => b.budget),
                      color: (opacity = 1) => colors.muted,
                    },
                    {
                      data: budgetComparison.map(b => b.actual),
                      color: (opacity = 1) => colors.primary,
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
                  labelColor: (opacity = 1) => colors.foreground,
                }}
                style={{
                  marginVertical: 8,
                  borderRadius: 16,
                }}
              />
            </View>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">
                Recommendations
              </Text>
              {recommendations.map((rec, index) => (
                <View
                  key={index}
                  className="bg-surface rounded-2xl p-4 border border-border"
                >
                  <View className="flex-row items-start gap-3">
                    <Text className="text-2xl">💡</Text>
                    <Text className="flex-1 text-sm text-foreground leading-relaxed">
                      {rec}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
