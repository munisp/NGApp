import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  category: string;
  deadline?: string;
  autoTransferAmount?: number;
  autoTransferFrequency?: string;
  createdAt: string;
}

const SAVINGS_GOALS_KEY = 'savingsGoals';

const categoryIcons: Record<string, string> = {
  emergency: '🚨',
  vacation: '✈️',
  purchase: '🛍️',
  education: '🎓',
  other: '💰',
};

export default function SavingsGoalDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const goalId = params.id as string;

  const [goal, setGoal] = useState<SavingsGoal | null>(null);
  const [addAmount, setAddAmount] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    loadGoal();
  }, [goalId]);

  const loadGoal = async () => {
    try {
      const stored = await AsyncStorage.getItem(SAVINGS_GOALS_KEY);
      if (stored) {
        const goals = JSON.parse(stored);
        const found = goals.find((g: SavingsGoal) => g.id === goalId);
        if (found) {
          setGoal(found);
        }
      }
    } catch (error) {
      console.error('Failed to load goal:', error);
    }
  };

  const handleAddFunds = async () => {
    if (!goal || !addAmount || parseFloat(addAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      setIsAdding(true);

      const amount = parseFloat(addAmount);
      const newAmount = goal.currentAmount + amount;
      const wasCompleted = goal.currentAmount >= goal.targetAmount;
      const isNowCompleted = newAmount >= goal.targetAmount;

      // Update goal
      const stored = await AsyncStorage.getItem(SAVINGS_GOALS_KEY);
      if (stored) {
        const goals = JSON.parse(stored);
        const updatedGoals = goals.map((g: SavingsGoal) =>
          g.id === goalId ? { ...g, currentAmount: newAmount } : g
        );
        await AsyncStorage.setItem(SAVINGS_GOALS_KEY, JSON.stringify(updatedGoals));
      }

      // Trigger haptic feedback
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Show completion celebration if goal is reached
      if (!wasCompleted && isNowCompleted) {
        Alert.alert(
          '🎉 Goal Completed!',
          `Congratulations! You've reached your ${goal.name} goal of $${goal.targetAmount.toFixed(2)}!`,
          [
            {
              text: 'Celebrate',
              onPress: () => {
                loadGoal();
                setAddAmount('');
              },
            },
          ]
        );
      } else {
        Alert.alert('Success', `$${amount.toFixed(2)} added to your goal`, [
          {
            text: 'OK',
            onPress: () => {
              loadGoal();
              setAddAmount('');
            },
          },
        ]);
      }
    } catch (error) {
      console.error('Failed to add funds:', error);
      Alert.alert('Error', 'Failed to add funds. Please try again.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteGoal = async () => {
    Alert.alert(
      'Delete Goal',
      'Are you sure you want to delete this savings goal? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const stored = await AsyncStorage.getItem(SAVINGS_GOALS_KEY);
              if (stored) {
                const goals = JSON.parse(stored);
                const updatedGoals = goals.filter((g: SavingsGoal) => g.id !== goalId);
                await AsyncStorage.setItem(SAVINGS_GOALS_KEY, JSON.stringify(updatedGoals));
              }
              router.back();
            } catch (error) {
              console.error('Failed to delete goal:', error);
              Alert.alert('Error', 'Failed to delete goal. Please try again.');
            }
          },
        },
      ]
    );
  };

  if (!goal) {
    return (
      <ScreenContainer className="p-4 justify-center items-center">
        <Text className="text-foreground">Loading...</Text>
      </ScreenContainer>
    );
  }

  const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
  const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
  const isCompleted = goal.currentAmount >= goal.targetAmount;

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: goal.name, headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Goal Header */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border items-center">
          <Text className="text-6xl mb-4">{categoryIcons[goal.category] || '💰'}</Text>
          <Text className="text-foreground font-bold text-2xl mb-2">{goal.name}</Text>
          <Text className="text-muted text-center mb-4">
            {goal.category.charAt(0).toUpperCase() + goal.category.slice(1)} Goal
          </Text>

          {isCompleted && (
            <View className="bg-success/20 rounded-xl px-4 py-2 mb-4">
              <Text className="text-success font-bold">✓ Goal Completed!</Text>
            </View>
          )}

          <Text className="text-primary font-bold text-5xl mb-2">
            ${goal.currentAmount.toFixed(2)}
          </Text>
          <Text className="text-muted text-lg">
            of ${goal.targetAmount.toFixed(2)}
          </Text>
        </View>

        {/* Progress */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-foreground font-semibold text-lg">Progress</Text>
            <Text className="text-primary font-bold text-2xl">{progress.toFixed(0)}%</Text>
          </View>

          <View className="bg-border rounded-full h-4 mb-4 overflow-hidden">
            <View
              className="bg-primary h-full rounded-full"
              style={{ width: `${progress}%` }}
            />
          </View>

          <View className="flex-row justify-between">
            <View>
              <Text className="text-muted text-sm mb-1">Remaining</Text>
              <Text className="text-foreground font-semibold text-lg">
                ${remaining.toFixed(2)}
              </Text>
            </View>
            {goal.deadline && (
              <View>
                <Text className="text-muted text-sm mb-1">Deadline</Text>
                <Text className="text-foreground font-semibold text-lg">
                  {new Date(goal.deadline).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Auto Transfer Info */}
        {goal.autoTransferAmount && (
          <View className="bg-primary/10 rounded-xl p-4 mb-6 border border-primary/30">
            <Text className="text-foreground font-semibold mb-2">Automatic Transfers</Text>
            <Text className="text-foreground text-lg">
              ${goal.autoTransferAmount.toFixed(2)} {goal.autoTransferFrequency}
            </Text>
            <Text className="text-muted text-sm mt-1">
              Funds are automatically transferred to this goal
            </Text>
          </View>
        )}

        {/* Add Funds */}
        {!isCompleted && (
          <View className="mb-6">
            <Text className="text-foreground font-semibold mb-2">Add Funds</Text>
            <View className="bg-surface border border-border rounded-xl px-4 py-3 flex-row items-center mb-3">
              <Text className="text-foreground text-2xl font-bold mr-2">$</Text>
              <TextInput
                value={addAmount}
                onChangeText={setAddAmount}
                placeholder="0.00"
                keyboardType="decimal-pad"
                placeholderTextColor="#9BA1A6"
                className="flex-1 text-foreground text-2xl font-bold"
              />
            </View>

            <TouchableOpacity
              onPress={handleAddFunds}
              disabled={isAdding}
              className="bg-primary rounded-xl p-4"
              style={{ opacity: isAdding ? 0.6 : 1 }}
            >
              <Text className="text-white text-center font-semibold text-lg">
                {isAdding ? 'Adding...' : 'Add to Goal'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Delete Goal */}
        <TouchableOpacity
          onPress={handleDeleteGoal}
          className="bg-error/20 rounded-xl p-4 mb-6"
          style={{ opacity: 1 }}
        >
          <Text className="text-error text-center font-semibold text-lg">
            Delete Goal
          </Text>
        </TouchableOpacity>

        {/* Created Date */}
        <Text className="text-muted text-center text-sm">
          Created on {new Date(goal.createdAt).toLocaleDateString()}
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}
