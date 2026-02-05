import { useState, useEffect } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Pressable, Dimensions } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { trpc } from '@/lib/trpc';
import Svg, { Circle, G } from 'react-native-svg';

const { width } = Dimensions.get('window');

interface CreditScore {
  score: number;
  rating: string;
  lastUpdated: string;
  factors: {
    paymentHistory: number;
    creditUtilization: number;
    creditAge: number;
    creditMix: number;
    newCredit: number;
  };
  recommendations: string[];
}

interface CreditFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
  weight: number;
}

interface CreditHistory {
  date: string;
  score: number;
}

export default function CreditScoreScreen() {
  const colors = useColors();
  const [creditScore, setCreditScore] = useState<CreditScore | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch credit score
  const { data: scoreData, isLoading } = trpc.creditScore.getCurrentScore.useQuery();

  useEffect(() => {
    if (scoreData) {
      setCreditScore(scoreData);
      setLoading(false);
    }
  }, [scoreData]);

  const getScoreColor = (score: number) => {
    if (score >= 750) return '#22C55E'; // Excellent - Green
    if (score >= 650) return '#84CC16'; // Good - Lime
    if (score >= 550) return '#F59E0B'; // Fair - Amber
    if (score >= 450) return '#F97316'; // Poor - Orange
    return '#EF4444'; // Very Poor - Red
  };

  const getScoreRating = (score: number): string => {
    if (score >= 750) return 'Excellent';
    if (score >= 650) return 'Good';
    if (score >= 550) return 'Fair';
    if (score >= 450) return 'Poor';
    return 'Very Poor';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NG', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const CircularScore = ({ score }: { score: number }) => {
    const size = width * 0.6;
    const strokeWidth = 20;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const progress = (score / 850) * circumference;
    const scoreColor = getScoreColor(score);

    return (
      <View className="items-center justify-center" style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G rotation="-90" origin={`${size/2}, ${size/2}`}>
            {/* Background circle */}
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={colors.border}
              strokeWidth={strokeWidth}
              fill="none"
            />
            {/* Progress circle */}
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={scoreColor}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${progress} ${circumference}`}
              strokeLinecap="round"
            />
          </G>
        </Svg>
        <View className="absolute items-center">
          <Text className="text-6xl font-bold text-foreground">{score}</Text>
          <Text className="text-sm text-muted mt-1">out of 850</Text>
          <View className={`px-4 py-2 rounded-full mt-3`} style={{ backgroundColor: `${scoreColor}20` }}>
            <Text className="text-sm font-semibold" style={{ color: scoreColor }}>
              {getScoreRating(score)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const handleImproveScore = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/credit-score/improve');
  };

  const handleViewHistory = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/credit-score/history');
  };

  return (
    <ScreenContainer className="p-0">
      {/* Header */}
      <View className="bg-primary px-6 pt-6 pb-4">
        <Text className="text-3xl font-bold text-white mb-2">Credit Score</Text>
        <Text className="text-base text-white/80">Track your financial health</Text>
      </View>

      <ScrollView className="flex-1 px-6 py-6">
        {loading || isLoading ? (
          <View className="flex-1 items-center justify-center py-12">
            <Text className="text-muted">Loading credit score...</Text>
          </View>
        ) : !creditScore ? (
          <View className="flex-1 items-center justify-center py-12">
            <View className="w-20 h-20 rounded-full bg-surface items-center justify-center mb-4">
              <Text className="text-4xl">📊</Text>
            </View>
            <Text className="text-lg font-semibold text-foreground mb-2">
              No Credit Score Yet
            </Text>
            <Text className="text-sm text-muted text-center mb-6 px-8">
              Complete a few transactions to build your credit history
            </Text>
          </View>
        ) : (
          <>
            {/* Credit Score Circle */}
            <View className="items-center mb-8">
              <CircularScore score={creditScore.score} />
              <Text className="text-xs text-muted mt-4">
                Last updated: {formatDate(creditScore.lastUpdated)}
              </Text>
            </View>

            {/* Quick Actions */}
            <View className="flex-row gap-3 mb-6">
              <Pressable
                className="flex-1 bg-primary rounded-xl p-4"
                onPress={handleImproveScore}
                style={({ pressed }: { pressed: boolean }) => [{ opacity: pressed ? 0.8 : 1 }]}
              >
                <View className="items-center">
                  <IconSymbol name="arrow.up.circle" size={24} color="#FFFFFF" />
                  <Text className="text-white font-semibold mt-2">Improve Score</Text>
                </View>
              </Pressable>
              <Pressable
                className="flex-1 bg-surface rounded-xl p-4 border border-border"
                onPress={handleViewHistory}
                style={({ pressed }: { pressed: boolean }) => [{ opacity: pressed ? 0.8 : 1 }]}
              >
                <View className="items-center">
                  <IconSymbol name="chart.line.uptrend.xyaxis" size={24} color={colors.foreground} />
                  <Text className="text-foreground font-semibold mt-2">View History</Text>
                </View>
              </Pressable>
            </View>

            {/* Credit Factors */}
            <View className="mb-6">
              <Text className="text-lg font-bold text-foreground mb-3">
                What affects your score
              </Text>
              {Object.entries(creditScore.factors).map(([key, value], index) => {
                const factorNames: Record<string, string> = {
                  paymentHistory: 'Payment History',
                  creditUtilization: 'Credit Utilization',
                  creditAge: 'Credit Age',
                  creditMix: 'Credit Mix',
                  newCredit: 'New Credit',
                };
                const factor = {
                  name: factorNames[key] || key,
                  impact: value >= 70 ? 'positive' as const : value >= 50 ? 'neutral' as const : 'negative' as const,
                  weight: value,
                  description: '',
                };
                return (
                <View
                  key={index}
                  className="bg-surface rounded-xl p-4 mb-3 border border-border"
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-row items-center flex-1">
                      <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
                        factor.impact === 'positive' ? 'bg-success/20' :
                        factor.impact === 'negative' ? 'bg-error/20' :
                        'bg-muted/20'
                      }`}>
                        <Text className="text-base">
                          {factor.impact === 'positive' ? '✓' : factor.impact === 'negative' ? '✗' : '○'}
                        </Text>
                      </View>
                      <Text className="text-base font-semibold text-foreground flex-1">
                        {factor.name}
                      </Text>
                    </View>
                    <View className="px-2 py-1 rounded-full bg-primary/10">
                      <Text className="text-xs font-medium text-primary">
                        {factor.weight}%
                      </Text>
                    </View>
                  </View>
                  <Text className="text-sm text-muted leading-relaxed ml-11">
                    {factor.description}
                  </Text>
                </View>
              );
              })}
            </View>

            {/* Recommendations */}
            {creditScore.recommendations.length > 0 && (
              <View className="mb-6">
                <Text className="text-lg font-bold text-foreground mb-3">
                  How to improve
                </Text>
                {creditScore.recommendations.map((recommendation, index) => (
                  <View
                    key={index}
                    className="bg-primary/10 rounded-xl p-4 mb-3 border border-primary/20"
                  >
                    <View className="flex-row items-start">
                      <View className="w-6 h-6 rounded-full bg-primary/20 items-center justify-center mr-3 mt-0.5">
                        <Text className="text-xs font-bold text-primary">{index + 1}</Text>
                      </View>
                      <Text className="text-sm text-foreground leading-relaxed flex-1">
                        {recommendation}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Score Range Info */}
            <View className="bg-surface rounded-xl p-4 mb-6 border border-border">
              <Text className="text-base font-semibold text-foreground mb-3">
                Credit Score Ranges
              </Text>
              <View className="space-y-2">
                {[
                  { range: '750-850', label: 'Excellent', color: '#22C55E' },
                  { range: '650-749', label: 'Good', color: '#84CC16' },
                  { range: '550-649', label: 'Fair', color: '#F59E0B' },
                  { range: '450-549', label: 'Poor', color: '#F97316' },
                  { range: '300-449', label: 'Very Poor', color: '#EF4444' },
                ].map((item, index) => (
                  <View key={index} className="flex-row items-center justify-between py-2">
                    <View className="flex-row items-center">
                      <View 
                        className="w-3 h-3 rounded-full mr-3" 
                        style={{ backgroundColor: item.color }}
                      />
                      <Text className="text-sm text-foreground font-medium">{item.label}</Text>
                    </View>
                    <Text className="text-sm text-muted">{item.range}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Info Card */}
            <View className="bg-primary/10 rounded-xl p-4 mb-6 border border-primary/20">
              <View className="flex-row items-start">
                <View className="w-8 h-8 rounded-full bg-primary/20 items-center justify-center mr-3 mt-1">
                  <IconSymbol name="info.circle" size={16} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground mb-1">
                    How we calculate your score
                  </Text>
                  <Text className="text-xs text-muted leading-relaxed">
                    Your credit score is calculated based on your payment history, transaction patterns, savings behavior, and loan repayment record. It's updated monthly.
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
