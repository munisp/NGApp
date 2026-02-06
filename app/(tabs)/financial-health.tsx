import { ScrollView, Text, View, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { trpc } from '@/lib/trpc';
import { useState, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { DEMO } from '@/lib/demo-data';

/**
 * Financial Health Score Screen
 * 
 * Displays comprehensive 0-100 financial health score with:
 * - Circular score display with color-coded indicator
 * - 4 component breakdowns (credit, savings, debt, budget)
 * - 12-month historical trend chart
 * - Personalized improvement recommendations
 * - Pull-to-refresh and calculate score functionality
 */
export default function FinancialHealthScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [calculating, setCalculating] = useState(false);

    // Get current score
    const { data: _scoreData, isLoading, isError: scoreError, refetch } = trpc.financialHealth.getCurrentScore.useQuery();
  
    // Get 12-month history
    const { data: _history, isError: histError } = trpc.financialHealth.getScoreHistory.useQuery();
    const scoreData = scoreError ? DEMO.financialHealth : _scoreData;
    const history = histError ? DEMO.financialHealthHistory : _history;
  
  // Calculate new score mutation
  const calculateScore = trpc.financialHealth.calculateScore.useMutation({
    onSuccess: () => {
      refetch();
      setCalculating(false);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    onError: () => {
      setCalculating(false);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleCalculateScore = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setCalculating(true);
    calculateScore.mutate();
  };

  // Get score color based on value
  const getScoreColor = (score: number) => {
    if (score >= 80) return '#22C55E'; // Green
    if (score >= 60) return '#FBBF24'; // Yellow
    if (score >= 40) return '#F59E0B'; // Orange
    return '#EF4444'; // Red
  };

  // Get score label
  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Improvement';
  };

    if (isLoading && !scoreError) {
      return (
        <ScreenContainer className="items-center justify-center">
          <ActivityIndicator size="large" />
          <Text className="mt-4 text-muted">Loading your financial health...</Text>
        </ScreenContainer>
      );
    }

  const score = scoreData?.score;
  const recommendations = scoreData?.recommendations || [];

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
          <Text className="text-3xl font-bold text-foreground">Financial Health</Text>
          <Text className="text-base text-muted mt-1">
            Your comprehensive financial wellness score
          </Text>
        </View>

        {!score ? (
          // No score yet - show calculate button
          <View className="items-center justify-center py-12">
            <Text className="text-6xl mb-4">📊</Text>
            <Text className="text-xl font-semibold text-foreground mb-2">
              Calculate Your Score
            </Text>
            <Text className="text-base text-muted text-center mb-6 px-4">
              Get a comprehensive 0-100 score based on your credit, savings, debt, and budget habits
            </Text>
            <TouchableOpacity
              onPress={handleCalculateScore}
              disabled={calculating}
              style={{
                backgroundColor: '#0a7ea4',
                paddingHorizontal: 32,
                paddingVertical: 16,
                borderRadius: 12,
              }}
              activeOpacity={0.8}
            >
              <Text className="text-white font-semibold text-base">
                {calculating ? 'Calculating...' : 'Calculate My Score'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Overall Score Circle */}
            <View className="items-center mb-8">
              <View
                style={{
                  width: 200,
                  height: 200,
                  borderRadius: 100,
                  borderWidth: 12,
                  borderColor: getScoreColor(score.overallScore),
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f5f5f5',
                }}
              >
                <Text style={{ fontSize: 56, fontWeight: 'bold', color: getScoreColor(score.overallScore) }}>
                  {score.overallScore}
                </Text>
                <Text className="text-lg font-semibold text-muted">
                  {getScoreLabel(score.overallScore)}
                </Text>
              </View>
              <Text className="text-sm text-muted mt-4">
                Last updated: {new Date(score.calculatedAt).toLocaleDateString()}
              </Text>
              <TouchableOpacity
                onPress={handleCalculateScore}
                disabled={calculating}
                className="mt-4"
                activeOpacity={0.7}
              >
                <Text className="text-primary font-semibold">
                  {calculating ? 'Recalculating...' : 'Recalculate Score'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Component Breakdown */}
            <View className="mb-8">
              <Text className="text-xl font-bold text-foreground mb-4">Score Breakdown</Text>
              
              {/* Credit Score Component */}
              <View className="mb-4">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-base font-semibold text-foreground">
                    💳 Credit Score (30%)
                  </Text>
                  <Text className="text-base font-bold text-foreground">
                    {score.creditScoreComponent}/100
                  </Text>
                </View>
                <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <View
                    style={{
                      width: `${score.creditScoreComponent}%`,
                      height: '100%',
                      backgroundColor: getScoreColor(score.creditScoreComponent),
                    }}
                  />
                </View>
                {score.creditScore && (
                  <Text className="text-sm text-muted mt-1">
                    Current credit score: {score.creditScore}
                  </Text>
                )}
              </View>

              {/* Savings Rate Component */}
              <View className="mb-4">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-base font-semibold text-foreground">
                    💰 Savings Rate (25%)
                  </Text>
                  <Text className="text-base font-bold text-foreground">
                    {score.savingsRateComponent}/100
                  </Text>
                </View>
                <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <View
                    style={{
                      width: `${score.savingsRateComponent}%`,
                      height: '100%',
                      backgroundColor: getScoreColor(score.savingsRateComponent),
                    }}
                  />
                </View>
                <Text className="text-sm text-muted mt-1">
                  Saving {parseFloat(score.savingsRate || '0').toFixed(1)}% of income
                </Text>
              </View>

              {/* Debt-to-Income Component */}
              <View className="mb-4">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-base font-semibold text-foreground">
                    📉 Debt-to-Income (25%)
                  </Text>
                  <Text className="text-base font-bold text-foreground">
                    {score.debtToIncomeComponent}/100
                  </Text>
                </View>
                <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <View
                    style={{
                      width: `${score.debtToIncomeComponent}%`,
                      height: '100%',
                      backgroundColor: getScoreColor(score.debtToIncomeComponent),
                    }}
                  />
                </View>
                <Text className="text-sm text-muted mt-1">
                  Debt is {parseFloat(score.debtToIncomeRatio || '0').toFixed(1)}% of income
                </Text>
              </View>

              {/* Budget Adherence Component */}
              <View className="mb-4">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-base font-semibold text-foreground">
                    📊 Budget Adherence (20%)
                  </Text>
                  <Text className="text-base font-bold text-foreground">
                    {score.budgetAdherenceComponent}/100
                  </Text>
                </View>
                <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <View
                    style={{
                      width: `${score.budgetAdherenceComponent}%`,
                      height: '100%',
                      backgroundColor: getScoreColor(score.budgetAdherenceComponent),
                    }}
                  />
                </View>
                <Text className="text-sm text-muted mt-1">
                  {parseFloat(score.budgetAdherence || '0').toFixed(0)}% adherence to budget
                </Text>
              </View>
            </View>

            {/* 12-Month Trend */}
            {history && history.length > 1 && (
              <View className="mb-8">
                <Text className="text-xl font-bold text-foreground mb-4">12-Month Trend</Text>
                <View className="bg-surface rounded-lg p-4">
                  <View className="flex-row items-end justify-between" style={{ height: 120 }}>
                    {history.slice(-12).map((h: any, index: number) => {
                      const barHeight = (h.overallScore / 100) * 100;
                      return (
                        <View key={index} className="flex-1 items-center justify-end mx-1">
                          <View
                            style={{
                              width: '100%',
                              height: `${barHeight}%`,
                              backgroundColor: getScoreColor(h.overallScore),
                              borderRadius: 4,
                            }}
                          />
                          <Text className="text-xs text-muted mt-1">
                            {h.scoreMonth}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
            )}

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <View className="mb-8">
                <Text className="text-xl font-bold text-foreground mb-4">
                  Improvement Tips
                </Text>
                {recommendations.slice(0, 3).map((rec: any) => (
                  <View
                    key={rec.id}
                    className="bg-surface rounded-lg p-4 mb-3"
                    style={{
                      borderLeftWidth: 4,
                      borderLeftColor: rec.priority === 1 ? '#EF4444' : rec.priority === 2 ? '#F59E0B' : '#22C55E',
                    }}
                  >
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-base font-bold text-foreground flex-1">
                        {rec.title}
                      </Text>
                      {rec.potentialScoreIncrease && (
                        <View className="bg-primary/10 px-2 py-1 rounded">
                          <Text className="text-xs font-semibold text-primary">
                            +{rec.potentialScoreIncrease} pts
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-sm text-muted mb-3">{rec.description}</Text>
                    {rec.actionItems && rec.actionItems.length > 0 && (
                      <View>
                        <Text className="text-sm font-semibold text-foreground mb-2">
                          Action Steps:
                        </Text>
                        {rec.actionItems.slice(0, 3).map((item: string, idx: number) => (
                          <Text key={idx} className="text-sm text-muted mb-1">
                            • {item}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Monthly Summary */}
            <View className="bg-surface rounded-lg p-4 mb-4">
              <Text className="text-lg font-bold text-foreground mb-3">Monthly Summary</Text>
              <View className="flex-row justify-between mb-2">
                <Text className="text-sm text-muted">Income</Text>
                <Text className="text-sm font-semibold text-foreground">
                  ₦{parseFloat(score.monthlyIncome || '0').toLocaleString()}
                </Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-sm text-muted">Expenses</Text>
                <Text className="text-sm font-semibold text-foreground">
                  ₦{parseFloat(score.monthlyExpenses || '0').toLocaleString()}
                </Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-sm text-muted">Debt Payments</Text>
                <Text className="text-sm font-semibold text-foreground">
                  ₦{parseFloat(score.monthlyDebtPayments || '0').toLocaleString()}
                </Text>
              </View>
              <View className="h-px bg-border my-2" />
              <View className="flex-row justify-between">
                <Text className="text-sm font-bold text-foreground">Savings</Text>
                <Text className="text-sm font-bold text-success">
                  ₦{parseFloat(score.monthlySavings || '0').toLocaleString()}
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
