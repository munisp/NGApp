import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import * as Haptics from 'expo-haptics';

interface Scenario {
  id: string;
  title: string;
  description: string;
  impact: number;
  emoji: string;
}

const scenarios: Scenario[] = [
  {
    id: 'pay_off_card',
    title: 'Pay Off Credit Card',
    description: 'Pay off $2,000 credit card balance',
    impact: 15,
    emoji: '💳',
  },
  {
    id: 'miss_payment',
    title: 'Miss a Payment',
    description: 'Miss one monthly payment',
    impact: -50,
    emoji: '⚠️',
  },
  {
    id: 'open_account',
    title: 'Open New Credit Card',
    description: 'Apply for a new credit card',
    impact: -10,
    emoji: '🆕',
  },
  {
    id: 'close_account',
    title: 'Close Old Account',
    description: 'Close a 5-year-old credit card',
    impact: -20,
    emoji: '❌',
  },
  {
    id: 'reduce_utilization',
    title: 'Reduce Utilization to 10%',
    description: 'Lower credit usage from 25% to 10%',
    impact: 10,
    emoji: '📉',
  },
  {
    id: 'increase_limit',
    title: 'Request Credit Limit Increase',
    description: 'Increase limit from $10k to $15k',
    impact: 8,
    emoji: '📈',
  },
];

export default function CreditSimulatorScreen() {
  const [currentScore] = useState(720);
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);

  const toggleScenario = (id: string) => {
    if (selectedScenarios.includes(id)) {
      setSelectedScenarios(selectedScenarios.filter(s => s !== id));
    } else {
      setSelectedScenarios([...selectedScenarios, id]);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const calculateProjectedScore = (): number => {
    const totalImpact = selectedScenarios.reduce((sum, id) => {
      const scenario = scenarios.find(s => s.id === id);
      return sum + (scenario?.impact || 0);
    }, 0);

    return Math.max(300, Math.min(850, currentScore + totalImpact));
  };

  const projectedScore = calculateProjectedScore();
  const scoreDiff = projectedScore - currentScore;

  const getScoreColor = (score: number): string => {
    if (score >= 750) return '#22C55E';
    if (score >= 700) return '#0a7ea4';
    if (score >= 650) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Score Simulator', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text className="text-muted mb-6">
          Select actions to see how they might affect your credit score. This is an estimate based
          on typical impacts.
        </Text>

        {/* Score Comparison */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <View className="flex-row justify-between items-center mb-6">
            {/* Current Score */}
            <View className="flex-1 items-center">
              <Text className="text-muted text-sm mb-2">Current</Text>
              <Text className="text-foreground font-bold text-4xl">{currentScore}</Text>
            </View>

            {/* Arrow */}
            <View className="px-4">
              <Text className="text-4xl">→</Text>
            </View>

            {/* Projected Score */}
            <View className="flex-1 items-center">
              <Text className="text-muted text-sm mb-2">Projected</Text>
              <Text
                className="font-bold text-4xl"
                style={{ color: getScoreColor(projectedScore) }}
              >
                {projectedScore}
              </Text>
            </View>
          </View>

          {/* Change Indicator */}
          {scoreDiff !== 0 && (
            <View
              className={`rounded-xl p-4 ${
                scoreDiff > 0 ? 'bg-success/20' : 'bg-error/20'
              }`}
            >
              <Text
                className={`text-center font-bold text-2xl ${
                  scoreDiff > 0 ? 'text-success' : 'text-error'
                }`}
              >
                {scoreDiff > 0 ? '+' : ''}{scoreDiff} points
              </Text>
              <Text className="text-center text-muted text-sm mt-1">
                {scoreDiff > 0 ? 'Potential improvement' : 'Potential decrease'}
              </Text>
            </View>
          )}
        </View>

        {/* Scenarios */}
        <Text className="text-foreground font-bold text-lg mb-4">Select Actions</Text>

        {scenarios.map(scenario => {
          const isSelected = selectedScenarios.includes(scenario.id);
          const isPositive = scenario.impact > 0;

          return (
            <TouchableOpacity
              key={scenario.id}
              onPress={() => toggleScenario(scenario.id)}
              className={`rounded-xl p-6 mb-4 border-2 ${
                isSelected
                  ? isPositive
                    ? 'bg-success/10 border-success'
                    : 'bg-error/10 border-error'
                  : 'bg-surface border-border'
              }`}
              style={{ opacity: 1 }}
            >
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center flex-1">
                  <Text className="text-4xl mr-3">{scenario.emoji}</Text>
                  <View className="flex-1">
                    <Text className="text-foreground font-bold text-base mb-1">
                      {scenario.title}
                    </Text>
                    <Text className="text-muted text-sm">{scenario.description}</Text>
                  </View>
                </View>
                <View
                  className={`px-4 py-2 rounded-full ${
                    isPositive ? 'bg-success/20' : 'bg-error/20'
                  }`}
                >
                  <Text
                    className={`font-bold ${
                      isPositive ? 'text-success' : 'text-error'
                    }`}
                  >
                    {isPositive ? '+' : ''}{scenario.impact}
                  </Text>
                </View>
              </View>

              {isSelected && (
                <View className="bg-background rounded-xl p-3 mt-2">
                  <Text className="text-muted text-xs text-center">
                    ✓ Included in simulation
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {/* Info */}
        <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30">
          <Text className="text-foreground font-semibold mb-3">ℹ️ About This Tool</Text>
          <Text className="text-muted text-sm mb-2">
            This simulator provides estimates based on typical credit scoring models. Actual
            impacts may vary based on your complete credit profile.
          </Text>
          <Text className="text-muted text-sm">
            Use this tool to understand potential consequences before making credit decisions.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
