import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

interface FinancialGoal {
  id: string;
  name: string;
  category: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  monthlyContribution: number;
  emoji: string;
}

const GOALS_KEY = 'financialGoals';

export default function GoalDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const goalId = params.id as string;

  const [goal, setGoal] = useState<FinancialGoal | null>(null);
  const [addAmount, setAddAmount] = useState('');

  useEffect(() => {
    loadGoal();
  }, [goalId]);

  const loadGoal = async () => {
    try {
      const stored = await AsyncStorage.getItem(GOALS_KEY);
      if (stored) {
        const goals: FinancialGoal[] = JSON.parse(stored);
        const found = goals.find(g => g.id === goalId);
        if (found) {
          setGoal(found);
        }
      }
    } catch (error) {
      console.error('Failed to load goal:', error);
    }
  };

  const handleAddFunds = async () => {
    const amount = parseFloat(addAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    if (!goal) return;

    try {
      const stored = await AsyncStorage.getItem(GOALS_KEY);
      if (stored) {
        const goals: FinancialGoal[] = JSON.parse(stored);
        const index = goals.findIndex(g => g.id === goalId);

        if (index !== -1) {
          goals[index].currentAmount += amount;
          await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(goals));

          const isCompleted = goals[index].currentAmount >= goals[index].targetAmount;

          if (isCompleted) {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
              '🎉 Goal Completed!',
              `Congratulations! You've reached your ${goal.name} goal!`,
              [{ text: 'Awesome!', onPress: () => router.back() }]
            );
          } else {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setGoal(goals[index]);
            setAddAmount('');
            Alert.alert('Funds Added', `$${amount.toFixed(2)} added to your goal`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to add funds:', error);
      Alert.alert('Error', 'Failed to add funds');
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Goal', 'Are you sure you want to delete this goal?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const stored = await AsyncStorage.getItem(GOALS_KEY);
            if (stored) {
              const goals: FinancialGoal[] = JSON.parse(stored);
              const filtered = goals.filter(g => g.id !== goalId);
              await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(filtered));
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            }
          } catch (error) {
            console.error('Failed to delete goal:', error);
            Alert.alert('Error', 'Failed to delete goal');
          }
        },
      },
    ]);
  };

  if (!goal) {
    return (
      <ScreenContainer className="p-4">
        <Stack.Screen options={{ title: 'Goal Details', headerShown: true }} />
        <View className="flex-1 justify-center items-center">
          <Text className="text-muted">Goal not found</Text>
        </View>
      </ScreenContainer>
    );
  }

  const progress = (goal.currentAmount / goal.targetAmount) * 100;
  const remaining = goal.targetAmount - goal.currentAmount;
  const monthsLeft = Math.max(
    0,
    Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / (30 * 86400000))
  );
  const isCompleted = progress >= 100;

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: goal.name, headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Goal Header */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border items-center">
          <Text className="text-8xl mb-4">{goal.emoji}</Text>
          <Text className="text-foreground font-bold text-3xl mb-2">{goal.name}</Text>
          <Text className="text-muted capitalize mb-6">{goal.category}</Text>

          {isCompleted ? (
            <View className="bg-success/20 rounded-xl p-6 items-center">
              <Text className="text-6xl mb-3">🎉</Text>
              <Text className="text-success font-bold text-2xl mb-2">Goal Completed!</Text>
              <Text className="text-foreground text-center">
                You've successfully saved ${goal.currentAmount.toFixed(2)}
              </Text>
            </View>
          ) : (
            <>
              <Text className="text-primary font-bold text-6xl mb-4">
                {progress.toFixed(0)}%
              </Text>
              <Text className="text-muted mb-6">
                ${goal.currentAmount.toFixed(2)} of ${goal.targetAmount.toFixed(2)}
              </Text>
              <View className="w-full h-4 bg-border/30 rounded-full overflow-hidden mb-6">
                <View
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </View>
            </>
          )}
        </View>

        {!isCompleted && (
          <>
            {/* Add Funds */}
            <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
              <Text className="text-foreground font-bold text-lg mb-4">Add Funds</Text>
              <View className="flex-row items-center bg-background border border-border rounded-xl p-4 mb-4">
                <Text className="text-foreground text-2xl mr-2">$</Text>
                <TextInput
                  className="flex-1 text-foreground text-2xl font-bold"
                  placeholder="0.00"
                  placeholderTextColor="#9BA1A6"
                  keyboardType="decimal-pad"
                  value={addAmount}
                  onChangeText={setAddAmount}
                />
              </View>
              <TouchableOpacity
                onPress={handleAddFunds}
                className="bg-primary rounded-xl p-4"
                style={{ opacity: 1 }}
              >
                <Text className="text-white text-center font-semibold text-lg">Add Funds</Text>
              </TouchableOpacity>
            </View>

            {/* Goal Stats */}
            <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
              <Text className="text-foreground font-bold text-lg mb-4">Goal Stats</Text>

              <View className="flex-row justify-between mb-4 pb-4 border-b border-border">
                <Text className="text-muted">Remaining</Text>
                <Text className="text-foreground font-semibold">${remaining.toFixed(2)}</Text>
              </View>

              <View className="flex-row justify-between mb-4 pb-4 border-b border-border">
                <Text className="text-muted">Monthly Contribution</Text>
                <Text className="text-foreground font-semibold">
                  ${goal.monthlyContribution.toFixed(2)}
                </Text>
              </View>

              <View className="flex-row justify-between mb-4 pb-4 border-b border-border">
                <Text className="text-muted">Time Remaining</Text>
                <Text className="text-foreground font-semibold">
                  {monthsLeft} {monthsLeft === 1 ? 'month' : 'months'}
                </Text>
              </View>

              <View className="flex-row justify-between">
                <Text className="text-muted">Deadline</Text>
                <Text className="text-foreground font-semibold">
                  {new Date(goal.deadline).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            </View>

            {/* Projection */}
            <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30">
              <Text className="text-foreground font-bold text-lg mb-4">📊 Projection</Text>
              <Text className="text-muted text-sm mb-2">
                At your current monthly contribution of ${goal.monthlyContribution.toFixed(2)}, you
                will reach your goal in approximately{' '}
                <Text className="text-primary font-semibold">
                  {Math.ceil(remaining / goal.monthlyContribution)} months
                </Text>
                .
              </Text>
              {monthsLeft < Math.ceil(remaining / goal.monthlyContribution) && (
                <Text className="text-warning text-sm mt-2">
                  ⚠️ You may need to increase your monthly contribution to meet your deadline.
                </Text>
              )}
            </View>
          </>
        )}

        {/* Delete Button */}
        <TouchableOpacity
          onPress={handleDelete}
          className="bg-error/10 border border-error/30 rounded-xl p-4 mb-6"
          style={{ opacity: 1 }}
        >
          <Text className="text-error text-center font-semibold text-lg">Delete Goal</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
