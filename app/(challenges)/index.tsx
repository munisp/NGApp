import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

interface Challenge {
  id: string;
  title: string;
  description: string;
  type: '52-week' | 'no-spend' | 'save-daily' | 'debt-free' | 'custom';
  targetAmount: number;
  currentAmount: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'failed';
  milestones: { week: number; amount: number; completed: boolean }[];
  badge?: string;
}

const challengeTemplates = [
  {
    type: '52-week',
    title: '52-Week Money Challenge',
    description: 'Save $1 in week 1, $2 in week 2, and so on. Save $1,378 in a year!',
    icon: '📅',
    targetAmount: 1378,
    duration: 52,
  },
  {
    type: 'no-spend',
    title: 'No-Spend Month',
    description: 'Challenge yourself to spend only on essentials for 30 days',
    icon: '🚫',
    targetAmount: 0,
    duration: 30,
  },
  {
    type: 'save-daily',
    title: 'Daily $5 Challenge',
    description: 'Save $5 every day for 100 days. Total: $500',
    icon: '💵',
    targetAmount: 500,
    duration: 100,
  },
  {
    type: 'debt-free',
    title: 'Debt Snowball',
    description: 'Pay off your smallest debt first, then roll that payment into the next',
    icon: '❄️',
    targetAmount: 0,
    duration: 365,
  },
];

