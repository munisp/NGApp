import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Recommendation {
  riskProfile: string;
  riskScore: number;
  allocation: { stocks: number; bonds: number; cash: number };
  answers: Record<string, number>;
  createdAt: string;
}

export default function RoboAdvisorRecommendationScreen() {
  const router = useRouter();
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [aiInsights, setAiInsights] = useState<string[]>([]);

  useEffect(() => {
    loadRecommendation();
  }, []);

  const loadRecommendation = async () => {
    try {
      const stored = await AsyncStorage.getItem('roboAdvisorRecommendation');
      if (stored) {
        const rec = JSON.parse(stored);
        setRecommendation(rec);
        generateAIInsights(rec);
      }
    } catch (error) {
      console.error('Failed to load recommendation:', error);
    }
  };

  const generateAIInsights = (rec: Recommendation) => {
    const insights: string[] = [];

    // Generate insights based on risk profile
    if (rec.riskProfile === 'Aggressive') {
      insights.push('Your portfolio focuses on high-growth stocks with potential for significant returns');
      insights.push('Consider diversifying across sectors: technology, healthcare, and emerging markets');
      insights.push('Expect higher volatility but potential for 8-12% annual returns');
    } else if (rec.riskProfile === 'Growth') {
      insights.push('Balanced approach with emphasis on growth stocks and some bonds for stability');
      insights.push('Mix of large-cap stocks (60%) and mid-cap growth stocks (10%)');
      insights.push('Expected annual returns: 6-9% with moderate volatility');
    } else if (rec.riskProfile === 'Balanced') {
      insights.push('Equal focus on growth and income with balanced risk');
      insights.push('Diversified mix of stocks, bonds, and dividend-paying equities');
      insights.push('Target annual returns: 5-7% with moderate risk');
    } else if (rec.riskProfile === 'Conservative') {
      insights.push('Focus on capital preservation with steady income generation');
      insights.push('Emphasis on high-quality bonds and blue-chip dividend stocks');
      insights.push('Expected returns: 3-5% annually with low volatility');
    } else {
      insights.push('Maximum capital preservation with minimal risk exposure');
      insights.push('Primarily bonds, treasury securities, and cash equivalents');
      insights.push('Target returns: 2-4% annually with very low risk');
    }

    // Add rebalancing recommendation
    insights.push('Rebalance your portfolio quarterly to maintain target allocation');
    insights.push('Consider tax-loss harvesting opportunities to minimize tax liability');

    setAiInsights(insights);
  };

  const getRiskColor = (profile: string) => {
    switch (profile) {
      case 'Aggressive':
        return 'text-error';
      case 'Growth':
        return 'text-warning';
      case 'Balanced':
        return 'text-primary';
      case 'Conservative':
        return 'text-success';
      default:
        return 'text-muted';
    }
  };

  const handleAcceptRecommendation = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Portfolio Created',
      'Your investment portfolio has been created based on these recommendations',
      [{ text: 'OK', onPress: () => router.push('/(investments)' as any) }]
    );
  };

  if (!recommendation) {
    return (
      <ScreenContainer className="p-4">
        <Stack.Screen options={{ title: 'Recommendation', headerShown: true }} />
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted">Loading recommendation...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Your Investment Plan', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Risk Profile Card */}
        <View className="bg-primary rounded-2xl p-8 mb-6 items-center">
          <Text className="text-white/80 text-lg mb-2">Your Risk Profile</Text>
          <Text className="text-white font-bold text-5xl mb-2">{recommendation.riskProfile}</Text>
          <View className="bg-white/30 px-4 py-2 rounded-full">
            <Text className="text-white font-bold">Risk Score: {Math.round(recommendation.riskScore)}/100</Text>
          </View>
        </View>

        {/* Allocation */}
        <View className="mb-6">
          <Text className="text-foreground font-bold text-2xl mb-4">Recommended Allocation</Text>

          {/* Stocks */}
          <View className="mb-4">
            <View className="flex-row justify-between mb-2">
              <Text className="text-foreground font-semibold text-lg">Stocks</Text>
              <Text className="text-foreground font-bold text-xl">{recommendation.allocation.stocks}%</Text>
            </View>
            <View className="bg-muted/20 h-3 rounded-full overflow-hidden">
              <View
                className="bg-error h-full rounded-full"
                style={{ width: `${recommendation.allocation.stocks}%` }}
              />
            </View>
            <Text className="text-muted text-sm mt-1">
              Growth potential with higher volatility
            </Text>
          </View>

          {/* Bonds */}
          <View className="mb-4">
            <View className="flex-row justify-between mb-2">
              <Text className="text-foreground font-semibold text-lg">Bonds</Text>
              <Text className="text-foreground font-bold text-xl">{recommendation.allocation.bonds}%</Text>
            </View>
            <View className="bg-muted/20 h-3 rounded-full overflow-hidden">
              <View
                className="bg-primary h-full rounded-full"
                style={{ width: `${recommendation.allocation.bonds}%` }}
              />
            </View>
            <Text className="text-muted text-sm mt-1">
              Steady income with lower risk
            </Text>
          </View>

          {/* Cash */}
          <View className="mb-4">
            <View className="flex-row justify-between mb-2">
              <Text className="text-foreground font-semibold text-lg">Cash & Equivalents</Text>
              <Text className="text-foreground font-bold text-xl">{recommendation.allocation.cash}%</Text>
            </View>
            <View className="bg-muted/20 h-3 rounded-full overflow-hidden">
              <View
                className="bg-success h-full rounded-full"
                style={{ width: `${recommendation.allocation.cash}%` }}
              />
            </View>
            <Text className="text-muted text-sm mt-1">
              Liquidity and capital preservation
            </Text>
          </View>
        </View>

        {/* AI Insights */}
        <View className="mb-6">
          <Text className="text-foreground font-bold text-2xl mb-4">🤖 AI Investment Insights</Text>
          <View className="gap-3">
            {aiInsights.map((insight, index) => (
              <View key={index} className="bg-surface rounded-xl p-5 border border-border">
                <View className="flex-row items-start gap-3">
                  <View className="w-8 h-8 rounded-full bg-primary/20 items-center justify-center mt-1">
                    <Text className="text-primary font-bold">{index + 1}</Text>
                  </View>
                  <Text className="flex-1 text-foreground leading-relaxed">{insight}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Expected Performance */}
        <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30">
          <Text className="text-foreground font-bold text-lg mb-4">📈 Expected Performance</Text>
          <View className="gap-3">
            <View className="flex-row justify-between">
              <Text className="text-muted">1 Year Projection</Text>
              <Text className="text-foreground font-bold">
                {recommendation.riskProfile === 'Aggressive' ? '+10%' :
                 recommendation.riskProfile === 'Growth' ? '+7.5%' :
                 recommendation.riskProfile === 'Balanced' ? '+6%' :
                 recommendation.riskProfile === 'Conservative' ? '+4%' : '+3%'}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-muted">5 Year Projection</Text>
              <Text className="text-foreground font-bold">
                {recommendation.riskProfile === 'Aggressive' ? '+60%' :
                 recommendation.riskProfile === 'Growth' ? '+42%' :
                 recommendation.riskProfile === 'Balanced' ? '+33%' :
                 recommendation.riskProfile === 'Conservative' ? '+22%' : '+16%'}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-muted">Volatility Risk</Text>
              <Text className={`font-bold ${getRiskColor(recommendation.riskProfile)}`}>
                {recommendation.riskProfile === 'Aggressive' || recommendation.riskProfile === 'Growth' ? 'High' :
                 recommendation.riskProfile === 'Balanced' ? 'Medium' : 'Low'}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="gap-3 mb-6">
          <TouchableOpacity
            onPress={handleAcceptRecommendation}
            className="bg-primary rounded-xl p-5"
            style={{ opacity: 1 }}
          >
            <Text className="text-white font-bold text-center text-lg">Accept & Create Portfolio</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-surface border border-border rounded-xl p-5"
            style={{ opacity: 1 }}
          >
            <Text className="text-foreground font-semibold text-center">Retake Assessment</Text>
          </TouchableOpacity>
        </View>

        {/* Disclaimer */}
        <View className="bg-warning/10 rounded-xl p-5 border border-warning/30">
          <Text className="text-foreground font-bold mb-2">⚠️ Important Disclaimer</Text>
          <Text className="text-foreground leading-relaxed text-sm">
            This recommendation is for informational purposes only and does not constitute financial advice. Past performance does not guarantee future results. Please consult with a qualified financial advisor before making investment decisions.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
