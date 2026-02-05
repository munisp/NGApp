import { View, Text, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export default function FinancialGoalsScreen() {
  const router = useRouter();
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    try {
      const stored = await AsyncStorage.getItem(GOALS_KEY);
      let goalsList: FinancialGoal[] = [];

      if (stored) {
        goalsList = JSON.parse(stored);
      } else {
        // Initialize with sample goals
        goalsList = [
          {
            id: '1',
            name: 'Emergency Fund',
            category: 'emergency',
            targetAmount: 10000,
            currentAmount: 3500,
            deadline: new Date(Date.now() + 180 * 86400000).toISOString(),
            monthlyContribution: 500,
            emoji: '🛡️',
          },
          {
            id: '2',
            name: 'Dream Vacation',
            category: 'vacation',
            targetAmount: 5000,
            currentAmount: 1200,
            deadline: new Date(Date.now() + 365 * 86400000).toISOString(),
            monthlyContribution: 300,
            emoji: '✈️',
          },
        ];
        await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(goalsList));
      }

      setGoals(goalsList);
    } catch (error) {
      console.error('Failed to load goals:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGoals();
    setRefreshing(false);
  };

  const calculateProgress = (goal: FinancialGoal): number => {
    return (goal.currentAmount / goal.targetAmount) * 100;
  };

  const calculateMonthsRemaining = (deadline: string): number => {
    const now = new Date();
    const end = new Date(deadline);
    const diff = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (30 * 86400000)));
  };

  const renderGoal = ({ item }: { item: FinancialGoal }) => {
    const progress = calculateProgress(item);
    const monthsLeft = calculateMonthsRemaining(item.deadline);
    const isCompleted = progress >= 100;

    return (
      <TouchableOpacity
        onPress={() => router.push(`/(goals)/${item.id}` as any)}
        className="bg-surface rounded-xl p-6 mb-4 border border-border"
        style={{ opacity: 1 }}
      >
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center flex-1">
            <Text className="text-5xl mr-4">{item.emoji}</Text>
            <View className="flex-1">
              <Text className="text-foreground font-bold text-xl mb-1">{item.name}</Text>
              <Text className="text-muted text-sm capitalize">{item.category}</Text>
            </View>
          </View>
          {isCompleted && (
            <View className="bg-success rounded-full w-10 h-10 items-center justify-center">
              <Text className="text-white text-2xl">✓</Text>
            </View>
          )}
        </View>

        {/* Progress Bar */}
        <View className="mb-4">
          <View className="flex-row justify-between mb-2">
            <Text className="text-muted text-sm">
              ${item.currentAmount.toFixed(2)} of ${item.targetAmount.toFixed(2)}
            </Text>
            <Text className="text-primary font-semibold text-sm">{progress.toFixed(0)}%</Text>
          </View>
          <View className="h-3 bg-border/30 rounded-full overflow-hidden">
            <View
              className={`h-full rounded-full ${isCompleted ? 'bg-success' : 'bg-primary'}`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </View>
        </View>

        {/* Timeline */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Text className="text-muted text-sm mr-2">📅</Text>
            <Text className="text-muted text-sm">
              {monthsLeft} {monthsLeft === 1 ? 'month' : 'months'} left
            </Text>
          </View>
          <View className="flex-row items-center">
            <Text className="text-muted text-sm mr-2">💰</Text>
            <Text className="text-muted text-sm">${item.monthlyContribution}/month</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const totalSaved = goals.reduce((sum, goal) => sum + goal.currentAmount, 0);
  const totalTarget = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Financial Goals', headerShown: true }} />

      {/* Overall Progress */}
      <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30">
        <Text className="text-foreground font-bold text-xl mb-4">Overall Progress</Text>
        <Text className="text-primary font-bold text-5xl mb-2">
          {overallProgress.toFixed(0)}%
        </Text>
        <Text className="text-muted mb-4">
          ${totalSaved.toFixed(2)} of ${totalTarget.toFixed(2)} saved
        </Text>
        <View className="h-4 bg-border/30 rounded-full overflow-hidden">
          <View
            className="h-full bg-primary rounded-full"
            style={{ width: `${Math.min(overallProgress, 100)}%` }}
          />
        </View>
      </View>

      {/* Goals List */}
      {goals.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-6xl mb-4">🎯</Text>
          <Text className="text-foreground font-semibold text-lg mb-2">No Goals Yet</Text>
          <Text className="text-muted text-center mb-6">
            Create your first financial goal to start saving
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(goals)/create' as any)}
            className="bg-primary px-6 py-3 rounded-xl"
            style={{ opacity: 1 }}
          >
            <Text className="text-white font-semibold">Create Goal</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={goals}
            renderItem={renderGoal}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0a7ea4" />
            }
            ListFooterComponent={
              <TouchableOpacity
                onPress={() => router.push('/(goals)/create' as any)}
                className="bg-primary rounded-xl p-4 mb-6"
                style={{ opacity: 1 }}
              >
                <Text className="text-white text-center font-semibold text-lg">
                  ➕ Create New Goal
                </Text>
              </TouchableOpacity>
            }
          />
        </>
      )}
    </ScreenContainer>
  );
}
