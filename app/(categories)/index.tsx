import { ScrollView, Text, View, Pressable, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

interface CategoryStat {
  category: string;
  category_name: string;
  category_icon: string;
  count: number;
  total_amount: number;
  percentage: number;
}

export default function CategoriesScreen() {
  const colors = useColors();
  const [stats, setStats] = useState<CategoryStat[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCategoryStats();
  }, []);

  const loadCategoryStats = async () => {
    try {
      setIsLoading(true);
      
      // Fetch recent transactions
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

      // Get category stats
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
      setStats(statsData.stats || []);
      setTotalAmount(statsData.total_amount || 0);
      setTotalTransactions(statsData.total_transactions || 0);
    } catch (error) {
      console.error("Failed to load category stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage > 30) return colors.error;
    if (percentage > 15) return colors.warning;
    return colors.success;
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
              Spending Categories
            </Text>
            <Text className="text-sm text-muted">
              AI-powered transaction categorization
            </Text>
          </View>

          {/* Summary Cards */}
          <View className="flex-row gap-3">
            <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-sm text-muted mb-1">Total Spending</Text>
              <Text className="text-xl font-bold text-foreground">
                ${totalAmount.toFixed(2)}
              </Text>
            </View>
            <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-sm text-muted mb-1">Transactions</Text>
              <Text className="text-xl font-bold text-foreground">
                {totalTransactions}
              </Text>
            </View>
            <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-sm text-muted mb-1">Categories</Text>
              <Text className="text-xl font-bold text-foreground">
                {stats.length}
              </Text>
            </View>
          </View>

          {/* Category Breakdown */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">
              Breakdown by Category
            </Text>

            {stats.map((stat) => (
              <Pressable
                key={stat.category}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/(categories)/${stat.category}`);
                }}
                style={({ pressed }) => [
                  {
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <View className="bg-surface rounded-2xl p-4 border border-border">
                  <View className="flex-row items-center gap-3 mb-3">
                    <View
                      style={{ backgroundColor: getProgressColor(stat.percentage) + "20" }}
                      className="w-12 h-12 rounded-full items-center justify-center"
                    >
                      <Text className="text-2xl">{stat.category_icon}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-foreground">
                        {stat.category_name}
                      </Text>
                      <Text className="text-sm text-muted">
                        {stat.count} transaction{stat.count !== 1 ? "s" : ""}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-lg font-bold text-foreground">
                        ${stat.total_amount.toFixed(2)}
                      </Text>
                      <Text
                        style={{ color: getProgressColor(stat.percentage) }}
                        className="text-sm font-semibold"
                      >
                        {stat.percentage}%
                      </Text>
                    </View>
                  </View>

                  {/* Progress Bar */}
                  <View
                    style={{ backgroundColor: colors.border }}
                    className="h-2 rounded-full overflow-hidden"
                  >
                    <View
                      style={{
                        backgroundColor: getProgressColor(stat.percentage),
                        width: `${stat.percentage}%`,
                      }}
                      className="h-full"
                    />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>

          {/* Empty State */}
          {stats.length === 0 && (
            <View className="items-center justify-center py-12">
              <Text className="text-6xl mb-4">📊</Text>
              <Text className="text-lg font-semibold text-foreground mb-2">
                No spending data yet
              </Text>
              <Text className="text-sm text-muted text-center">
                Make some transactions to see your spending breakdown
              </Text>
            </View>
          )}

          {/* Info Card */}
          <View className="bg-surface rounded-2xl p-4 border border-border">
            <View className="flex-row items-start gap-3">
              <Text className="text-2xl">🤖</Text>
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground mb-1">
                  AI-Powered Categorization
                </Text>
                <Text className="text-sm text-muted leading-relaxed">
                  Transactions are automatically categorized using machine learning. You can correct categories to improve accuracy over time.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
