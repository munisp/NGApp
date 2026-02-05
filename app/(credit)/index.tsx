import { View, Text, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CreditScore {
  score: number;
  date: string;
}

interface CreditFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
  emoji: string;
}

const CREDIT_SCORE_KEY = 'creditScore';
const CREDIT_HISTORY_KEY = 'creditHistory';

export default function CreditScoreScreen() {
  const router = useRouter();
  const [currentScore, setCurrentScore] = useState(720);
  const [history, setHistory] = useState<CreditScore[]>([]);
  const [factors, setFactors] = useState<CreditFactor[]>([]);

  useEffect(() => {
    loadCreditData();
  }, []);

  const loadCreditData = async () => {
    try {
      // Load current score
      const storedScore = await AsyncStorage.getItem(CREDIT_SCORE_KEY);
      if (storedScore) {
        setCurrentScore(parseInt(storedScore));
      }

      // Load history
      const storedHistory = await AsyncStorage.getItem(CREDIT_HISTORY_KEY);
      let historyData: CreditScore[] = [];

      if (storedHistory) {
        historyData = JSON.parse(storedHistory);
      } else {
        // Generate sample history
        historyData = [
          { score: 680, date: new Date(Date.now() - 180 * 86400000).toISOString() },
          { score: 695, date: new Date(Date.now() - 150 * 86400000).toISOString() },
          { score: 705, date: new Date(Date.now() - 120 * 86400000).toISOString() },
          { score: 710, date: new Date(Date.now() - 90 * 86400000).toISOString() },
          { score: 715, date: new Date(Date.now() - 60 * 86400000).toISOString() },
          { score: 720, date: new Date(Date.now() - 30 * 86400000).toISOString() },
        ];
        await AsyncStorage.setItem(CREDIT_HISTORY_KEY, JSON.stringify(historyData));
      }

      setHistory(historyData);

      // Set factors
      setFactors([
        {
          name: 'Payment History',
          impact: 'positive',
          description: 'All payments made on time',
          emoji: '✅',
        },
        {
          name: 'Credit Utilization',
          impact: 'positive',
          description: '25% of available credit used',
          emoji: '💳',
        },
        {
          name: 'Credit Age',
          impact: 'neutral',
          description: 'Average age of 3.5 years',
          emoji: '📅',
        },
        {
          name: 'Recent Inquiries',
          impact: 'negative',
          description: '2 hard inquiries in last 6 months',
          emoji: '🔍',
        },
        {
          name: 'Account Mix',
          impact: 'positive',
          description: 'Good mix of credit types',
          emoji: '🎯',
        },
      ]);
    } catch (error) {
      console.error('Failed to load credit data:', error);
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 750) return '#22C55E'; // Excellent - green
    if (score >= 700) return '#0a7ea4'; // Good - primary
    if (score >= 650) return '#F59E0B'; // Fair - warning
    return '#EF4444'; // Poor - error
  };

  const getScoreRating = (score: number): string => {
    if (score >= 750) return 'Excellent';
    if (score >= 700) return 'Good';
    if (score >= 650) return 'Fair';
    return 'Needs Work';
  };

  const scoreChange = history.length >= 2 ? currentScore - history[history.length - 2].score : 0;

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Credit Score', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Current Score */}
        <View className="bg-surface rounded-xl p-8 mb-6 border border-border items-center">
          <Text className="text-muted mb-4">Your Credit Score</Text>
          
          <View className="relative items-center mb-4">
            <Text
              className="font-bold mb-2"
              style={{ fontSize: 80, color: getScoreColor(currentScore) }}
            >
              {currentScore}
            </Text>
            <View className="absolute -right-12 top-8">
              {scoreChange !== 0 && (
                <View className={`px-3 py-1 rounded-full ${scoreChange > 0 ? 'bg-success/20' : 'bg-error/20'}`}>
                  <Text className={`font-semibold ${scoreChange > 0 ? 'text-success' : 'text-error'}`}>
                    {scoreChange > 0 ? '+' : ''}{scoreChange}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <Text className="text-foreground font-bold text-2xl mb-2">{getScoreRating(currentScore)}</Text>
          <Text className="text-muted text-center">
            Last updated {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>

          {/* Score Range */}
          <View className="w-full mt-6">
            <View className="flex-row justify-between mb-2">
              <Text className="text-muted text-xs">300</Text>
              <Text className="text-muted text-xs">850</Text>
            </View>
            <View className="h-3 bg-border/30 rounded-full overflow-hidden flex-row">
              <View className="h-full bg-error" style={{ width: '25%' }} />
              <View className="h-full bg-warning" style={{ width: '25%' }} />
              <View className="h-full bg-primary" style={{ width: '25%' }} />
              <View className="h-full bg-success" style={{ width: '25%' }} />
            </View>
            <View className="absolute top-0 left-0 right-0 h-3 items-center justify-center">
              <View
                className="w-1 h-5 bg-foreground rounded-full"
                style={{ marginLeft: `${((currentScore - 300) / 550) * 100}%` }}
              />
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="flex-row gap-3 mb-6">
          <TouchableOpacity
            onPress={() => router.push('/(credit)/factors' as any)}
            className="flex-1 bg-primary rounded-xl p-4"
            style={{ opacity: 1 }}
          >
            <Text className="text-white font-semibold text-center">View Factors</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(credit)/simulator' as any)}
            className="flex-1 bg-surface border border-border rounded-xl p-4"
            style={{ opacity: 1 }}
          >
            <Text className="text-foreground font-semibold text-center">Simulate</Text>
          </TouchableOpacity>
        </View>

        {/* Score Trend */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-4">6-Month Trend</Text>
          
          {/* Simple Line Chart */}
          <View className="h-40 mb-4">
            <View className="flex-1 flex-row items-end justify-between">
              {history.map((item, index) => {
                const height = ((item.score - 600) / 250) * 100;
                return (
                  <View key={index} className="flex-1 items-center">
                    <View
                      className="w-2 rounded-t-full"
                      style={{
                        height: `${height}%`,
                        backgroundColor: getScoreColor(item.score),
                      }}
                    />
                  </View>
                );
              })}
            </View>
          </View>

          <View className="flex-row justify-between">
            <Text className="text-muted text-xs">6 months ago</Text>
            <Text className="text-muted text-xs">Today</Text>
          </View>
        </View>

        {/* Top Factors */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-4">Factors Affecting Your Score</Text>
          
          {factors.slice(0, 3).map((factor, index) => (
            <View key={index} className="mb-4 last:mb-0">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center flex-1">
                  <Text className="text-3xl mr-3">{factor.emoji}</Text>
                  <Text className="text-foreground font-semibold flex-1">{factor.name}</Text>
                </View>
                <View
                  className={`px-3 py-1 rounded-full ${
                    factor.impact === 'positive'
                      ? 'bg-success/20'
                      : factor.impact === 'negative'
                      ? 'bg-error/20'
                      : 'bg-border/30'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      factor.impact === 'positive'
                        ? 'text-success'
                        : factor.impact === 'negative'
                        ? 'text-error'
                        : 'text-muted'
                    }`}
                  >
                    {factor.impact === 'positive' ? '↑' : factor.impact === 'negative' ? '↓' : '→'}
                  </Text>
                </View>
              </View>
              <Text className="text-muted text-sm ml-12">{factor.description}</Text>
            </View>
          ))}

          <TouchableOpacity
            onPress={() => router.push('/(credit)/factors' as any)}
            className="mt-4 pt-4 border-t border-border"
            style={{ opacity: 1 }}
          >
            <Text className="text-primary font-semibold text-center">View All Factors →</Text>
          </TouchableOpacity>
        </View>

        {/* Tips */}
        <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30">
          <Text className="text-foreground font-bold text-lg mb-4">💡 Tips to Improve</Text>
          <Text className="text-muted text-sm mb-2">
            • Keep credit utilization below 30%
          </Text>
          <Text className="text-muted text-sm mb-2">
            • Pay all bills on time
          </Text>
          <Text className="text-muted text-sm">
            • Avoid opening multiple new accounts
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