export default function ChallengesScreen() {
  const router = useRouter();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  useEffect(() => {
    loadChallenges();
  }, []);

  const loadChallenges = async () => {
    try {
      const stored = await AsyncStorage.getItem('financialChallenges');
      if (stored) {
        setChallenges(JSON.parse(stored));
      } else {
        // Sample challenge
        const sampleChallenge: Challenge = {
          id: '1',
          title: '52-Week Money Challenge',
          description: 'Save $1 in week 1, $2 in week 2, and so on',
          type: '52-week',
          targetAmount: 1378,
          currentAmount: 105, // 14 weeks completed
          startDate: new Date(Date.now() - 98 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 266 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active',
          milestones: Array.from({ length: 52 }, (_, i) => ({
            week: i + 1,
            amount: i + 1,
            completed: i < 14,
          })),
          badge: '🏆',
        };
        await AsyncStorage.setItem('financialChallenges', JSON.stringify([sampleChallenge]));
        setChallenges([sampleChallenge]);
      }
    } catch (error) {
      console.error('Failed to load challenges:', error);
    }
  };

  const startChallenge = async (template: typeof challengeTemplates[0]) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + template.duration * 24 * 60 * 60 * 1000);

    let milestones: Challenge['milestones'] = [];
    if (template.type === '52-week') {
      milestones = Array.from({ length: 52 }, (_, i) => ({
        week: i + 1,
        amount: i + 1,
        completed: false,
      }));
    } else if (template.type === 'save-daily') {
      milestones = Array.from({ length: 100 }, (_, i) => ({
        week: i + 1,
        amount: 5,
        completed: false,
      }));
    }

    const newChallenge: Challenge = {
      id: Date.now().toString(),
      title: template.title,
      description: template.description,
      type: template.type as Challenge['type'],
      targetAmount: template.targetAmount,
      currentAmount: 0,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      status: 'active',
      milestones,
    };

    const updated = [...challenges, newChallenge];
    setChallenges(updated);
    await AsyncStorage.setItem('financialChallenges', JSON.stringify(updated));

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Challenge Started!',
      `You've started the ${template.title}. Good luck!`,
      [{ text: 'OK' }]
    );
  };

  const activeChallenges = challenges.filter(c => c.status === 'active');
  const completedChallenges = challenges.filter(c => c.status === 'completed');

  const displayChallenges = activeTab === 'active' ? activeChallenges : completedChallenges;

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Financial Challenges', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-foreground font-bold text-3xl mb-2">Financial Challenges</Text>
          <Text className="text-muted">Gamify your savings and achieve your goals</Text>
        </View>

        {/* Stats */}
        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-primary/10 rounded-xl p-5 border border-primary/30">
            <Text className="text-primary text-sm mb-1">Active</Text>
            <Text className="text-foreground font-bold text-3xl">{activeChallenges.length}</Text>
          </View>
          <View className="flex-1 bg-success/10 rounded-xl p-5 border border-success/30">
            <Text className="text-success text-sm mb-1">Completed</Text>
            <Text className="text-foreground font-bold text-3xl">{completedChallenges.length}</Text>
          </View>
          <View className="flex-1 bg-warning/10 rounded-xl p-5 border border-warning/30">
            <Text className="text-warning text-sm mb-1">Total Saved</Text>
            <Text className="text-foreground font-bold text-2xl">
              ${challenges.reduce((sum, c) => sum + c.currentAmount, 0).toFixed(0)}
            </Text>
          </View>
        </View>

        {/* Tabs */}
        <View className="flex-row bg-surface rounded-xl p-1 mb-6">
          <TouchableOpacity
            onPress={() => {
              setActiveTab('active');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            className={`flex-1 rounded-lg py-3 ${
              activeTab === 'active' ? 'bg-primary' : 'bg-transparent'
            }`}
            style={{ opacity: 1 }}
          >
            <Text
              className={`text-center font-semibold ${
                activeTab === 'active' ? 'text-white' : 'text-muted'
              }`}
            >
              Active ({activeChallenges.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setActiveTab('completed');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            className={`flex-1 rounded-lg py-3 ${
              activeTab === 'completed' ? 'bg-primary' : 'bg-transparent'
            }`}
            style={{ opacity: 1 }}
          >
            <Text
              className={`text-center font-semibold ${
                activeTab === 'completed' ? 'text-white' : 'text-muted'
              }`}
            >
              Completed ({completedChallenges.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Active/Completed Challenges */}
        {displayChallenges.length > 0 ? (
          <View className="gap-4 mb-6">
            {displayChallenges.map(challenge => {
              const progress = (challenge.currentAmount / challenge.targetAmount) * 100;
              const daysRemaining = Math.ceil(
                (new Date(challenge.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              );

              return (
                <TouchableOpacity
                  key={challenge.id}
                  onPress={() => router.push(`/(challenges)/${challenge.id}` as any)}
                  className="bg-surface rounded-xl p-6 border border-border"
                  style={{ opacity: 1 }}
                >
                  <View className="flex-row items-start justify-between mb-4">
                    <View className="flex-1">
                      <Text className="text-foreground font-bold text-xl mb-1">
                        {challenge.title}
                      </Text>
                      <Text className="text-muted">{challenge.description}</Text>
                    </View>
                    {challenge.badge && (
                      <Text className="text-4xl ml-3">{challenge.badge}</Text>
                    )}
                  </View>

                  {/* Progress */}
                  <View className="mb-4">
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-muted text-sm">Progress</Text>
                      <Text className="text-primary font-bold">
                        ${challenge.currentAmount} / ${challenge.targetAmount}
                      </Text>
                    </View>
                    <View className="bg-muted/20 h-3 rounded-full overflow-hidden">
                      <View
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </View>
                  </View>

                  {/* Footer */}
                  <View className="flex-row justify-between items-center pt-4 border-t border-border">
                    {challenge.status === 'active' ? (
                      <>
                        <Text className="text-muted text-sm">
                          {daysRemaining > 0 ? `${daysRemaining} days left` : 'Ending soon'}
                        </Text>
                        <View className="bg-primary/10 px-4 py-2 rounded-full">
                          <Text className="text-primary font-semibold text-sm">
                            {Math.round(progress)}% Complete
                          </Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <Text className="text-success font-semibold">✓ Completed</Text>
                        <Text className="text-muted text-sm">
                          {new Date(challenge.endDate).toLocaleDateString()}
                        </Text>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View className="bg-surface rounded-xl p-8 mb-6 items-center">
            <Text className="text-6xl mb-4">🎯</Text>
            <Text className="text-foreground font-bold text-xl mb-2">
              No {activeTab} challenges
            </Text>
            <Text className="text-muted text-center">
              {activeTab === 'active'
                ? 'Start a new challenge below to begin your savings journey'
                : 'Complete challenges to see them here'}
            </Text>
          </View>
        )}

        {/* Challenge Templates */}
        {activeTab === 'active' && (
          <View>
            <Text className="text-foreground font-bold text-2xl mb-4">Start a New Challenge</Text>
            <View className="gap-4">
              {challengeTemplates.map(template => (
                <TouchableOpacity
                  key={template.type}
                  onPress={() => startChallenge(template)}
                  className="bg-surface rounded-xl p-6 border border-border"
                  style={{ opacity: 1 }}
                >
                  <View className="flex-row items-start gap-4">
                    <Text className="text-5xl">{template.icon}</Text>
                    <View className="flex-1">
                      <Text className="text-foreground font-bold text-lg mb-1">
                        {template.title}
                      </Text>
                      <Text className="text-muted mb-3">{template.description}</Text>
                      <View className="flex-row items-center gap-4">
                        <View className="bg-primary/10 px-3 py-1 rounded-full">
                          <Text className="text-primary font-semibold text-sm">
                            {template.duration} days
                          </Text>
                        </View>
                        {template.targetAmount > 0 && (
                          <View className="bg-success/10 px-3 py-1 rounded-full">
                            <Text className="text-success font-semibold text-sm">
                              Save ${template.targetAmount}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Motivation */}
        <View className="mt-6 bg-primary/10 rounded-xl p-6 border border-primary/30">
          <Text className="text-foreground font-bold text-lg mb-3">💪 Stay Motivated</Text>
          <Text className="text-foreground leading-relaxed">
            Financial challenges make saving fun and achievable. Track your progress, earn badges, and compete with friends to reach your goals faster!
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
