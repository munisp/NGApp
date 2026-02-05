import { View, Text, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';

interface CreditFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  description: string;
  details: string;
  emoji: string;
}

const factors: CreditFactor[] = [
  {
    name: 'Payment History',
    impact: 'positive',
    weight: 35,
    description: 'All payments made on time',
    details:
      'Your payment history is excellent. You have consistently paid all your bills on time over the past 24 months. Continue this pattern to maintain a strong credit score.',
    emoji: '✅',
  },
  {
    name: 'Credit Utilization',
    impact: 'positive',
    weight: 30,
    description: '25% of available credit used',
    details:
      'You are using $2,500 of your $10,000 available credit (25%). This is well below the recommended 30% threshold. Keeping utilization low shows lenders you manage credit responsibly.',
    emoji: '💳',
  },
  {
    name: 'Credit History Length',
    impact: 'neutral',
    weight: 15,
    description: 'Average age of 3.5 years',
    details:
      'Your oldest account is 5 years old, and the average age of all accounts is 3.5 years. As your accounts age, this factor will improve naturally. Avoid closing old accounts.',
    emoji: '📅',
  },
  {
    name: 'Recent Credit Inquiries',
    impact: 'negative',
    weight: 10,
    description: '2 hard inquiries in last 6 months',
    details:
      'You have 2 hard inquiries from the past 6 months. Multiple inquiries in a short time can signal financial stress to lenders. Wait at least 6 months before applying for new credit.',
    emoji: '🔍',
  },
  {
    name: 'Credit Mix',
    impact: 'positive',
    weight: 10,
    description: 'Good mix of credit types',
    details:
      'You have a healthy mix of credit cards, an auto loan, and a personal loan. This diversity shows you can manage different types of credit responsibly.',
    emoji: '🎯',
  },
];

export default function CreditFactorsScreen() {
  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Credit Factors', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text className="text-muted mb-6">
          These factors determine your credit score. Understanding them helps you make better
          financial decisions.
        </Text>

        {factors.map((factor, index) => (
          <View key={index} className="bg-surface rounded-xl p-6 mb-4 border border-border">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center flex-1">
                <Text className="text-4xl mr-3">{factor.emoji}</Text>
                <View className="flex-1">
                  <Text className="text-foreground font-bold text-lg mb-1">{factor.name}</Text>
                  <Text className="text-muted text-sm">{factor.weight}% of score</Text>
                </View>
              </View>
              <View
                className={`px-4 py-2 rounded-full ${
                  factor.impact === 'positive'
                    ? 'bg-success/20'
                    : factor.impact === 'negative'
                    ? 'bg-error/20'
                    : 'bg-border/30'
                }`}
              >
                <Text
                  className={`font-semibold ${
                    factor.impact === 'positive'
                      ? 'text-success'
                      : factor.impact === 'negative'
                      ? 'text-error'
                      : 'text-muted'
                  }`}
                >
                  {factor.impact === 'positive' ? '↑ Good' : factor.impact === 'negative' ? '↓ Needs Work' : '→ Neutral'}
                </Text>
              </View>
            </View>

            {/* Current Status */}
            <View className="bg-background rounded-xl p-4 mb-4">
              <Text className="text-muted text-sm mb-1">Current Status</Text>
              <Text className="text-foreground font-semibold">{factor.description}</Text>
            </View>

            {/* Details */}
            <Text className="text-muted text-sm leading-relaxed">{factor.details}</Text>
          </View>
        ))}

        {/* Info */}
        <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30">
          <Text className="text-foreground font-semibold mb-3">📊 How It Works</Text>
          <Text className="text-muted text-sm mb-2">
            Your credit score is calculated using these five factors, each weighted differently.
            Payment history and credit utilization have the biggest impact.
          </Text>
          <Text className="text-muted text-sm">
            Focus on improving factors marked as "Needs Work" to see the fastest score improvements.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
