import { useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { trpc } from '@/lib/trpc';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { DEMO } from '@/lib/demo-data';

/**
 * Budget Recommendations Screen
 * 
 * ML-powered budget suggestions based on:
 * - Income analysis
 * - Spending patterns
 * - Savings goals
 * - 50/30/20 rule
 */

export default function BudgetRecommendationsScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

    const { data: _recommendations, isLoading, isError: recError, refetch } = trpc.budgetRecommendations.getRecommendations.useQuery();
    const { data: _insights, isError: insError } = trpc.budgetRecommendations.getInsights.useQuery();
    const recommendations = recError ? DEMO.budgetRecommendations : _recommendations;
    const insights = insError ? DEMO.budgetInsights : _insights;
  const applyMutation = trpc.budgetRecommendations.applyRecommendations.useMutation();

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch()]);
    setRefreshing(false);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const toggleCategory = (category: string) => {
    const newSelected = new Set(selectedCategories);
    if (newSelected.has(category)) {
      newSelected.delete(category);
    } else {
      newSelected.add(category);
    }
    setSelectedCategories(newSelected);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleApplySelected = async () => {
    if (selectedCategories.size === 0) {
      Alert.alert('No Selection', 'Please select at least one recommendation to apply');
      return;
    }

    try {
      const result = await applyMutation.mutateAsync({
        categories: Array.from(selectedCategories),
      });

      Alert.alert(
        'Success',
        result.message,
        [{ text: 'OK', onPress: () => setSelectedCategories(new Set()) }]
      );

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      await refetch();
    } catch (error) {
      Alert.alert('Error', 'Failed to apply recommendations');
    }
  };

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString()}`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return colors.error;
      case 'medium':
        return colors.warning;
      case 'low':
        return colors.success;
      default:
        return colors.muted;
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return '🔴';
      case 'medium':
        return '🟡';
      case 'low':
        return '🟢';
      default:
        return '⚪';
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'danger':
        return '🚨';
      case 'warning':
        return '⚠️';
      case 'success':
        return '✅';
      case 'info':
        return 'ℹ️';
      default:
        return '💡';
    }
  };

    if (isLoading && !recError) {
      return (
        <ScreenContainer className="items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="mt-4 text-muted">Analyzing your finances...</Text>
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
          <Text className="text-3xl font-bold text-foreground">Budget Recommendations</Text>
          <Text className="text-base text-muted mt-1">
            ML-powered suggestions based on your spending patterns
          </Text>
        </View>

        {/* Income Analysis */}
        {recommendations?.income && (
          <View className="bg-surface rounded-3xl p-5 mb-4 border border-border">
            <Text className="text-lg font-bold text-foreground mb-3">Income Analysis</Text>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm text-muted">Average Monthly Income</Text>
              <Text className="text-base font-semibold text-foreground">
                {formatCurrency(recommendations.income.averageMonthlyIncome)}
              </Text>
            </View>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm text-muted">Income Stability</Text>
              <View className="flex-row items-center gap-2">
                <Text
                  className="text-sm font-semibold capitalize"
                  style={{
                    color:
                      recommendations.income.incomeStability === 'stable'
                        ? colors.success
                        : recommendations.income.incomeStability === 'variable'
                        ? colors.warning
                        : colors.error,
                  }}
                >
                  {recommendations.income.incomeStability}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-muted">Confidence Level</Text>
              <Text className="text-sm font-semibold text-foreground">
                {Math.round(recommendations.income.confidence * 100)}%
              </Text>
            </View>
          </View>
        )}

        {/* Insights */}
        {insights && insights.insights.length > 0 && (
          <View className="mb-4">
            <Text className="text-xl font-bold text-foreground mb-3">Key Insights</Text>
            {insights.insights.map((insight: any, index: number) => (
              <View
                key={index}
                className="bg-surface rounded-2xl p-4 mb-3 border border-border"
              >
                <View className="flex-row items-start gap-3">
                  <Text className="text-2xl">{getInsightIcon(insight.type)}</Text>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-foreground mb-1">
                      {insight.title}
                    </Text>
                    <Text className="text-sm text-muted leading-relaxed">
                      {insight.message}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Summary */}
        {recommendations?.summary && (
          <View className="bg-primary/10 rounded-2xl p-4 mb-4">
            <Text className="text-base font-bold text-foreground mb-3">Potential Impact</Text>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm text-muted">Total Potential Savings</Text>
              <Text className="text-lg font-bold" style={{ color: colors.success }}>
                {formatCurrency(recommendations.summary.totalPotentialSavings)}
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-muted">High Priority Items</Text>
              <Text className="text-base font-semibold text-foreground">
                {recommendations.summary.highPriorityCount}
              </Text>
            </View>
          </View>
        )}

        {/* Recommendations */}
        {recommendations && recommendations.recommendations.length > 0 && (
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-xl font-bold text-foreground">Recommendations</Text>
              {selectedCategories.size > 0 && (
                <TouchableOpacity
                  onPress={handleApplySelected}
                  activeOpacity={0.7}
                  className="px-4 py-2 rounded-full"
                  style={{ backgroundColor: colors.primary }}
                >
                  <Text className="text-sm font-semibold text-background">
                    Apply ({selectedCategories.size})
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {recommendations.recommendations.map((rec: any) => {
              const isSelected = selectedCategories.has(rec.category);
              const isSavings = rec.category === 'savings';

              return (
                <TouchableOpacity
                  key={rec.category}
                  onPress={() => !isSavings && toggleCategory(rec.category)}
                  activeOpacity={isSavings ? 1 : 0.7}
                  disabled={isSavings}
                  className="bg-surface rounded-3xl p-5 mb-3 border-2"
                  style={{
                    borderColor: isSelected ? colors.primary : colors.border,
                  }}
                >
                  <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-row items-center gap-2 flex-1">
                      <Text className="text-xl">{getPriorityIcon(rec.priority)}</Text>
                      <Text className="text-lg font-bold text-foreground capitalize flex-1">
                        {rec.category}
                      </Text>
                    </View>
                    {!isSavings && (
                      <View
                        className="w-6 h-6 rounded-full border-2 items-center justify-center"
                        style={{
                          borderColor: isSelected ? colors.primary : colors.border,
                          backgroundColor: isSelected ? colors.primary : 'transparent',
                        }}
                      >
                        {isSelected && (
                          <IconSymbol name="checkmark.circle.fill" size={16} color={colors.background} />
                        )}
                      </View>
                    )}
                  </View>

                  <Text className="text-sm text-muted leading-relaxed mb-3">
                    {rec.reasoning}
                  </Text>

                  <View className="bg-background rounded-2xl p-3 mb-3">
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-xs text-muted">Current</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        {formatCurrency(rec.currentSpending)}
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-xs text-muted">Recommended</Text>
                      <Text className="text-sm font-bold" style={{ color: colors.primary }}>
                        {formatCurrency(rec.recommendedBudget)}
                      </Text>
                    </View>
                    {rec.potentialSavings > 0 && (
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs text-muted">Potential Savings</Text>
                        <Text className="text-sm font-bold" style={{ color: colors.success }}>
                          {formatCurrency(rec.potentialSavings)}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View className="flex-row items-center gap-2">
                    <View
                      className="px-3 py-1 rounded-full"
                      style={{ backgroundColor: getPriorityColor(rec.priority) + '20' }}
                    >
                      <Text
                        className="text-xs font-semibold capitalize"
                        style={{ color: getPriorityColor(rec.priority) }}
                      >
                        {rec.priority} Priority
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Empty State */}
        {recommendations && recommendations.recommendations.length === 0 && (
          <View className="items-center py-12">
            <Text className="text-6xl mb-4">🎯</Text>
            <Text className="text-xl font-bold text-foreground mb-2">Great Job!</Text>
            <Text className="text-sm text-muted text-center">
              Your budget is well-optimized. Keep up the good work!
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
