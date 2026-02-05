import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
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

export default function CategoryDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const categoryId = params.id as string;

  const [category, setCategory] = useState<BudgetCategory | null>(null);
  const [addAmount, setAddAmount] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    loadCategory();
  }, [categoryId]);

  const loadCategory = async () => {
    try {
      const stored = await AsyncStorage.getItem(BUDGET_KEY);
      if (stored) {
        const categories = JSON.parse(stored);
        const found = categories.find((c: BudgetCategory) => c.id === categoryId);
        if (found) {
          setCategory(found);
        }
      }
    } catch (error) {
      console.error('Failed to load category:', error);
    }
  };

  const handleAddSpending = async () => {
    if (!category || !addAmount || parseFloat(addAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      setIsAdding(true);

      const amount = parseFloat(addAmount);
      const newSpent = category.spent + amount;
      const wasOverBudget = category.spent > category.limit;
      const isNowOverBudget = newSpent > category.limit;

      // Update category
      const stored = await AsyncStorage.getItem(BUDGET_KEY);
      if (stored) {
        const categories = JSON.parse(stored);
        const updatedCategories = categories.map((c: BudgetCategory) =>
          c.id === categoryId ? { ...c, spent: newSpent } : c
        );
        await AsyncStorage.setItem(BUDGET_KEY, JSON.stringify(updatedCategories));
      }

      // Trigger haptic feedback
      if (Platform.OS !== 'web') {
        if (!wasOverBudget && isNowOverBudget) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } else {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }

      // Show alert if over budget
      if (!wasOverBudget && isNowOverBudget) {
        Alert.alert(
          '⚠️ Over Budget',
          `You've exceeded your ${category.name} budget by $${(newSpent - category.limit).toFixed(2)}`,
          [
            {
              text: 'OK',
              onPress: () => {
                loadCategory();
                setAddAmount('');
              },
            },
          ]
        );
      } else {
        Alert.alert('Success', `$${amount.toFixed(2)} added to spending`, [
          {
            text: 'OK',
            onPress: () => {
              loadCategory();
              setAddAmount('');
            },
          },
        ]);
      }
    } catch (error) {
      console.error('Failed to add spending:', error);
      Alert.alert('Error', 'Failed to add spending. Please try again.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleResetSpending = () => {
    Alert.alert(
      'Reset Spending',
      'This will reset spending to $0 for this category. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              const stored = await AsyncStorage.getItem(BUDGET_KEY);
              if (stored) {
                const categories = JSON.parse(stored);
                const updatedCategories = categories.map((c: BudgetCategory) =>
                  c.id === categoryId ? { ...c, spent: 0 } : c
                );
                await AsyncStorage.setItem(BUDGET_KEY, JSON.stringify(updatedCategories));
                loadCategory();
              }
            } catch (error) {
              console.error('Failed to reset spending:', error);
              Alert.alert('Error', 'Failed to reset spending');
            }
          },
        },
      ]
    );
  };

  const handleDeleteCategory = () => {
    Alert.alert(
      'Delete Category',
      'Are you sure you want to delete this budget category?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const stored = await AsyncStorage.getItem(BUDGET_KEY);
              if (stored) {
                const categories = JSON.parse(stored);
                const updatedCategories = categories.filter((c: BudgetCategory) => c.id !== categoryId);
                await AsyncStorage.setItem(BUDGET_KEY, JSON.stringify(updatedCategories));
              }
              router.back();
            } catch (error) {
              console.error('Failed to delete category:', error);
              Alert.alert('Error', 'Failed to delete category');
            }
          },
        },
      ]
    );
  };

  if (!category) {
    return (
      <ScreenContainer className="p-4 justify-center items-center">
        <Text className="text-foreground">Loading...</Text>
      </ScreenContainer>
    );
  }

  const progress = Math.min((category.spent / category.limit) * 100, 100);
  const remaining = Math.max(category.limit - category.spent, 0);
  const isOverBudget = category.spent > category.limit;

  const getProgressColor = (): string => {
    if (progress < 70) return 'bg-success';
    if (progress < 90) return 'bg-warning';
    return 'bg-error';
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: category.name, headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Category Header */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border items-center">
          <View className="w-20 h-20 bg-primary/20 rounded-full items-center justify-center mb-4">
            <Text className="text-5xl">{category.icon}</Text>
          </View>
          <Text className="text-foreground font-bold text-2xl mb-2">{category.name}</Text>
          
          {isOverBudget && (
            <View className="bg-error/20 rounded-xl px-4 py-2 mb-4">
              <Text className="text-error font-bold">⚠️ Over Budget</Text>
            </View>
          )}

          <Text className="text-primary font-bold text-5xl mb-2">
            ${category.spent.toFixed(2)}
          </Text>
          <Text className="text-muted text-lg">
            of ${category.limit.toFixed(2)} budget
          </Text>
        </View>

        {/* Progress */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-foreground font-semibold text-lg">Progress</Text>
            <Text className={`font-bold text-2xl ${isOverBudget ? 'text-error' : 'text-success'}`}>
              {progress.toFixed(0)}%
            </Text>
          </View>

          <View className="bg-border rounded-full h-4 mb-4 overflow-hidden">
            <View
              className={`${getProgressColor()} h-full rounded-full`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </View>

          <View className="flex-row justify-between">
            <View>
              <Text className="text-muted text-sm mb-1">
                {isOverBudget ? 'Over by' : 'Remaining'}
              </Text>
              <Text className={`font-semibold text-lg ${isOverBudget ? 'text-error' : 'text-foreground'}`}>
                ${Math.abs(remaining).toFixed(2)}
              </Text>
            </View>
            <View>
              <Text className="text-muted text-sm mb-1">Daily Average</Text>
              <Text className="text-foreground font-semibold text-lg">
                ${(category.spent / 30).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Visual Chart (Simple Bar Chart) */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-semibold text-lg mb-4">Spending Breakdown</Text>
          
          <View className="flex-row items-end justify-between h-40 mb-4">
            {/* Budget Bar */}
            <View className="flex-1 items-center">
              <View
                className="bg-border rounded-t w-full"
                style={{ height: '100%' }}
              />
              <Text className="text-muted text-xs mt-2">Budget</Text>
              <Text className="text-foreground font-semibold text-sm">
                ${category.limit.toFixed(0)}
              </Text>
            </View>

            {/* Spent Bar */}
            <View className="flex-1 items-center ml-4">
              <View
                className={`${isOverBudget ? 'bg-error' : 'bg-primary'} rounded-t w-full`}
                style={{ height: `${Math.min((category.spent / category.limit) * 100, 100)}%` }}
              />
              <Text className="text-muted text-xs mt-2">Spent</Text>
              <Text className={`font-semibold text-sm ${isOverBudget ? 'text-error' : 'text-primary'}`}>
                ${category.spent.toFixed(0)}
              </Text>
            </View>
          </View>
        </View>

        {/* Add Spending */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-2">Add Spending</Text>
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
            onPress={handleAddSpending}
            disabled={isAdding}
            className="bg-primary rounded-xl p-4"
            style={{ opacity: isAdding ? 0.6 : 1 }}
          >
            <Text className="text-white text-center font-semibold text-lg">
              {isAdding ? 'Adding...' : 'Add Spending'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <View className="flex-row gap-3 mb-6">
          <TouchableOpacity
            onPress={handleResetSpending}
            className="flex-1 bg-warning/20 border border-warning rounded-xl p-4"
            style={{ opacity: 1 }}
          >
            <Text className="text-warning text-center font-semibold text-lg">
              Reset Spending
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDeleteCategory}
            className="flex-1 bg-error/20 border border-error rounded-xl p-4"
            style={{ opacity: 1 }}
          >
            <Text className="text-error text-center font-semibold text-lg">
              Delete
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
