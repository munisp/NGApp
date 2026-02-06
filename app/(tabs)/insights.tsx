import { useState, useEffect } from 'react';
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { trpc } from '@/lib/trpc';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { DEMO } from '@/lib/demo-data';

export default function InsightsScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [analyzingInsights, setAnalyzingInsights] = useState(false);

    // Fetch transactions for analytics
    const { data: transactionsData, isLoading: transactionsLoading, isError: txError, refetch: refetchTransactions } = 
      trpc.openBanking.getTransactions.useQuery({ accountId: '' });

    const transactions = txError ? DEMO.transactions.map(t => ({ ...t, type: t.amount < 0 ? 'debit' as const : 'credit' as const, amount: String(Math.abs(t.amount)) })) : (transactionsData || []);

  // Fetch AI insights
  const analyzeInsightsMutation = trpc.insights.analyze.useMutation();
  const [insights, setInsights] = useState<any>(null);

    useEffect(() => {
      if (txError && !insights) {
        setInsights({
          totalSpending: 277100,
          avgDailySpending: 9237,
          categoryBreakdown: DEMO.categoryBreakdown.breakdown,
          insights: [
            'Your food spending accounts for 32.9% of total expenses. Consider meal planning to reduce costs.',
            'Transport costs are consistent. Look into monthly passes for potential savings.',
            'Entertainment spending exceeded budget by 11.2%. Set stricter limits on subscriptions.',
            'Your savings rate of 18.5% is close to the recommended 20%. Increase by ₦18,000/month.',
          ],
        });
      } else if (transactions.length > 0 && !insights) {
        handleAnalyzeInsights();
      }
    }, [transactions, txError]);

  const handleAnalyzeInsights = async () => {
    if (transactions.length === 0) return;

    setAnalyzingInsights(true);
    try {
      const result = await analyzeInsightsMutation.mutateAsync({
        transactions: transactions.map((t: any) => ({
          id: t.id,
          type: t.type,
          amount: parseFloat(t.amount),
          category: t.category || 'other',
          date: t.date,
          description: t.description,
        })),
      });
      setInsights(result);
    } catch (error) {
      console.error('Failed to analyze insights:', error);
    } finally {
      setAnalyzingInsights(false);
    }
  };

  const handleRefresh = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setRefreshing(true);
    await refetchTransactions();
    await handleAnalyzeInsights();
    setRefreshing(false);
  };

  const formatCurrency = (value: number) => {
    return `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      food: '🍽️',
      transport: '🚗',
      shopping: '🛍️',
      bills: '💡',
      entertainment: '🎬',
      health: '💊',
      other: '📦',
    };
    return icons[category] || '📦';
  };

  const getCategoryColor = (category: string) => {
    const colorMap: Record<string, string> = {
      food: '#FF6B6B',
      transport: '#4ECDC4',
      shopping: '#FFE66D',
      bills: '#95E1D3',
      entertainment: '#C7CEEA',
      health: '#FF8B94',
      other: '#A8DADC',
    };
    return colorMap[category] || colors.muted;
  };

    if (transactionsLoading && !txError) {
      return (
        <ScreenContainer className="p-4">
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="text-muted mt-4">Loading insights...</Text>
          </View>
        </ScreenContainer>
      );
    }

  const totalSpending = insights?.totalSpending || 0;
  const avgDailySpending = insights?.avgDailySpending || 0;
  const categoryBreakdown = insights?.categoryBreakdown || [];
  const aiInsights = insights?.insights || [];

  // Calculate income vs expenses
  const totalIncome = transactions
    .filter((t: any) => t.type === 'credit')
    .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
  const totalExpenses = transactions
    .filter((t: any) => t.type === 'debit')
    .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  return (
    <ScreenContainer className="p-4">
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View className="gap-6">
          {/* Header */}
          <View>
            <Text className="text-3xl font-bold text-foreground">Financial Insights</Text>
            <Text className="text-muted mt-1">Your spending analytics for the last 30 days</Text>
          </View>

          {/* Summary Cards */}
          <View className="flex-row gap-3">
            <View className="flex-1 bg-primary rounded-3xl p-5">
              <Text className="text-background/80 text-xs mb-1">Total Spending</Text>
              <Text className="text-background text-2xl font-bold">{formatCurrency(totalSpending)}</Text>
              <Text className="text-background/60 text-xs mt-2">
                {formatCurrency(avgDailySpending)}/day
              </Text>
            </View>
            <View className="flex-1 bg-surface rounded-3xl p-5 border border-border">
              <Text className="text-muted text-xs mb-1">Savings Rate</Text>
              <Text className="text-foreground text-2xl font-bold">
                {savingsRate.toFixed(1)}%
              </Text>
              <Text className="text-muted text-xs mt-2">
                {savingsRate >= 20 ? 'Excellent' : savingsRate >= 10 ? 'Good' : 'Needs work'}
              </Text>
            </View>
          </View>

          {/* Income vs Expenses */}
          <View className="bg-surface rounded-3xl p-6 border border-border">
            <Text className="text-lg font-bold text-foreground mb-4">Income vs Expenses</Text>
            <View className="gap-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: colors.success + '20' }}
                  >
                    <IconSymbol name="arrow.down.circle.fill" size={24} color={colors.success} />
                  </View>
                  <View>
                    <Text className="text-sm text-muted">Income</Text>
                    <Text className="text-lg font-bold text-foreground">
                      {formatCurrency(totalIncome)}
                    </Text>
                  </View>
                </View>
                <Text className="text-sm font-semibold" style={{ color: colors.success }}>
                  +{((totalIncome / (totalIncome + totalExpenses)) * 100).toFixed(0)}%
                </Text>
              </View>

              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: colors.error + '20' }}
                  >
                    <IconSymbol name="arrow.up.circle.fill" size={24} color={colors.error} />
                  </View>
                  <View>
                    <Text className="text-sm text-muted">Expenses</Text>
                    <Text className="text-lg font-bold text-foreground">
                      {formatCurrency(totalExpenses)}
                    </Text>
                  </View>
                </View>
                <Text className="text-sm font-semibold" style={{ color: colors.error }}>
                  -{((totalExpenses / (totalIncome + totalExpenses)) * 100).toFixed(0)}%
                </Text>
              </View>
            </View>
          </View>

          {/* Spending by Category */}
          <View className="bg-surface rounded-3xl p-6 border border-border">
            <Text className="text-lg font-bold text-foreground mb-4">Spending by Category</Text>
            {categoryBreakdown.length === 0 ? (
              <Text className="text-muted text-center py-4">No spending data available</Text>
            ) : (
              <View className="gap-3">
                {categoryBreakdown.map((cat: any, index: number) => (
                  <View key={index}>
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-row items-center flex-1">
                        <Text className="text-2xl mr-3">{getCategoryIcon(cat.category)}</Text>
                        <Text className="text-sm font-semibold text-foreground capitalize">
                          {cat.category}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-sm font-bold text-foreground">
                          {formatCurrency(cat.amount)}
                        </Text>
                        <Text className="text-xs text-muted">{cat.percentage.toFixed(1)}%</Text>
                      </View>
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
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* AI Insights */}
          <View className="bg-surface rounded-3xl p-6 border border-border">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-bold text-foreground">AI Insights</Text>
              <TouchableOpacity
                onPress={handleAnalyzeInsights}
                disabled={analyzingInsights}
                activeOpacity={0.7}
                className="flex-row items-center"
              >
                {analyzingInsights ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <IconSymbol name="arrow.clockwise" size={18} color={colors.primary} />
                    <Text className="text-sm font-semibold ml-2" style={{ color: colors.primary }}>
                      Refresh
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {aiInsights.length === 0 ? (
              <View className="items-center py-6">
                <IconSymbol name="lightbulb.fill" size={48} color={colors.muted} />
                <Text className="text-muted text-center mt-3">
                  {analyzingInsights ? 'Analyzing your spending...' : 'No insights available yet'}
                </Text>
                {!analyzingInsights && transactions.length > 0 && (
                  <TouchableOpacity
                    onPress={handleAnalyzeInsights}
                    activeOpacity={0.7}
                    className="bg-primary rounded-2xl py-3 px-6 mt-4"
                  >
                    <Text className="text-background font-bold">Generate Insights</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View className="gap-3">
                {aiInsights.map((insight: string, index: number) => (
                  <View
                    key={index}
                    className="flex-row items-start p-4 bg-background rounded-2xl"
                  >
                    <View
                      className="w-6 h-6 rounded-full items-center justify-center mr-3 mt-0.5"
                      style={{ backgroundColor: colors.primary + '20' }}
                    >
                      <Text className="text-xs font-bold" style={{ color: colors.primary }}>
                        {index + 1}
                      </Text>
                    </View>
                    <Text className="flex-1 text-sm text-foreground leading-5">{insight}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
