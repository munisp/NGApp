import { View, Text, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  category: 'emergency' | 'vacation' | 'purchase' | 'education' | 'other';
  deadline?: string;
  autoTransferAmount?: number;
  autoTransferFrequency?: 'daily' | 'weekly' | 'monthly';
  createdAt: string;
}

const SAVINGS_GOALS_KEY = 'savingsGoals';

const categoryIcons: Record<SavingsGoal['category'], string> = {
  emergency: '🚨',
  vacation: '✈️',
  purchase: '🛍️',
  education: '🎓',
  other: '💰',
};

export default function SavingsGoalsScreen() {
  const router = useRouter();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    try {
      setIsLoading(true);
      const stored = await AsyncStorage.getItem(SAVINGS_GOALS_KEY);
      if (stored) {
        setGoals(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load savings goals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateProgress = (current: number, target: number): number => {
    return Math.min((current / target) * 100, 100);
  };

  const renderGoal = ({ item }: { item: SavingsGoal }) => {
    const progress = calculateProgress(item.currentAmount, item.targetAmount);
    const remaining = item.targetAmount - item.currentAmount;

    return (
      <TouchableOpacity
        onPress={() => router.push(`/(savings)/${item.id}`)}
        className="bg-surface rounded-xl p-4 mb-3 border border-border"
        style={{ opacity: 1 }}
      >
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center flex-1">
            <View className="w-12 h-12 bg-primary/20 rounded-full items-center justify-center mr-3">
              <Text className="text-2xl">{categoryIcons[item.category]}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-foreground font-semibold text-base mb-1">
                {item.name}
              </Text>
              <Text className="text-muted text-sm">
                ${item.currentAmount.toFixed(2)} of ${item.targetAmount.toFixed(2)}
              </Text>
            </View>
          </View>
          <Text className="text-primary font-bold text-lg">
            {progress.toFixed(0)}%
          </Text>
        </View>

        {/* Progress Bar */}
        <View className="bg-border rounded-full h-2 mb-2 overflow-hidden">
          <View
            className="bg-primary h-full rounded-full"
            style={{ width: `${progress}%` }}
          />
        </View>

        <View className="flex-row justify-between items-center">
          <Text className="text-muted text-xs">
            ${remaining.toFixed(2)} remaining
          </Text>
          {item.deadline && (
            <Text className="text-muted text-xs">
              Due: {new Date(item.deadline).toLocaleDateString()}
            </Text>
          )}
        </View>

        {item.autoTransferAmount && (
          <View className="mt-2 bg-primary/10 rounded px-2 py-1 self-start">
            <Text className="text-primary text-xs font-medium">
              Auto: ${item.autoTransferAmount} {item.autoTransferFrequency}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const totalSaved = goals.reduce((sum, goal) => sum + goal.currentAmount, 0);
  const totalTarget = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Savings Goals', headerShown: true }} />

      {/* Overall Progress */}
      {goals.length > 0 && (
        <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30">
          <Text className="text-foreground font-bold text-xl mb-2">Total Savings</Text>
          <Text className="text-primary font-bold text-4xl mb-4">
            ${totalSaved.toFixed(2)}
          </Text>
          <View className="bg-border rounded-full h-3 mb-2 overflow-hidden">
            <View
              className="bg-primary h-full rounded-full"
              style={{ width: `${overallProgress}%` }}
            />
          </View>
          <Text className="text-muted text-sm">
            {overallProgress.toFixed(0)}% of ${totalTarget.toFixed(2)} goal
          </Text>
        </View>
      )}

      {/* Add Goal Button */}
      <TouchableOpacity
        onPress={() => router.push('/(savings)/create')}
        className="bg-primary rounded-xl p-4 mb-6 flex-row items-center justify-center"
        style={{ opacity: 1 }}
      >
        <Text className="text-white text-2xl mr-2">+</Text>
        <Text className="text-white font-semibold text-lg">Create New Goal</Text>
      </TouchableOpacity>

      {/* Goals List */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0a7ea4" />
        </View>
      ) : goals.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-6xl mb-4">🎯</Text>
          <Text className="text-foreground font-semibold text-lg mb-2">No Savings Goals</Text>
          <Text className="text-muted text-center mb-6">
            Start saving for your dreams by creating your first goal
          </Text>
        </View>
      ) : (
        <>
          <Text className="text-foreground font-bold text-lg mb-3">Your Goals</Text>
          <FlatList
            data={goals}
            renderItem={renderGoal}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </ScreenContainer>
  );
}
