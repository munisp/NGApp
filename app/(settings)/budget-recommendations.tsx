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
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const PRIORITY_COLORS = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#22C55E',
};

const PRIORITY_LABELS = {
  high: 'High Priority',
  medium: 'Medium Priority',
  low: 'Low Priority',
};

export default function BudgetRecommendationsScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const { data, isLoading, refetch } = trpc.budgetRecommendations.getRecommendations.useQuery();
  const { data: insights } = trpc.budgetRecommendations.getInsights.useQuery();
  const applyMutation = trpc.budgetRecommendations.applyRecommendations.useMutation();

  const handleRefresh = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const toggleCategory = (category: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const handleApply = async () => {
    if (selectedCategories.length === 0) {
      Alert.alert('No Categories Selected', 'Please select at least one category to apply recommendations');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const result = await applyMutation.mutateAsync({ categories: selectedCategories });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert('Success', result.message);
      setSelectedCategories([]);
      await refetch();
    } catch (error) {
      Alert.alert('Error', 'Failed to apply recommendations');
    }
  };

  const formatCurrency = (value: number) => {
    return `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  if (isLoading) {
    return (
      <ScreenContainer className="p-4">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-4">Analyzing your spending...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!data) {
    return (
      <ScreenContainer className="p-4">
        <View className="flex-1 items-center justify-center">
          <Text className="text-6xl mb-4">📊</Text>
          <Text className="text-xl font-bold text-foreground mb-2">No Data Available</Text>
          <Text className="text-sm text-muted text-center">
            We need at least 3 months of transaction history to generate recommendations
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const highPriorityRecs = data.recommendations.filter((r) => r.priority === 'high');
  const mediumPriorityRecs = data.recommendations.filter((r) => r.priority === 'medium');
  const lowPriorityRecs = data.recommendations.filter((r) => r.priority === 'low');

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
            <Text className="text-3xl font-bold text-foreground">Budget Recommendations</Text>
            <Text className="text-muted mt-1">AI-powered suggestions based on your spending</Text>
          </View>

          {/* Income Analysis */}
          <View className="bg-surface rounded-3xl p-5 border border-border">
            <Text className="text-lg font-bold text-foreground mb-3">Income Analysis</Text>
            <View className="flex-row gap-3">
              <View className="flex-1 bg-background rounded-2xl p-3">
                <Text className="text-xs text-muted">Monthly Income</Text>
                <Text className="text-sm font-bold text-foreground">
                  {formatCurrency(data.income.averageMonthlyIncome)}
                </Text>
              </View>
              <View className="flex-1 bg-background rounded-2xl p-3">
                <Text className="text-xs text-muted">Stability</Text>
                <Text className="text-sm font-bold capitalize" style={{ color: colors.primary }}>
                  {data.income.incomeStability}
                </Text>
              </View>
            </View>
          </View>

          {/* Insights */}
          {insights && insights.insights.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-bold text-foreground">Key Insights</Text>
              {insights.insights.map((insight, index) => (
                <View
                  key={index}
                  className="bg-surface rounded-2xl p-4 border border-border"
                  style={{
                    borderLeftWidth: 4,
                    borderLeftColor:
                      insight.type === 'danger'
                        ? colors.error
                        : insight.type === 'warning'
                        ? colors.warning
                        : insight.type === 'success'
                        ? colors.success
                        : colors.primary,
                  }}
                >
                  <Text className="text-sm font-bold text-foreground mb-1">{insight.title}</Text>
                  <Text className="text-xs text-muted">{insight.message}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Summary */}
          <View className="bg-surface rounded-3xl p-5 border border-border">
            <Text className="text-lg font-bold text-foreground mb-3">Savings Opportunity</Text>
            <View className="items-center py-4">
              <Text className="text-4xl font-bold" style={{ color: colors.success }}>
                {formatCurrency(data.summary.totalPotentialSavings)}
              </Text>
              <Text className="text-xs text-muted mt-1">per month</Text>
            </View>
            {data.summary.highPriorityCount > 0 && (
              <View className="bg-background rounded-2xl p-3 mt-3">
                <Text className="text-xs text-center text-muted">
                  {data.summary.highPriorityCount} high-priority {data.summary.highPriorityCount === 1 ? 'area' : 'areas'} need attention
                </Text>
              </View>
            )}
          </View>

          {/* High Priority Recommendations */}
          {highPriorityRecs.length > 0 && (
            <View className="gap-3">
              <View className="flex-row items-center gap-2">
                <View className="w-1 h-6 rounded" style={{ backgroundColor: PRIORITY_COLORS.high }} />
                <Text className="text-lg font-bold text-foreground">{PRIORITY_LABELS.high}</Text>
              </View>
              {highPriorityRecs.map((rec) => (
                <TouchableOpacity
                  key={rec.category}
                  onPress={() => toggleCategory(rec.category)}
                  activeOpacity={0.7}
                  className="bg-surface rounded-3xl p-5 border"
                  style={{
                    borderColor: selectedCategories.includes(rec.category) ? colors.primary : colors.border,
                    borderWidth: selectedCategories.includes(rec.category) ? 2 : 1,
                  }}
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <View>
                      <Text className="text-lg font-bold text-foreground capitalize">{rec.category}</Text>
                      <Text className="text-xs text-muted">{PRIORITY_LABELS[rec.priority]}</Text>
                    </View>
                    {selectedCategories.includes(rec.category) && (
                      <View className="w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: colors.primary }}>
                        <Text className="text-background text-xs">✓</Text>
                      </View>
                    )}
                  </View>

                  <View className="flex-row gap-3 mb-3">
                    <View className="flex-1 bg-background rounded-2xl p-3">
                      <Text className="text-xs text-muted">Current</Text>
                      <Text className="text-sm font-bold text-foreground">{formatCurrency(rec.currentSpending)}</Text>
                    </View>
                    <View className="flex-1 bg-background rounded-2xl p-3">
                      <Text className="text-xs text-muted">Recommended</Text>
                      <Text className="text-sm font-bold" style={{ color: colors.success }}>
                        {formatCurrency(rec.recommendedBudget)}
                      </Text>
                    </View>
                    {rec.potentialSavings > 0 && (
                      <View className="flex-1 bg-background rounded-2xl p-3">
                        <Text className="text-xs text-muted">Save</Text>
                        <Text className="text-sm font-bold" style={{ color: colors.success }}>
                          {formatCurrency(rec.potentialSavings)}
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text className="text-xs text-muted">{rec.reasoning}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Medium Priority Recommendations */}
          {mediumPriorityRecs.length > 0 && (
            <View className="gap-3">
              <View className="flex-row items-center gap-2">
                <View className="w-1 h-6 rounded" style={{ backgroundColor: PRIORITY_COLORS.medium }} />
                <Text className="text-lg font-bold text-foreground">{PRIORITY_LABELS.medium}</Text>
              </View>
              {mediumPriorityRecs.map((rec) => (
                <TouchableOpacity
                  key={rec.category}
                  onPress={() => toggleCategory(rec.category)}
                  activeOpacity={0.7}
                  className="bg-surface rounded-3xl p-5 border"
                  style={{
                    borderColor: selectedCategories.includes(rec.category) ? colors.primary : colors.border,
                    borderWidth: selectedCategories.includes(rec.category) ? 2 : 1,
                  }}
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <View>
                      <Text className="text-lg font-bold text-foreground capitalize">{rec.category}</Text>
                      <Text className="text-xs text-muted">{PRIORITY_LABELS[rec.priority]}</Text>
                    </View>
                    {selectedCategories.includes(rec.category) && (
                      <View className="w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: colors.primary }}>
                        <Text className="text-background text-xs">✓</Text>
                      </View>
                    )}
                  </View>

                  <View className="flex-row gap-3 mb-3">
                    <View className="flex-1 bg-background rounded-2xl p-3">
                      <Text className="text-xs text-muted">Current</Text>
                      <Text className="text-sm font-bold text-foreground">{formatCurrency(rec.currentSpending)}</Text>
                    </View>
                    <View className="flex-1 bg-background rounded-2xl p-3">
                      <Text className="text-xs text-muted">Recommended</Text>
                      <Text className="text-sm font-bold" style={{ color: colors.success }}>
                        {formatCurrency(rec.recommendedBudget)}
                      </Text>
                    </View>
                    {rec.potentialSavings > 0 && (
                      <View className="flex-1 bg-background rounded-2xl p-3">
                        <Text className="text-xs text-muted">Save</Text>
                        <Text className="text-sm font-bold" style={{ color: colors.success }}>
                          {formatCurrency(rec.potentialSavings)}
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text className="text-xs text-muted">{rec.reasoning}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Low Priority Recommendations */}
          {lowPriorityRecs.length > 0 && (
            <View className="gap-3">
              <View className="flex-row items-center gap-2">
                <View className="w-1 h-6 rounded" style={{ backgroundColor: PRIORITY_COLORS.low }} />
                <Text className="text-lg font-bold text-foreground">{PRIORITY_LABELS.low}</Text>
              </View>
              {lowPriorityRecs.map((rec) => (
                <View key={rec.category} className="bg-surface rounded-3xl p-5 border border-border opacity-70">
                  <View className="mb-3">
                    <Text className="text-lg font-bold text-foreground capitalize">{rec.category}</Text>
                    <Text className="text-xs text-muted">{PRIORITY_LABELS[rec.priority]}</Text>
                  </View>

                  <View className="flex-row gap-3 mb-3">
                    <View className="flex-1 bg-background rounded-2xl p-3">
                      <Text className="text-xs text-muted">Current</Text>
                      <Text className="text-sm font-bold text-foreground">{formatCurrency(rec.currentSpending)}</Text>
                    </View>
                    <View className="flex-1 bg-background rounded-2xl p-3">
                      <Text className="text-xs text-muted">Recommended</Text>
                      <Text className="text-sm font-bold" style={{ color: colors.success }}>
                        {formatCurrency(rec.recommendedBudget)}
                      </Text>
                    </View>
                  </View>

                  <Text className="text-xs text-muted">{rec.reasoning}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Apply Button */}
          {selectedCategories.length > 0 && (
            <TouchableOpacity
              onPress={handleApply}
              activeOpacity={0.7}
              className="py-4 rounded-3xl items-center"
              style={{ backgroundColor: colors.primary }}
            >
              <Text className="text-base font-bold text-background">
                Apply {selectedCategories.length} {selectedCategories.length === 1 ? 'Recommendation' : 'Recommendations'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
