import { ScrollView, Text, View, Pressable, TextInput, Alert } from "react-native";
import { useState, useEffect } from "react";
import { PieChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  getExpenseCategories,
  getCategorySpendingAnalytics,
  getTopSpendingCategories,
  setCategoryBudget,
  getCategoryStatistics,
  type ExpenseCategory,
} from "@/utils/expense-categories";

const screenWidth = Dimensions.get("window").width;

export default function ExpenseCategoriesScreen() {
  const colors = useColors();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [topSpending, setTopSpending] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | null>(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [showBudgetModal, setShowBudgetModal] = useState(false);

  // Mock transactions for demo
  const mockTransactions = [
    { id: "1", amount: -45.50, type: "expense", timestamp: Date.now() - 86400000 },
    { id: "2", amount: -120.00, type: "expense", timestamp: Date.now() - 172800000 },
    { id: "3", amount: -35.75, type: "expense", timestamp: Date.now() - 259200000 },
    { id: "4", amount: -89.99, type: "expense", timestamp: Date.now() - 345600000 },
    { id: "5", amount: -200.00, type: "expense", timestamp: Date.now() - 432000000 },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [cats, analyticsData, topData, statistics] = await Promise.all([
      getExpenseCategories(),
      getCategorySpendingAnalytics(mockTransactions, "month"),
      getTopSpendingCategories(mockTransactions, 5),
      getCategoryStatistics(mockTransactions),
    ]);
    
    setCategories(cats);
    setAnalytics(analyticsData);
    setTopSpending(topData);
    setStats(statistics);
  };

  const handleSetBudget = async () => {
    if (!selectedCategory) return;
    
    const budget = parseFloat(budgetInput);
    if (isNaN(budget) || budget <= 0) {
      Alert.alert("Error", "Please enter a valid budget amount");
      return;
    }
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const success = await setCategoryBudget(selectedCategory.id, budget);
      
      if (success) {
        setShowBudgetModal(false);
        setSelectedCategory(null);
        setBudgetInput("");
        await loadData();
        Alert.alert("Success", `Budget set for ${selectedCategory.name}`);
      } else {
        Alert.alert("Error", "Failed to set budget");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to set budget");
    }
  };

  const openBudgetModal = (category: ExpenseCategory) => {
    setSelectedCategory(category);
    setBudgetInput(category.budget?.toString() || "");
    setShowBudgetModal(true);
  };

  const chartData = topSpending.map((item, index) => ({
    name: item.category.name,
    amount: item.spent,
    color: item.category.color,
    legendFontColor: colors.foreground,
    legendFontSize: 12,
  }));

  if (showBudgetModal && selectedCategory) {
    return (
      <ScreenContainer className="p-6">
        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="gap-6">
            <View className="flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-foreground">Set Budget</Text>
              <Pressable onPress={() => setShowBudgetModal(false)}>
                <Text className="text-base text-muted">Cancel</Text>
              </Pressable>
            </View>

            <View
              style={{ backgroundColor: colors.surface }}
              className="rounded-3xl p-6 border border-border items-center"
            >
              <Text className="text-6xl mb-4">{selectedCategory.icon}</Text>
              <Text className="text-xl font-bold text-foreground">
                {selectedCategory.name}
              </Text>
            </View>

            <View className="gap-2">
              <Text className="text-sm font-medium text-foreground">
                Monthly Budget
              </Text>
              <TextInput
                value={budgetInput}
                onChangeText={setBudgetInput}
                placeholder="500.00"
                keyboardType="decimal-pad"
                autoFocus
                style={{
                  backgroundColor: colors.surface,
                  color: colors.foreground,
                  borderColor: colors.border,
                }}
                className="border rounded-xl px-4 py-3 text-base"
                placeholderTextColor={colors.muted}
              />
              <Text className="text-xs text-muted">
                Set a monthly spending limit for this category
              </Text>
            </View>

            <Pressable
              onPress={handleSetBudget}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              className="rounded-xl py-4 mt-2"
            >
              <Text
                style={{ color: colors.background }}
                className="text-center font-semibold text-base"
              >
                Set Budget
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">Expense Categories</Text>
            <Text className="text-sm text-muted">
              Track spending by category with budgets
            </Text>
          </View>

          {/* Statistics */}
          {stats && (
            <View className="flex-row gap-3">
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Total Spent</Text>
                <Text className="text-2xl font-bold text-foreground">
                  ${stats.total_spent.toFixed(0)}
                </Text>
              </View>
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Over Budget</Text>
                <Text
                  style={{ color: stats.categories_over_budget > 0 ? colors.error : colors.success }}
                  className="text-2xl font-bold"
                >
                  {stats.categories_over_budget}
                </Text>
              </View>
            </View>
          )}

          {/* Top Spending Chart */}
          {chartData.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">
                Top Spending Categories
              </Text>
              <View
                style={{ backgroundColor: colors.surface }}
                className="rounded-2xl p-4 border border-border items-center"
              >
                <PieChart
                  data={chartData}
                  width={screenWidth - 80}
                  height={200}
                  chartConfig={{
                    color: (opacity = 1) => colors.primary,
                    labelColor: (opacity = 1) => colors.foreground,
                  }}
                  accessor="amount"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  absolute
                />
              </View>
            </View>
          )}

          {/* All Categories */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">All Categories</Text>
            
            {categories.map((category) => {
              const categoryAnalytics = analytics.find(
                (a) => a.category.id === category.id
              );
              
              return (
                <Pressable
                  key={category.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    openBudgetModal(category);
                  }}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.surface,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  className="rounded-xl p-4 border border-border"
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      style={{ backgroundColor: category.color + "20" }}
                      className="w-12 h-12 rounded-full items-center justify-center"
                    >
                      <Text className="text-2xl">{category.icon}</Text>
                    </View>
                    
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-foreground">
                        {category.name}
                      </Text>
                      
                      {categoryAnalytics && categoryAnalytics.budget > 0 ? (
                        <>
                          <Text className="text-sm text-muted">
                            ${categoryAnalytics.spent.toFixed(2)} of $
                            {categoryAnalytics.budget.toFixed(2)}
                          </Text>
                          <View className="h-1.5 bg-background rounded-full overflow-hidden mt-1">
                            <View
                              style={{
                                width: `${Math.min(categoryAnalytics.percentage, 100)}%`,
                                backgroundColor: categoryAnalytics.over_budget
                                  ? colors.error
                                  : colors.success,
                              }}
                              className="h-full"
                            />
                          </View>
                        </>
                      ) : (
                        <Text className="text-sm text-muted">No budget set</Text>
                      )}
                    </View>
                    
                    <Text style={{ color: colors.primary }} className="text-sm font-semibold">
                      Set Budget
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Budget Summary */}
          {analytics.filter((a) => a.budget > 0).length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">Budget Status</Text>
              
              {analytics
                .filter((a) => a.budget > 0)
                .map((item) => (
                  <View
                    key={item.category.id}
                    style={{ backgroundColor: colors.surface }}
                    className="rounded-xl p-4 border border-border"
                  >
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-xl">{item.category.icon}</Text>
                        <Text className="text-base font-semibold text-foreground">
                          {item.category.name}
                        </Text>
                      </View>
                      <View
                        style={{
                          backgroundColor: item.over_budget
                            ? colors.error + "20"
                            : colors.success + "20",
                        }}
                        className="px-2 py-1 rounded-full"
                      >
                        <Text
                          style={{
                            color: item.over_budget ? colors.error : colors.success,
                          }}
                          className="text-xs font-semibold"
                        >
                          {item.over_budget ? "Over" : "On Track"}
                        </Text>
                      </View>
                    </View>
                    
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-sm text-muted">
                        ${item.spent.toFixed(2)} spent
                      </Text>
                      <Text className="text-sm text-muted">
                        ${item.budget.toFixed(2)} budget
                      </Text>
                    </View>
                    
                    <View className="h-2 bg-background rounded-full overflow-hidden">
                      <View
                        style={{
                          width: `${Math.min(item.percentage, 100)}%`,
                          backgroundColor: item.over_budget ? colors.error : colors.success,
                        }}
                        className="h-full"
                      />
                    </View>
                    
                    <Text className="text-xs text-muted mt-1">
                      {item.percentage.toFixed(1)}% of budget used
                    </Text>
                  </View>
                ))}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
