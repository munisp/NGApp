import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Dimensions } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { trpc } from '@/lib/trpc';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
// Chart library imports removed - using simple visualization instead

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CreditScoreDashboardScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);

  const { data: scoreData, isLoading, refetch } = trpc.creditScore.getCurrentScore.useQuery();
  const { data: historyData } = trpc.creditScore.getScoreHistory.useQuery({
    months: 12,
  });
  const { data: factorsData } = trpc.creditScore.getFactorsBreakdown.useQuery();

  const handleRefresh = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 800) return colors.success;
    if (score >= 740) return '#4CAF50';
    if (score >= 670) return colors.warning;
    if (score >= 580) return '#FF9800';
    return colors.error;
  };

  const getScoreLabel = (score: number) => {
    if (score >= 800) return 'Excellent';
    if (score >= 740) return 'Very Good';
    if (score >= 670) return 'Good';
    if (score >= 580) return 'Fair';
    return 'Poor';
  };

  const getScoreDescription = (score: number) => {
    if (score >= 800) return 'Outstanding credit! You qualify for the best rates.';
    if (score >= 740) return 'Great credit! You have access to favorable terms.';
    if (score >= 670) return 'Good credit! Most lenders will approve you.';
    if (score >= 580) return 'Fair credit. Work on improving for better rates.';
    return 'Building credit. Focus on payment history and utilization.';
  };

  const formatFactorValue = (value: number) => {
    return `${Math.round(value)}%`;
  };

  const getFactorColor = (value: number) => {
    if (value >= 80) return colors.success;
    if (value >= 60) return colors.warning;
    return colors.error;
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'positive':
        return 'arrow.up.circle.fill';
      case 'negative':
        return 'arrow.down.circle.fill';
      default:
        return 'minus.circle.fill';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'positive':
        return colors.success;
      case 'negative':
        return colors.error;
      default:
        return colors.muted;
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer className="p-4">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-4">Loading credit score...</Text>
        </View>
      </ScreenContainer>
    );
  }

  const score = scoreData?.score || 0;
  const rating = scoreData?.rating || 'poor';
  const recommendations = scoreData?.recommendations || [];
  const factors = factorsData?.factors || { paymentHistory: 0, creditUtilization: 0, creditAge: 0, creditMix: 0, newCredit: 0 };
  
  // Convert factors object to array for rendering
  const factorsArray = [
    { factorType: 'payment_history', value: factors.paymentHistory?.toString() || '0', impact: factors.paymentHistory >= 80 ? 'positive' : factors.paymentHistory >= 60 ? 'neutral' : 'negative', description: 'On-time payment history' },
    { factorType: 'credit_utilization', value: factors.creditUtilization?.toString() || '0', impact: factors.creditUtilization <= 30 ? 'positive' : factors.creditUtilization <= 50 ? 'neutral' : 'negative', description: 'Percentage of credit used' },
    { factorType: 'credit_age', value: factors.creditAge?.toString() || '0', impact: factors.creditAge >= 70 ? 'positive' : factors.creditAge >= 50 ? 'neutral' : 'negative', description: 'Average age of accounts' },
    { factorType: 'credit_mix', value: factors.creditMix?.toString() || '0', impact: factors.creditMix >= 70 ? 'positive' : factors.creditMix >= 50 ? 'neutral' : 'negative', description: 'Variety of credit types' },
    { factorType: 'new_credit', value: factors.newCredit?.toString() || '0', impact: factors.newCredit >= 70 ? 'positive' : factors.newCredit >= 50 ? 'neutral' : 'negative', description: 'Recent credit inquiries' },
  ];
  const history = historyData || [];

  // Prepare chart data
  const chartData = history.map((h: any) => h.score);
  const chartLabels = history.map((h: any) => {
    const date = new Date(h.date);
    return date.toLocaleDateString('en-US', { month: 'short' });
  });

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
            <Text className="text-3xl font-bold text-foreground">Credit Score</Text>
            <Text className="text-muted mt-1">Monitor your credit health</Text>
          </View>

          {/* Score Card */}
          <View className="bg-surface rounded-3xl p-6 border border-border">
            <View className="items-center">
              <View
                className="w-40 h-40 rounded-full items-center justify-center"
                style={{
                  backgroundColor: `${getScoreColor(score)}20`,
                  borderWidth: 8,
                  borderColor: getScoreColor(score),
                }}
              >
                <Text className="text-5xl font-bold" style={{ color: getScoreColor(score) }}>
                  {score}
                </Text>
              </View>
              <Text className="text-2xl font-bold text-foreground mt-4">
                {getScoreLabel(score)}
              </Text>
              <Text className="text-sm text-muted text-center mt-2 px-4">
                {getScoreDescription(score)}
              </Text>
              <View className="flex-row items-center mt-4">
                <IconSymbol name="calendar" size={16} color={colors.muted} />
                <Text className="text-xs text-muted ml-2">
                  Last updated: {new Date().toLocaleDateString()}
                </Text>
              </View>
            </View>
          </View>

          {/* Score Trend Chart */}
          {chartData.length > 0 && (
            <View className="bg-surface rounded-3xl p-6 border border-border">
              <Text className="text-lg font-bold text-foreground mb-4">12-Month Trend</Text>
              <View className="flex-row items-end justify-between" style={{ height: 150 }}>
                {chartData.slice(-6).map((value: number, index: number) => {
                  const maxScore = 850;
                  const minScore = 300;
                  const normalizedHeight = ((value - minScore) / (maxScore - minScore)) * 100;
                  return (
                    <View key={index} className="flex-1 items-center">
                      <View
                        className="w-8 rounded-t-lg"
                        style={{
                          height: `${normalizedHeight}%`,
                          backgroundColor: getScoreColor(value),
                        }}
                      />
                      <Text className="text-xs text-muted mt-2">{value}</Text>
                    </View>
                  );
                })}
              </View>
              <View className="flex-row justify-between mt-2 px-2">
                {chartLabels.slice(0, 6).map((label: string, index: number) => (
                  <Text key={index} className="text-xs text-muted">
                    {label}
                  </Text>
                ))}
              </View>
            </View>
          )}

          {/* Credit Factors */}
          <View className="bg-surface rounded-3xl p-6 border border-border">
            <Text className="text-lg font-bold text-foreground mb-4">Credit Factors</Text>
            <View className="gap-4">
              {factorsArray.map((factor: any, index: number) => (
                <View key={index}>
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center flex-1">
                      <IconSymbol
                        name={getImpactIcon(factor.impact)}
                        size={20}
                        color={getImpactColor(factor.impact)}
                      />
                      <Text className="text-sm font-medium text-foreground ml-2 flex-1">
                        {factor.factorType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </Text>
                    </View>
                    <Text
                      className="text-sm font-bold"
                      style={{ color: getFactorColor(parseFloat(factor.value)) }}
                    >
                      {formatFactorValue(parseFloat(factor.value))}
                    </Text>
                  </View>
                  <View className="h-2 bg-background rounded-full overflow-hidden">
                    <View
                      className="h-full rounded-full"
                      style={{
                        width: `${parseFloat(factor.value)}%`,
                        backgroundColor: getFactorColor(parseFloat(factor.value)),
                      }}
                    />
                  </View>
                  {factor.description && (
                    <Text className="text-xs text-muted mt-1">{factor.description}</Text>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <View className="bg-surface rounded-3xl p-6 border border-border">
              <Text className="text-lg font-bold text-foreground mb-4">
                Recommendations
              </Text>
              <View className="gap-3">
                {recommendations.map((rec: string, index: number) => (
                  <View key={index} className="flex-row items-start">
                    <View
                      className="w-6 h-6 rounded-full items-center justify-center mt-0.5"
                      style={{ backgroundColor: colors.primary + '20' }}
                    >
                      <Text className="text-xs font-bold" style={{ color: colors.primary }}>
                        {index + 1}
                      </Text>
                    </View>
                    <Text className="text-sm text-foreground ml-3 flex-1 leading-5">
                      {rec}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View className="gap-3 pb-6">
            <TouchableOpacity
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
              activeOpacity={0.7}
              className="bg-primary rounded-2xl py-4 px-6"
            >
              <Text className="text-background font-bold text-center text-base">
                Improve My Score
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
              activeOpacity={0.7}
              className="bg-surface rounded-2xl py-4 px-6 border border-border"
            >
              <Text className="text-foreground font-semibold text-center text-base">
                View Full Report
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
