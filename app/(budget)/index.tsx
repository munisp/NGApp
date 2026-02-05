import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface BudgetCategory {
  id: string;
  name: string;
  limit: number;
  spent: number;
  icon: string;
  color: string;
}

const BUDGET_KEY = 'budgetCategories';

const defaultCategories: Omit<BudgetCategory, 'id' | 'spent'>[] = [
  { name: 'Food & Dining', limit: 500, icon: '🍔', color: '#EF4444' },
  { name: 'Transportation', limit: 200, icon: '🚗', color: '#F59E0B' },
  { name: 'Shopping', limit: 300, icon: '🛍️', color: '#8B5CF6' },
  { name: 'Entertainment', limit: 150, icon: '🎬', color: '#EC4899' },
  { name: 'Bills & Utilities', limit: 400, icon: '💡', color: '#3B82F6' },
  { name: 'Healthcare', limit: 200, icon: '🏥', color: '#10B981' },
];

export default function BudgetScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadBudget();
  }, []);

  const loadBudget = async () => {
    try {
      setIsLoading(true);
      const stored = await AsyncStorage.getItem(BUDGET_KEY);
      if (stored) {
        setCategories(JSON.parse(stored));
      } else {
        // Initialize with default categories
        const initial = defaultCategories.map((cat, index) => ({
          ...cat,
          id: (index + 1).toString(),
          spent: 0,
        }));
        await AsyncStorage.setItem(BUDGET_KEY, JSON.stringify(initial));
        setCategories(initial);
      }
    } catch (error) {
      console.error('Failed to load budget:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetBudget = () => {
    Alert.alert(
      'Reset Budget',
      'This will reset all spending to $0. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              const reset = categories.map(cat => ({ ...cat, spent: 0 }));
              await AsyncStorage.setItem(BUDGET_KEY, JSON.stringify(reset));
              setCategories(reset);
              Alert.alert('Success', 'Budget reset successfully');
            } catch (error) {
              console.error('Failed to reset budget:', error);
              Alert.alert('Error', 'Failed to reset budget');
            }
          },
        },
      ]
    );
  };

  const calculateProgress = (spent: number, limit: number): number => {
    return Math.min((spent / limit) * 100, 100);
  };

  const getProgressColor = (progress: number): string => {
    if (progress < 70) return 'bg-success';
    if (progress < 90) return 'bg-warning';
    return 'bg-error';
  };

  const renderCategory = ({ item }: { item: BudgetCategory }) => {
    const progress = calculateProgress(item.spent, item.limit);
    const remaining = Math.max(item.limit - item.spent, 0);
    const isOverBudget = item.spent > item.limit;

    return (
      <TouchableOpacity
        onPress={() => router.push(`/(budget)/${item.id}`)}
        className="bg-surface rounded-xl p-4 mb-3 border border-border"
        style={{ opacity: 1 }}
      >
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center flex-1">
            <View className="w-12 h-12 bg-primary/20 rounded-full items-center justify-center mr-3">
              <Text className="text-2xl">{item.icon}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-foreground font-semibold text-base mb-1">
                {item.name}
              </Text>
              <Text className="text-muted text-sm">
                ${item.spent.toFixed(2)} of ${item.limit.toFixed(2)}
              </Text>
            </View>
          </View>
          <View className="items-end">
            <Text className={`font-bold text-lg ${isOverBudget ? 'text-error' : 'text-success'}`}>
              {isOverBudget ? '+' : ''}${Math.abs(remaining).toFixed(2)}
            </Text>
            <Text className="text-muted text-xs">
              {isOverBudget ? 'over' : 'left'}
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View className="bg-border rounded-full h-2 overflow-hidden">
          <View
            className={`${getProgressColor(progress)} h-full rounded-full`}
            style={{ width: `${progress}%` }}
          />
        </View>

        {isOverBudget && (
          <View className="bg-error/20 rounded mt-2 px-2 py-1">
            <Text className="text-error text-xs font-medium">
              ⚠️ Over budget by ${(item.spent - item.limit).toFixed(2)}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const totalBudget = categories.reduce((sum, cat) => sum + cat.limit, 0);
  const totalSpent = categories.reduce((sum, cat) => sum + cat.spent, 0);
  const overallProgress = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const categoriesOverBudget = categories.filter(cat => cat.spent > cat.limit).length;

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Budget', headerShown: true }} />

      {/* Overall Summary */}
      <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30">
        <Text className="text-foreground font-bold text-xl mb-2">Monthly Budget</Text>
        <Text className="text-primary font-bold text-4xl mb-4">
          ${totalSpent.toFixed(2)}
        </Text>
        <View className="bg-border rounded-full h-3 mb-2 overflow-hidden">
          <View
            className={`${getProgressColor(overallProgress)} h-full rounded-full`}
            style={{ width: `${overallProgress}%` }}
          />
        </View>
        <View className="flex-row justify-between">
          <Text className="text-muted text-sm">
            {overallProgress.toFixed(0)}% of ${totalBudget.toFixed(2)}
          </Text>
          {categoriesOverBudget > 0 && (
            <Text className="text-error text-sm font-medium">
              {categoriesOverBudget} over budget
            </Text>
          )}
        </View>
      </View>

      {/* Action Buttons */}
      <View className="flex-row gap-2 mb-6">
        <TouchableOpacity
          onPress={() => router.push('/(budget)/add-category')}
          className="flex-1 bg-primary rounded-xl p-4 flex-row items-center justify-center"
          style={{ opacity: 1 }}
        >
          <Text className="text-white text-xl mr-2">+</Text>
          <Text className="text-white font-semibold">Add Category</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleResetBudget}
          className="flex-1 bg-surface border border-border rounded-xl p-4 flex-row items-center justify-center"
          style={{ opacity: 1 }}
        >
          <Text className="text-foreground text-xl mr-2">🔄</Text>
          <Text className="text-foreground font-semibold">Reset</Text>
        </TouchableOpacity>
      </View>

      {/* Categories List */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0a7ea4" />
        </View>
      ) : categories.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-6xl mb-4">💰</Text>
          <Text className="text-foreground font-semibold text-lg mb-2">No Budget Categories</Text>
          <Text className="text-muted text-center mb-6">
            Create budget categories to track your spending
          </Text>
        </View>
      ) : (
        <>
          <Text className="text-foreground font-bold text-lg mb-3">Categories</Text>
          <FlatList
            data={categories}
            renderItem={renderCategory}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </ScreenContainer>
  );
}
