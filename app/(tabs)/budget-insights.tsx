import { useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { trpc } from '@/lib/trpc';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { DEMO } from '@/lib/demo-data';

/**
 * Budget Insights Dashboard
 * 
 * Displays comprehensive spending analytics:
 * - Monthly spending trends with comparison
 * - Category breakdown with visual charts
 * - Top spending categories
 * - Month-over-month changes
 * - AI-powered insights and recommendations
 */
export default function BudgetInsightsScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month');

    // Get budget analytics data
    const { data: _categoryBreakdown, isLoading, isError: catError, refetch } = trpc.budgetAnalytics.getCategoryBreakdown.useQuery();
    const { data: _budgetComparison, isError: compError } = trpc.budgetAnalytics.getBudgetComparison.useQuery();
    const { data: _monthlyTrends, isError: trendsError } = trpc.budgetAnalytics.getMonthlyTrends.useQuery({});
    const { data: _overspendingPatterns, isError: patternsError } = trpc.budgetAnalytics.getOverspendingPatterns.useQuery();

    const categoryBreakdown = catError ? DEMO.categoryBreakdown : _categoryBreakdown;
    const budgetComparison = compError ? DEMO.budgetComparison : _budgetComparison;
    const monthlyTrends = trendsError ? DEMO.monthlyTrends : _monthlyTrends;
    const overspendingPatterns = patternsError ? DEMO.overspendingPatterns : _overspendingPatterns;

  // Calculate analytics from data
  const analytics = categoryBreakdown ? {
    totalSpending: categoryBreakdown.totalSpent,
    categoryBreakdown: categoryBreakdown.breakdown.map((cat: any) => ({
      category: cat.category,
      amount: cat.amount,
      transactions: cat.count,
    })),
    topCategories: categoryBreakdown.breakdown.slice(0, 3).map((cat: any) => ({
      category: cat.category,
      amount: cat.amount,
    })),
    dailyAverage: categoryBreakdown.totalSpent / 30,
    budgetComparison,
    previousPeriodSpending: null,
    changePercent: 0,
  } : null;

  // Convert overspending patterns to insights
  const insights = overspendingPatterns?.map((pattern: any) => ({
    icon: '⚠️',
    title: `${pattern.category} Overspending`,
    description: `You've spent ${formatCurrency(parseFloat(pattern.totalSpent))} on ${pattern.category}, which is ${parseFloat(pattern.overPercentage).toFixed(0)}% over your budget of ${formatCurrency(parseFloat(pattern.budgetAmount))}.`,
    action: 'Adjust Budget',
  })) || [];

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₦${Math.abs(amount).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return colors.error; // Spending increased (bad)
    if (change < 0) return colors.success; // Spending decreased (good)
    return colors.muted;
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return '📈';
    if (change < 0) return '📉';
    return '➡️';
  };

    if (isLoading && !catError) {
      return (
        <ScreenContainer className="items-center justify-center">
          <ActivityIndicator size="large" />
          <Text className="mt-4 text-muted">Loading insights...</Text>
        </ScreenContainer>
      );
    }

  return (
    <ScreenContainer>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground">Budget Insights</Text>
          <Text className="text-base text-muted mt-1">
            AI-powered spending analytics and recommendations
          </Text>
        </View>

        {/* Period Selector */}
        <View className="flex-row gap-2 mb-6">
          {(['week', 'month', 'year'] as const).map((period) => (
            <TouchableOpacity
              key={period}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                setSelectedPeriod(period);
              }}
              activeOpacity={0.7}
              className="flex-1 py-3 rounded-2xl items-center"
              style={{
                backgroundColor: selectedPeriod === period ? colors.primary : colors.surface,
              }}
            >
              <Text
                className="text-sm font-semibold capitalize"
                style={{ color: selectedPeriod === period ? colors.background : colors.foreground }}
              >
                {period}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {analytics && (
          <>
            {/* Total Spending Card */}
            <View className="bg-surface rounded-3xl p-6 mb-6 border border-border">
              <Text className="text-sm text-muted mb-2">Total Spending This {selectedPeriod}</Text>
              <Text className="text-4xl font-bold text-foreground mb-3">
                {formatCurrency(analytics.totalSpending)}
              </Text>
              {analytics.previousPeriodSpending && (
                <View className="flex-row items-center">
                  <Text className="text-2xl mr-2">{getChangeIcon(analytics.changePercent)}</Text>
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: getChangeColor(analytics.changePercent) }}
                  >
                    {Math.abs(analytics.changePercent).toFixed(1)}% vs last {selectedPeriod}
                  </Text>
                </View>
              )}
            </View>

            {/* Category Breakdown */}
            <View className="mb-6">
              <Text className="text-xl font-bold text-foreground mb-4">Spending by Category</Text>
              {analytics.categoryBreakdown && analytics.categoryBreakdown.length > 0 ? (
                <View className="gap-3">
                  {analytics.categoryBreakdown.map((cat: any, index: number) => {
                    const percentage = (cat.amount / analytics.totalSpending) * 100;
                    const barColor = [
                      colors.primary,
                      '#F59E0B',
                      '#EF4444',
                      '#8B5CF6',
                      '#10B981',
                      '#3B82F6',
                    ][index % 6];

                    return (
                      <View key={cat.category} className="bg-surface rounded-2xl p-4 border border-border">
                        <View className="flex-row items-center justify-between mb-2">
                          <View className="flex-row items-center gap-2">
                            <View
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: barColor }}
                            />
                            <Text className="text-base font-semibold text-foreground capitalize">
                              {cat.category}
                            </Text>
                          </View>
                          <Text className="text-base font-bold text-foreground">
                            {formatCurrency(cat.amount)}
                          </Text>
                        </View>
                        <View className="h-2 bg-background rounded-full overflow-hidden mb-1">
                          <View
                            className="h-full rounded-full"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: barColor,
                            }}
                          />
                        </View>
                        <View className="flex-row items-center justify-between">
                          <Text className="text-xs text-muted">
                            {percentage.toFixed(1)}% of total
                          </Text>
                          {cat.transactions && (
                            <Text className="text-xs text-muted">
                              {cat.transactions} {cat.transactions === 1 ? 'transaction' : 'transactions'}
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View className="bg-surface rounded-2xl p-6 items-center">
                  <Text className="text-muted">No spending data available</Text>
                </View>
              )}
            </View>

            {/* Top Spending Categories */}
            {analytics.topCategories && analytics.topCategories.length > 0 && (
              <View className="mb-6">
                <Text className="text-xl font-bold text-foreground mb-4">Top 3 Categories</Text>
                <View className="flex-row gap-3">
                  {analytics.topCategories.slice(0, 3).map((cat: any, index: number) => (
                    <View
                      key={cat.category}
                      className="flex-1 bg-surface rounded-2xl p-4 border border-border"
                    >
                      <Text className="text-3xl mb-2">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                      </Text>
                      <Text className="text-xs text-muted mb-1 capitalize">{cat.category}</Text>
                      <Text className="text-lg font-bold text-foreground">
                        {formatCurrency(cat.amount)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Daily Average */}
            {analytics.dailyAverage && (
              <View className="bg-primary/10 rounded-2xl p-4 mb-6">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-sm text-muted mb-1">Daily Average</Text>
                    <Text className="text-2xl font-bold text-foreground">
                      {formatCurrency(analytics.dailyAverage)}
                    </Text>
                  </View>
                  <Text className="text-5xl">📊</Text>
                </View>
              </View>
            )}

            {/* Budget Comparison */}
            {analytics.budgetComparison && analytics.budgetComparison.length > 0 && (
              <View className="mb-6">
                <Text className="text-xl font-bold text-foreground mb-4">Budget vs Actual</Text>
                {analytics.budgetComparison.map((item: any) => (
                  <View key={item.category} className="bg-surface rounded-2xl p-4 mb-3 border border-border">
                    <Text className="text-base font-semibold text-foreground mb-3 capitalize">{item.category}</Text>
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-sm text-muted">Budget</Text>
                      <Text className="text-base font-semibold text-foreground">
                        {formatCurrency(item.budgetAmount)}
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-sm text-muted">Actual</Text>
                      <Text className="text-base font-semibold text-foreground">
                        {formatCurrency(item.actualSpent)}
                      </Text>
                    </View>
                    <View className="h-px bg-border my-2" />
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-semibold text-foreground">
                        {item.isOverBudget ? 'Over Budget' : 'Remaining'}
                      </Text>
                      <Text
                        className="text-base font-bold"
                        style={{
                          color: item.isOverBudget ? colors.error : colors.success,
                        }}
                      >
                        {formatCurrency(Math.abs(item.difference))}
                      </Text>
                    </View>
                    <View className="h-2 bg-background rounded-full overflow-hidden mt-3">
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(item.percentageUsed, 100)}%`,
                          backgroundColor: item.isOverBudget ? colors.error : colors.success,
                        }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* AI Insights */}
        {insights && insights.length > 0 && (
          <View className="mb-6">
            <Text className="text-xl font-bold text-foreground mb-4">💡 AI Insights</Text>
            {insights.map((insight: any, index: number) => (
              <View
                key={index}
                className="bg-surface rounded-2xl p-4 mb-3 border border-border"
              >
                <View className="flex-row items-start gap-3">
                  <Text className="text-2xl">{insight.icon || '💡'}</Text>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-foreground mb-2">
                      {insight.title}
                    </Text>
                    <Text className="text-sm text-muted leading-relaxed">
                      {insight.description}
                    </Text>
                    {insight.action && (
                      <TouchableOpacity
                        className="mt-3 py-2 px-4 rounded-xl self-start"
                        style={{ backgroundColor: colors.primary + '20' }}
                        activeOpacity={0.7}
                      >
                        <Text className="text-sm font-semibold" style={{ color: colors.primary }}>
                          {insight.action}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Empty State */}
        {!analytics && !isLoading && (
          <View className="items-center py-12">
            <Text className="text-6xl mb-4">📊</Text>
            <Text className="text-xl font-bold text-foreground mb-2">No Data Yet</Text>
            <Text className="text-sm text-muted text-center mb-6">
              Start tracking your spending to see insights
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
