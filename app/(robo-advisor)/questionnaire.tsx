import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Question {
  id: string;
  question: string;
  options: { label: string; value: number }[];
}

const questions: Question[] = [
  {
    id: 'age',
    question: 'What is your age group?',
    options: [
      { label: 'Under 30', value: 5 },
      { label: '30-40', value: 4 },
      { label: '40-50', value: 3 },
      { label: '50-60', value: 2 },
      { label: 'Over 60', value: 1 },
    ],
  },
  {
    id: 'investment_horizon',
    question: 'How long do you plan to invest?',
    options: [
      { label: 'Less than 1 year', value: 1 },
      { label: '1-3 years', value: 2 },
      { label: '3-5 years', value: 3 },
      { label: '5-10 years', value: 4 },
      { label: 'More than 10 years', value: 5 },
    ],
  },
  {
    id: 'risk_comfort',
    question: 'If your portfolio dropped 20% in value, what would you do?',
    options: [
      { label: 'Sell everything immediately', value: 1 },
      { label: 'Sell some investments', value: 2 },
      { label: 'Hold and wait', value: 3 },
      { label: 'Buy more at lower prices', value: 4 },
      { label: 'Invest significantly more', value: 5 },
    ],
  },
  {
    id: 'investment_goal',
    question: 'What is your primary investment goal?',
    options: [
      { label: 'Preserve capital', value: 1 },
      { label: 'Generate income', value: 2 },
      { label: 'Balanced growth', value: 3 },
      { label: 'Aggressive growth', value: 4 },
      { label: 'Maximum returns', value: 5 },
    ],
  },
  {
    id: 'investment_knowledge',
    question: 'How would you rate your investment knowledge?',
    options: [
      { label: 'Beginner', value: 1 },
      { label: 'Some knowledge', value: 2 },
      { label: 'Intermediate', value: 3 },
      { label: 'Advanced', value: 4 },
      { label: 'Expert', value: 5 },
    ],
  },
  {
    id: 'income_stability',
    question: 'How stable is your income?',
    options: [
      { label: 'Very unstable', value: 1 },
      { label: 'Somewhat unstable', value: 2 },
      { label: 'Moderately stable', value: 3 },
      { label: 'Stable', value: 4 },
      { label: 'Very stable', value: 5 },
    ],
  },
];

export default function RoboAdvisorQuestionnaireScreen() {
  const router = useRouter();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const handleAnswer = async (value: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const newAnswers = {
      ...answers,
      [questions[currentQuestion].id]: value,
    };
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Calculate risk profile and generate recommendations
      await calculateRiskProfile(newAnswers);
    }
  };

  const calculateRiskProfile = async (finalAnswers: Record<string, number>) => {
    const totalScore = Object.values(finalAnswers).reduce((sum, val) => sum + val, 0);
    const maxScore = questions.length * 5;
    const riskScore = (totalScore / maxScore) * 100;

    let riskProfile: string;
    let allocation: { stocks: number; bonds: number; cash: number };

    if (riskScore >= 80) {
      riskProfile = 'Aggressive';
      allocation = { stocks: 90, bonds: 8, cash: 2 };
    } else if (riskScore >= 60) {
      riskProfile = 'Growth';
      allocation = { stocks: 70, bonds: 25, cash: 5 };
    } else if (riskScore >= 40) {
      riskProfile = 'Balanced';
      allocation = { stocks: 50, bonds: 40, cash: 10 };
    } else if (riskScore >= 20) {
      riskProfile = 'Conservative';
      allocation = { stocks: 30, bonds: 60, cash: 10 };
    } else {
      riskProfile = 'Very Conservative';
      allocation = { stocks: 10, bonds: 70, cash: 20 };
    }

    const recommendation = {
      riskProfile,
      riskScore,
      allocation,
      answers: finalAnswers,
      createdAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem('roboAdvisorRecommendation', JSON.stringify(recommendation));
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    router.replace('/(robo-advisor)/recommendation' as any);
  };

  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Investment Profile', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Progress */}
        <View className="mb-8">
          <View className="flex-row justify-between mb-2">
            <Text className="text-muted text-sm">
              Question {currentQuestion + 1} of {questions.length}
            </Text>
            <Text className="text-primary font-semibold text-sm">{Math.round(progress)}%</Text>
          </View>
          <View className="bg-muted/20 h-2 rounded-full overflow-hidden">
            <View
              className="bg-primary h-full rounded-full"
              style={{ width: `${progress}%` }}
            />
          </View>
        </View>

        {/* Question */}
        <View className="mb-8">
          <Text className="text-foreground font-bold text-2xl mb-2">
            {questions[currentQuestion].question}
          </Text>
          <Text className="text-muted">
            Select the option that best describes your situation
          </Text>
        </View>

        {/* Options */}
        <View className="gap-3">
          {questions[currentQuestion].options.map((option, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleAnswer(option.value)}
              className="bg-surface border border-border rounded-xl p-5"
              style={{ opacity: 1 }}
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-foreground font-semibold text-lg flex-1">
                  {option.label}
                </Text>
                <View className="w-6 h-6 rounded-full border-2 border-primary" />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Back Button */}
        {currentQuestion > 0 && (
          <TouchableOpacity
            onPress={() => {
              setCurrentQuestion(currentQuestion - 1);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            className="mt-6 bg-surface border border-border rounded-xl p-4"
            style={{ opacity: 1 }}
          >
            <Text className="text-foreground font-semibold text-center">← Previous Question</Text>
          </TouchableOpacity>
        )}

        {/* Info */}
        <View className="mt-8 bg-primary/10 rounded-xl p-5 border border-primary/30">
          <Text className="text-foreground font-bold mb-2">💡 About This Assessment</Text>
          <Text className="text-foreground leading-relaxed">
            This questionnaire helps us understand your investment goals, risk tolerance, and time horizon to provide personalized portfolio recommendations.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
