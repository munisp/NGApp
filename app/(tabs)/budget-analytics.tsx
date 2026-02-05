import { useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, RefreshControl, Dimensions } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { trpc } from '@/lib/trpc';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 48; // 24px padding on each side

const CATEGORY_COLORS: Record<string, string> = {
  food: '#FF6B6B',
  transport: '#4ECDC4',
  shopping: '#FFE66D',
  bills: '#95E1D3',
  entertainment: '#C7CEEA',
  health: '#FF8B94',
  other: '#A8DADC',
};

export default function BudgetAnalyticsScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);

  const { data: monthlyTrends, isLoading: trendsLoading, refetch: refetchTrends } =
    trpc.budgetAnalytics.getMonthlyTrends.useQuery({ category: selectedCategory });

  const { data: categoryBreakdown, isLoading: breakdownLoading, refetch: refetchBreakdown } =
    trpc.budgetAnalytics.getCategoryBreakdown.useQuery();

  const { data: budgetComparison, isLoading: comparisonLoading, refetch: refetchComparison } =
    trpc.budgetAnalytics.getBudgetComparison.useQuery();

  const { data: overspendingPatterns, isLoading: patternsLoading, refetch: refetchPatterns } =
    trpc.budgetAnalytics.getOverspendingPatterns.useQuery();

  const handleRefresh = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setRefreshing(true);
    await Promise.all([refetchTrends(), refetchBreakdown(), refetchComparison(), refetchPatterns()]);
    setRefreshing(false);
  };

  const formatCurrency = (value: number) => {
    return `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const getCategoryColor = (category: string) => {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
  };

  const isLoading = trendsLoading || breakdownLoading || comparisonLoading || patternsLoading;

  if (isLoading) {
    return (
      <ScreenContainer className="p-4">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-4">Loading analytics...</Text>
        </View>
      </ScreenContainer>
    );
  }

  const maxTrendValue = Math.max(...(monthlyTrends?.map((m) => m.totalSpent) || [1]));

  return (
    <ScreenContainer className="p-4">
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        <View className="gap-6">
          {/* Header */}
          <View>
            <Text className="text-3xl font-bold text-foreground">Budget Analytics</Text>
            <Text className="text-muted mt-1">Track your spending patterns and trends</Text>
          </View>

          {/* Monthly Trends Chart */}
          <View className="bg-surface rounded-3xl p-5 border border-border">
            <Text className="text-xl font-bold text-foreground mb-4">Monthly Spending Trend</Text>
            
            {/* Category Filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => {
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    setSelectedCategory(undefined);
                  }}
                  activeOpacity={0.7}
                  className="px-4 py-2 rounded-2xl"
                  style={{
                    backgroundColor: !selectedCategory ? colors.primary : colors.background,
                  }}
                >
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: !selectedCategory ? colors.background : colors.muted }}
                  >
                    All
                  </Text>
                </TouchableOpacity>
                {Object.keys(CATEGORY_COLORS).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => {
                      if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                      setSelectedCategory(cat);
                    }}
                    activeOpacity={0.7}
                    className="px-4 py-2 rounded-2xl"
                    style={{
                      backgroundColor: selectedCategory === cat ? getCategoryColor(cat) : colors.background,
                    }}
                  >
                    <Text
                      className="text-sm font-semibold capitalize"
                      style={{
                        color: selectedCategory === cat ? '#FFFFFF' : colors.muted,
                      }}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Bar Chart */}
            <View className="gap-2">
              {monthlyTrends?.slice(-6).map((month) => {
                const barWidth = maxTrendValue > 0 ? (month.totalSpent / maxTrendValue) * (CHART_WIDTH - 100) : 0;
                return (
                  <View key={month.month} className="flex-row items-center gap-2">
                    <Text className="text-xs text-muted w-16">{month.label.split(' ')[0]}</Text>
                    <View className="flex-1">
                      <View
                        className="h-8 rounded-lg"
                        style={{
                          width: Math.max(barWidth, 2),
                          backgroundColor: selectedCategory
                            ? getCategoryColor(selectedCategory)
                            : colors.primary,
                        }}
                      />
                    </View>
                    <Text className="text-xs font-semibold text-foreground w-20 text-right">
                      {formatCurrency(month.totalSpent)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Category Breakdown */}
          {categoryBreakdown && (
            <View className="bg-surface rounded-3xl p-5 border border-border">
              <Text className="text-xl font-bold text-foreground mb-4">Category Breakdown</Text>
              <Text className="text-sm text-muted mb-4">
                Total: {formatCurrency(categoryBreakdown.totalSpent)} • {categoryBreakdown.totalTransactions}{' '}
                transactions
              </Text>

              <View className="gap-3">
                {categoryBreakdown.breakdown.map((cat) => (
                  <View key={cat.category}>
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-sm font-semibold text-foreground capitalize">{cat.category}</Text>
                      <Text className="text-sm font-bold text-foreground">{formatCurrency(cat.amount)}</Text>
                    </View>
                    <View className="h-2 bg-background rounded-full overflow-hidden">
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${cat.percentage}%`,
                          backgroundColor: getCategoryColor(cat.category),
                        }}
                      />
                    </View>
                    <Text className="text-xs text-muted mt-1">
                      {cat.percentage.toFixed(1)}% • {cat.count} transactions
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Budget vs Actual */}
          {budgetComparison && budgetComparison.length > 0 && (
            <View className="bg-surface rounded-3xl p-5 border border-border">
              <Text className="text-xl font-bold text-foreground mb-4">Budget vs Actual</Text>

              <View className="gap-4">
                {budgetComparison.map((comp) => (
                  <View key={comp.category} className="gap-2">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-semibold text-foreground capitalize">{comp.category}</Text>
                      <View className="flex-row items-center gap-2">
                        <Text
                          className="text-sm font-bold"
                          style={{ color: comp.isOverBudget ? colors.error : colors.success }}
                        >
                          {formatCurrency(comp.actualSpent)}
                        </Text>
                        <Text className="text-xs text-muted">/ {formatCurrency(comp.budgetAmount)}</Text>
                      </View>
                    </View>

                    <View className="h-2 bg-background rounded-full overflow-hidden">
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(comp.percentageUsed, 100)}%`,
                          backgroundColor: comp.isOverBudget ? colors.error : colors.success,
                        }}
                      />
                    </View>

                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs text-muted">{comp.percentageUsed.toFixed(1)}% used</Text>
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: comp.isOverBudget ? colors.error : colors.success }}
                      >
                        {comp.isOverBudget ? 'Over by' : 'Remaining'} {formatCurrency(Math.abs(comp.difference))}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Overspending Patterns */}
          {overspendingPatterns && overspendingPatterns.length > 0 && (
            <View className="bg-surface rounded-3xl p-5 border border-border">
              <Text className="text-xl font-bold text-foreground mb-4">Overspending Patterns</Text>
              <Text className="text-sm text-muted mb-4">Last 6 months analysis</Text>

              <View className="gap-4">
                {overspendingPatterns.slice(0, 3).map((pattern) => (
                  <View key={pattern.category}>
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-sm font-semibold text-foreground capitalize">{pattern.category}</Text>
                      <View
                        className="px-3 py-1 rounded-full"
                        style={{
                          backgroundColor:
                            pattern.overspendRate > 50
                              ? colors.error + '20'
                              : pattern.overspendRate > 25
                                ? colors.warning + '20'
                                : colors.success + '20',
                        }}
                      >
                        <Text
                          className="text-xs font-bold"
                          style={{
                            color:
                              pattern.overspendRate > 50
                                ? colors.error
                                : pattern.overspendRate > 25
                                  ? colors.warning
                                  : colors.success,
                          }}
                        >
                          {pattern.overspendRate.toFixed(0)}% overspend rate
                        </Text>
                      </View>
                    </View>

                    <Text className="text-xs text-muted">
                      Over budget in {pattern.overspendCount} of {pattern.totalMonths} months
                    </Text>
                  </View>
                ))}

                {overspendingPatterns.length === 0 && (
                  <View className="items-center py-4">
                    <IconSymbol name="checkmark.circle.fill" size={32} color={colors.success} />
                    <Text className="text-sm text-muted mt-2">No overspending patterns detected</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
