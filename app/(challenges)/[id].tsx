import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

interface Challenge {
  id: string;
  title: string;
  description: string;
  type: string;
  targetAmount: number;
  currentAmount: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'failed';
  milestones: { week: number; amount: number; completed: boolean }[];
  badge?: string;
}

export default function ChallengeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [addAmount, setAddAmount] = useState('');

  useEffect(() => {
    loadChallenge();
  }, [id]);

  const loadChallenge = async () => {
    try {
      const stored = await AsyncStorage.getItem('financialChallenges');
      if (stored) {
        const challenges: Challenge[] = JSON.parse(stored);
        const found = challenges.find(c => c.id === id);
        if (found) setChallenge(found);
      }
    } catch (error) {
      console.error('Failed to load challenge:', error);
    }
  };

  const handleAddProgress = async () => {
    if (!challenge || !addAmount || parseFloat(addAmount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const amount = parseFloat(addAmount);
      const newAmount = challenge.currentAmount + amount;

      // Check if challenge is completed
      const isCompleted = newAmount >= challenge.targetAmount;

      const updatedChallenge: Challenge = {
        ...challenge,
        currentAmount: newAmount,
        status: isCompleted ? 'completed' : challenge.status,
      };

      // Update milestones if applicable
      if (challenge.milestones.length > 0) {
        const completedMilestones = Math.floor(newAmount);
        updatedChallenge.milestones = challenge.milestones.map((m, i) => ({
          ...m,
          completed: i < completedMilestones,
        }));
      }

      // Save to storage
      const stored = await AsyncStorage.getItem('financialChallenges');
      if (stored) {
        const challenges: Challenge[] = JSON.parse(stored);
        const updated = challenges.map(c => (c.id === id ? updatedChallenge : c));
        await AsyncStorage.setItem('financialChallenges', JSON.stringify(updated));
        setChallenge(updatedChallenge);
      }

      setAddAmount('');

      if (isCompleted) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          '🎉 Challenge Completed!',
          `Congratulations! You've completed the ${challenge.title}!`,
          [{ text: 'Awesome!' }]
        );
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Failed to add progress:', error);
      Alert.alert('Error', 'Failed to update progress');
    }
  };

  const handleAbandon = async () => {
    if (!challenge) return;

    Alert.alert(
      'Abandon Challenge',
      'Are you sure you want to abandon this challenge? Your progress will be saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Abandon',
          style: 'destructive',
          onPress: async () => {
            try {
              const stored = await AsyncStorage.getItem('financialChallenges');
              if (stored) {
                const challenges: Challenge[] = JSON.parse(stored);
                const updated = challenges.map(c =>
                  c.id === id ? { ...c, status: 'failed' as const } : c
                );
                await AsyncStorage.setItem('financialChallenges', JSON.stringify(updated));
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                router.back();
              }
            } catch (error) {
              console.error('Failed to abandon challenge:', error);
            }
          },
        },
      ]
    );
  };

  if (!challenge) {
    return (
      <ScreenContainer className="p-4">
        <Stack.Screen options={{ title: 'Challenge', headerShown: true }} />
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted">Loading challenge...</Text>
        </View>
      </ScreenContainer>
    );
  }

  const progress = (challenge.currentAmount / challenge.targetAmount) * 100;
  const daysRemaining = Math.ceil(
    (new Date(challenge.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const completedMilestones = challenge.milestones.filter(m => m.completed).length;

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: challenge.title, headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="items-center mb-6">
          {challenge.badge && <Text className="text-8xl mb-4">{challenge.badge}</Text>}
          <Text className="text-foreground font-bold text-3xl text-center mb-2">
            {challenge.title}
          </Text>
          <Text className="text-muted text-center">{challenge.description}</Text>
        </View>

        {/* Progress Card */}
        <View className="bg-primary rounded-2xl p-8 mb-6">
          <View className="items-center mb-6">
            <Text className="text-white/80 text-lg mb-2">Current Progress</Text>
            <Text className="text-white font-bold text-6xl mb-2">
              {Math.round(progress)}%
            </Text>
            <Text className="text-white/80 text-xl">
              ${challenge.currentAmount.toFixed(2)} / ${challenge.targetAmount.toFixed(2)}
            </Text>
          </View>

          <View className="bg-white/30 h-4 rounded-full overflow-hidden">
            <View
              className="bg-white h-full rounded-full"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </View>
        </View>

        {/* Stats */}
        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-surface rounded-xl p-5 border border-border">
            <Text className="text-muted text-sm mb-1">Days Left</Text>
            <Text className="text-foreground font-bold text-3xl">
              {daysRemaining > 0 ? daysRemaining : 0}
            </Text>
          </View>
          <View className="flex-1 bg-surface rounded-xl p-5 border border-border">
            <Text className="text-muted text-sm mb-1">Milestones</Text>
            <Text className="text-foreground font-bold text-3xl">
              {completedMilestones}/{challenge.milestones.length}
            </Text>
          </View>
          <View className="flex-1 bg-surface rounded-xl p-5 border border-border">
            <Text className="text-muted text-sm mb-1">Remaining</Text>
            <Text className="text-foreground font-bold text-2xl">
              ${(challenge.targetAmount - challenge.currentAmount).toFixed(0)}
            </Text>
          </View>
        </View>

        {/* Add Progress */}
        {challenge.status === 'active' && (
          <View className="mb-6">
            <Text className="text-foreground font-bold text-xl mb-4">Add Progress</Text>
            <View className="flex-row gap-3">
              <View className="flex-1 flex-row items-center bg-surface border border-border rounded-xl px-4">
                <Text className="text-muted text-2xl mr-2">$</Text>
                <TextInput
                  value={addAmount}
                  onChangeText={setAddAmount}
                  placeholder="0.00"
                  placeholderTextColor="#9BA1A6"
                  keyboardType="decimal-pad"
                  className="flex-1 py-4 text-foreground text-2xl font-bold"
                />
              </View>
              <TouchableOpacity
                onPress={handleAddProgress}
                className="bg-primary rounded-xl px-8 justify-center"
                style={{ opacity: 1 }}
              >
                <Text className="text-white font-bold text-lg">Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Milestones */}
        {challenge.milestones.length > 0 && (
          <View className="mb-6">
            <Text className="text-foreground font-bold text-xl mb-4">Milestones</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-3">
                {challenge.milestones.slice(0, 20).map((milestone, index) => (
                  <View
                    key={index}
                    className={`w-20 h-20 rounded-xl items-center justify-center border ${
                      milestone.completed
                        ? 'bg-success border-success'
                        : 'bg-surface border-border'
                    }`}
                  >
                    <Text
                      className={`font-bold text-xl ${
                        milestone.completed ? 'text-white' : 'text-muted'
                      }`}
                    >
                      {milestone.completed ? '✓' : milestone.week}
                    </Text>
                    <Text
                      className={`text-xs ${
                        milestone.completed ? 'text-white/80' : 'text-muted'
                      }`}
                    >
                      ${milestone.amount}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
            {challenge.milestones.length > 20 && (
              <Text className="text-muted text-sm mt-3">
                Showing first 20 of {challenge.milestones.length} milestones
              </Text>
            )}
          </View>
        )}

        {/* Timeline */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-4">Timeline</Text>
          <View className="gap-3">
            <View className="flex-row justify-between">
              <Text className="text-muted">Started</Text>
              <Text className="text-foreground font-semibold">
                {new Date(challenge.startDate).toLocaleDateString()}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-muted">End Date</Text>
              <Text className="text-foreground font-semibold">
                {new Date(challenge.endDate).toLocaleDateString()}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-muted">Status</Text>
              <View
                className={`px-3 py-1 rounded-full ${
                  challenge.status === 'active'
                    ? 'bg-primary/20'
                    : challenge.status === 'completed'
                    ? 'bg-success/20'
                    : 'bg-error/20'
                }`}
              >
                <Text
                  className={`font-semibold text-sm ${
                    challenge.status === 'active'
                      ? 'text-primary'
                      : challenge.status === 'completed'
                      ? 'text-success'
                      : 'text-error'
                  }`}
                >
                  {challenge.status.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        {challenge.status === 'active' && (
          <View className="gap-3">
            <TouchableOpacity
              onPress={handleAbandon}
              className="bg-error/10 border border-error/30 rounded-xl p-5"
              style={{ opacity: 1 }}
            >
              <Text className="text-error font-semibold text-center">Abandon Challenge</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Motivation */}
        {challenge.status === 'active' && (
          <View className="mt-6 bg-primary/10 rounded-xl p-6 border border-primary/30">
            <Text className="text-foreground font-bold text-lg mb-3">💪 Keep Going!</Text>
            <Text className="text-foreground leading-relaxed">
              You're {Math.round(progress)}% of the way there! Every dollar saved brings you closer to your goal. Stay consistent and you'll achieve it!
            </Text>
          </View>
        )}

        {challenge.status === 'completed' && (
          <View className="mt-6 bg-success/10 rounded-xl p-6 border border-success/30">
            <Text className="text-foreground font-bold text-lg mb-3">🎉 Congratulations!</Text>
            <Text className="text-foreground leading-relaxed">
              You've successfully completed this challenge! You saved ${challenge.currentAmount.toFixed(2)}. Ready for the next challenge?
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
