import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface WellnessMetrics {
  overallScore: number;
  savingsRate: number;
  debtToIncome: number;
  budgetAdherence: number;
  creditScore: number;
  emergencyFund: number;
}

export default function WellnessScreen() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<WellnessMetrics>({
    overallScore: 0,
    savingsRate: 0,
    debtToIncome: 0,
    budgetAdherence: 0,
    creditScore: 0,
    emergencyFund: 0,
  });

  useEffect(() => {
    calculateWellnessScore();
  }, []);

  const calculateWellnessScore = async () => {
    try {
      // In a real app, fetch from backend
      // Mock calculation based on user's financial data
      const savingsRate = 25; // 25% of income saved
      const debtToIncome = 20; // 20% debt-to-income ratio
      const budgetAdherence = 85; // 85% budget adherence
      const creditScore = 720; // Credit score
      const emergencyFund = 4; // 4 months of expenses

      // Calculate overall wellness score (0-100)
      const overallScore = Math.round(
        (savingsRate / 30) * 20 + // 20 points for savings rate
        (1 - debtToIncome / 100) * 20 + // 20 points for low debt
        (budgetAdherence / 100) * 20 + // 20 points for budget adherence
        (creditScore / 850) * 20 + // 20 points for credit score
        Math.min(emergencyFund / 6, 1) * 20 // 20 points for emergency fund
      );

      setMetrics({
        overallScore,
        savingsRate,
        debtToIncome,
        budgetAdherence,
        creditScore,
        emergencyFund,
      });

      await AsyncStorage.setItem('wellnessMetrics', JSON.stringify({
        overallScore,
        savingsRate,
        debtToIncome,
        budgetAdherence,
        creditScore,
        emergencyFund,
      }));
    } catch (error) {
      console.error('Failed to calculate wellness score:', error);
    }
  };

  const getScoreRating = (score: number) => {
    if (score >= 80) return { label: 'Excellent', color: 'text-success' };
    if (score >= 60) return { label: 'Good', color: 'text-primary' };
    if (score >= 40) return { label: 'Fair', color: 'text-warning' };
    return { label: 'Needs Work', color: 'text-error' };
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#22C55E';
    if (score >= 60) return '#0a7ea4';
    if (score >= 40) return '#F59E0B';
    return '#EF4444';
  };

  const rating = getScoreRating(metrics.overallScore);

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Financial Wellness', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-foreground font-bold text-3xl mb-2">Financial Wellness</Text>
          <Text className="text-muted">Your comprehensive financial health score</Text>
        </View>

        {/* Overall Score Card */}
        <View className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-8 mb-6 items-center"
          style={{ backgroundColor: getScoreColor(metrics.overallScore) }}>
          <Text className="text-white/80 text-lg mb-2">Your Wellness Score</Text>
          <Text className="text-white font-bold text-7xl mb-2">{metrics.overallScore}</Text>
          <View className="bg-white/30 px-4 py-2 rounded-full">
            <Text className="text-white font-bold text-xl">{rating.label}</Text>
          </View>
          <Text className="text-white/90 text-center mt-4">
            You're doing {rating.label.toLowerCase()} with your finances!
          </Text>
        </View>

        {/* Metrics Breakdown */}
        <View className="mb-6">
          <Text className="text-foreground font-bold text-xl mb-4">Score Breakdown</Text>

          {/* Savings Rate */}
          <TouchableOpacity
            onPress={() => router.push('/(wellness)/savings' as any)}
            className="bg-surface rounded-xl p-5 mb-3 border border-border"
            style={{ opacity: 1 }}
          >
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-3">
                <View className="w-12 h-12 rounded-full bg-success/20 items-center justify-center">
                  <Text className="text-2xl">💰</Text>
                </View>
                <View>
                  <Text className="text-foreground font-bold text-lg">Savings Rate</Text>
                  <Text className="text-muted text-sm">Percentage of income saved</Text>
                </View>
              </View>
              <Text className="text-foreground font-bold text-2xl">{metrics.savingsRate}%</Text>
            </View>
            <View className="bg-muted/20 h-2 rounded-full overflow-hidden">
              <View
                className="bg-success h-full rounded-full"
                style={{ width: `${Math.min(metrics.savingsRate / 30 * 100, 100)}%` }}
              />
            </View>
          </TouchableOpacity>

          {/* Debt-to-Income Ratio */}
          <TouchableOpacity
            onPress={() => router.push('/(wellness)/debt' as any)}
            className="bg-surface rounded-xl p-5 mb-3 border border-border"
            style={{ opacity: 1 }}
          >
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-3">
                <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center">
                  <Text className="text-2xl">📊</Text>
                </View>
                <View>
                  <Text className="text-foreground font-bold text-lg">Debt-to-Income</Text>
                  <Text className="text-muted text-sm">Debt as % of income</Text>
                </View>
              </View>
              <Text className="text-foreground font-bold text-2xl">{metrics.debtToIncome}%</Text>
            </View>
            <View className="bg-muted/20 h-2 rounded-full overflow-hidden">
              <View
                className="bg-primary h-full rounded-full"
                style={{ width: `${Math.min(metrics.debtToIncome, 100)}%` }}
              />
            </View>
          </TouchableOpacity>

          {/* Budget Adherence */}
          <TouchableOpacity
            onPress={() => router.push('/(wellness)/budget' as any)}
            className="bg-surface rounded-xl p-5 mb-3 border border-border"
            style={{ opacity: 1 }}
          >
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-3">
                <View className="w-12 h-12 rounded-full bg-warning/20 items-center justify-center">
                  <Text className="text-2xl">📋</Text>
                </View>
                <View>
                  <Text className="text-foreground font-bold text-lg">Budget Adherence</Text>
                  <Text className="text-muted text-sm">Staying within budget</Text>
                </View>
              </View>
              <Text className="text-foreground font-bold text-2xl">{metrics.budgetAdherence}%</Text>
            </View>
            <View className="bg-muted/20 h-2 rounded-full overflow-hidden">
              <View
                className="bg-warning h-full rounded-full"
                style={{ width: `${metrics.budgetAdherence}%` }}
              />
            </View>
          </TouchableOpacity>

          {/* Credit Score */}
          <TouchableOpacity
            onPress={() => router.push('/(credit)' as any)}
            className="bg-surface rounded-xl p-5 mb-3 border border-border"
            style={{ opacity: 1 }}
          >
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-3">
                <View className="w-12 h-12 rounded-full bg-error/20 items-center justify-center">
                  <Text className="text-2xl">⭐</Text>
                </View>
                <View>
                  <Text className="text-foreground font-bold text-lg">Credit Score</Text>
                  <Text className="text-muted text-sm">Creditworthiness rating</Text>
                </View>
              </View>
              <Text className="text-foreground font-bold text-2xl">{metrics.creditScore}</Text>
            </View>
            <View className="bg-muted/20 h-2 rounded-full overflow-hidden">
              <View
                className="bg-error h-full rounded-full"
                style={{ width: `${(metrics.creditScore / 850) * 100}%` }}
              />
            </View>
          </TouchableOpacity>

          {/* Emergency Fund */}
          <TouchableOpacity
            onPress={() => router.push('/(wellness)/emergency' as any)}
            className="bg-surface rounded-xl p-5 mb-3 border border-border"
            style={{ opacity: 1 }}
          >
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-3">
                <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center">
                  <Text className="text-2xl">🛡️</Text>
                </View>
                <View>
                  <Text className="text-foreground font-bold text-lg">Emergency Fund</Text>
                  <Text className="text-muted text-sm">Months of expenses covered</Text>
                </View>
              </View>
              <Text className="text-foreground font-bold text-2xl">{metrics.emergencyFund}mo</Text>
            </View>
            <View className="bg-muted/20 h-2 rounded-full overflow-hidden">
              <View
                className="bg-primary h-full rounded-full"
                style={{ width: `${Math.min((metrics.emergencyFund / 6) * 100, 100)}%` }}
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Improvement Tips */}
        <View className="bg-primary/10 rounded-xl p-5 border border-primary/30">
          <Text className="text-foreground font-bold text-lg mb-4">💡 Improvement Tips</Text>
          <View className="gap-3">
            {metrics.savingsRate < 20 && (
              <Text className="text-foreground leading-relaxed">
                • Try to increase your savings rate to at least 20% of your income
              </Text>
            )}
            {metrics.debtToIncome > 30 && (
              <Text className="text-foreground leading-relaxed">
                • Consider paying down debt to reduce your debt-to-income ratio below 30%
              </Text>
            )}
            {metrics.budgetAdherence < 80 && (
              <Text className="text-foreground leading-relaxed">
                • Review your budget categories and adjust spending to stay on track
              </Text>
            )}
            {metrics.creditScore < 700 && (
              <Text className="text-foreground leading-relaxed">
                • Pay bills on time and keep credit utilization below 30% to improve your score
              </Text>
            )}
            {metrics.emergencyFund < 6 && (
              <Text className="text-foreground leading-relaxed">
                • Build your emergency fund to cover 6 months of expenses for financial security
              </Text>
            )}
            {metrics.overallScore >= 80 && (
              <Text className="text-foreground leading-relaxed">
                • Great job! Keep up the excellent financial habits and consider increasing investments
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
