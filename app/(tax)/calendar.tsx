import { View, Text, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';

interface TaxDeadline {
  date: string;
  title: string;
  description: string;
  type: 'quarterly' | 'annual' | 'other';
}

const taxDeadlines2024: TaxDeadline[] = [
  {
    date: '2024-04-15',
    title: 'Q1 Estimated Tax Payment',
    description: 'First quarterly estimated tax payment for 2024',
    type: 'quarterly',
  },
  {
    date: '2024-04-15',
    title: 'Tax Filing Deadline',
    description: 'Deadline to file 2023 tax return or request extension',
    type: 'annual',
  },
  {
    date: '2024-06-17',
    title: 'Q2 Estimated Tax Payment',
    description: 'Second quarterly estimated tax payment for 2024',
    type: 'quarterly',
  },
  {
    date: '2024-09-16',
    title: 'Q3 Estimated Tax Payment',
    description: 'Third quarterly estimated tax payment for 2024',
    type: 'quarterly',
  },
  {
    date: '2024-10-15',
    title: 'Extension Deadline',
    description: 'Deadline to file if you requested an extension in April',
    type: 'annual',
  },
  {
    date: '2025-01-15',
    title: 'Q4 Estimated Tax Payment',
    description: 'Fourth quarterly estimated tax payment for 2024',
    type: 'quarterly',
  },
];

export default function TaxCalendarScreen() {
  const today = new Date();

  const getDeadlineStatus = (dateStr: string): 'upcoming' | 'past' | 'soon' => {
    const deadline = new Date(dateStr);
    const daysUntil = Math.floor((deadline.getTime() - today.getTime()) / 86400000);

    if (daysUntil < 0) return 'past';
    if (daysUntil <= 30) return 'soon';
    return 'upcoming';
  };

  const getDaysUntil = (dateStr: string): number => {
    const deadline = new Date(dateStr);
    return Math.floor((deadline.getTime() - today.getTime()) / 86400000);
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Tax Calendar', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text className="text-muted mb-6">
          Important tax deadlines for 2024. Set reminders to avoid penalties and interest.
        </Text>

        {taxDeadlines2024.map((deadline, index) => {
          const status = getDeadlineStatus(deadline.date);
          const daysUntil = getDaysUntil(deadline.date);

          return (
            <View
              key={index}
              className={`rounded-xl p-6 mb-4 border-2 ${
                status === 'soon'
                  ? 'bg-warning/10 border-warning'
                  : status === 'past'
                  ? 'bg-border/30 border-border opacity-50'
                  : 'bg-surface border-border'
              }`}
            >
              {/* Date Badge */}
              <View className="flex-row items-center justify-between mb-4">
                <View
                  className={`px-4 py-2 rounded-full ${
                    status === 'soon'
                      ? 'bg-warning/20'
                      : status === 'past'
                      ? 'bg-border/30'
                      : 'bg-primary/20'
                  }`}
                >
                  <Text
                    className={`font-semibold ${
                      status === 'soon'
                        ? 'text-warning'
                        : status === 'past'
                        ? 'text-muted'
                        : 'text-primary'
                    }`}
                  >
                    {new Date(deadline.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </View>

                <View
                  className={`px-3 py-1 rounded-full ${
                    deadline.type === 'quarterly'
                      ? 'bg-primary/20'
                      : deadline.type === 'annual'
                      ? 'bg-success/20'
                      : 'bg-border/30'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold capitalize ${
                      deadline.type === 'quarterly'
                        ? 'text-primary'
                        : deadline.type === 'annual'
                        ? 'text-success'
                        : 'text-muted'
                    }`}
                  >
                    {deadline.type}
                  </Text>
                </View>
              </View>

              {/* Title */}
              <Text className="text-foreground font-bold text-lg mb-2">{deadline.title}</Text>

              {/* Description */}
              <Text className="text-muted text-sm mb-3">{deadline.description}</Text>

              {/* Days Until */}
              {status !== 'past' && (
                <View className="bg-background rounded-xl p-3">
                  <Text className={`text-sm font-semibold ${status === 'soon' ? 'text-warning' : 'text-foreground'}`}>
                    {daysUntil === 0
                      ? '📅 Today!'
                      : daysUntil === 1
                      ? '⏰ Tomorrow'
                      : `⏳ ${daysUntil} days remaining`}
                  </Text>
                </View>
              )}

              {status === 'past' && (
                <View className="bg-background rounded-xl p-3">
                  <Text className="text-muted text-sm">✓ Deadline passed</Text>
                </View>
              )}
            </View>
          );
        })}

        {/* Info */}
        <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30">
          <Text className="text-foreground font-semibold mb-3">💡 Tax Tips</Text>
          <Text className="text-muted text-sm mb-2">
            • Quarterly payments are due for self-employed individuals and those with significant
            non-wage income
          </Text>
          <Text className="text-muted text-sm mb-2">
            • Missing a deadline can result in penalties and interest charges
          </Text>
          <Text className="text-muted text-sm">
            • Consider setting calendar reminders 2 weeks before each deadline
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
