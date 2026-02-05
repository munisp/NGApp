import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const SPLIT_EXPENSES_KEY = 'splitExpenses';

interface Participant {
  id: string;
  name: string;
  amount: number;
  paid: boolean;
}

interface SplitExpense {
  id: string;
  title: string;
  totalAmount: number;
  date: string;
  createdBy: string;
  participants: Participant[];
  settled: boolean;
}

export default function SplitExpenseScreen() {
  const router = useRouter();
  const [expenses, setExpenses] = useState<SplitExpense[]>([]);

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      const stored = await AsyncStorage.getItem(SPLIT_EXPENSES_KEY);
      let data: SplitExpense[];

      if (stored) {
        data = JSON.parse(stored);
      } else {
        // Sample data
        data = [
          {
            id: '1',
            title: 'Dinner at Restaurant',
            totalAmount: 150,
            date: new Date().toISOString(),
            createdBy: 'You',
            participants: [
              { id: '1', name: 'You', amount: 50, paid: true },
              { id: '2', name: 'John', amount: 50, paid: false },
              { id: '3', name: 'Sarah', amount: 50, paid: true },
            ],
            settled: false,
          },
          {
            id: '2',
            title: 'Vacation House Rent',
            totalAmount: 1200,
            date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            createdBy: 'You',
            participants: [
              { id: '1', name: 'You', amount: 400, paid: true },
              { id: '2', name: 'Mike', amount: 400, paid: true },
              { id: '3', name: 'Emma', amount: 400, paid: true },
            ],
            settled: true,
          },
        ];
        await AsyncStorage.setItem(SPLIT_EXPENSES_KEY, JSON.stringify(data));
      }

      setExpenses(data);
    } catch (error) {
      console.error('Failed to load split expenses:', error);
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      const updated = expenses.filter(e => e.id !== id);
      await AsyncStorage.setItem(SPLIT_EXPENSES_KEY, JSON.stringify(updated));
      setExpenses(updated);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to delete expense:', error);
    }
  };

  const confirmDelete = (expense: SplitExpense) => {
    Alert.alert(
      'Delete Expense',
      `Are you sure you want to delete "${expense.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteExpense(expense.id),
        },
      ]
    );
  };

  const activeExpenses = expenses.filter(e => !e.settled);
  const settledExpenses = expenses.filter(e => e.settled);

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Split Expenses', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-foreground font-bold text-3xl mb-2">Split Expenses</Text>
          <Text className="text-muted">Share costs with friends and family</Text>
        </View>

        {/* Add New Button */}
        <TouchableOpacity
          onPress={() => router.push('/(split)/add' as any)}
          className="bg-primary rounded-xl p-4 mb-6"
          style={{ opacity: 1 }}
        >
          <Text className="text-white text-center font-semibold text-lg">+ Add Split Expense</Text>
        </TouchableOpacity>

        {/* Active Expenses */}
        {activeExpenses.length > 0 && (
          <View className="mb-6">
            <Text className="text-foreground font-bold text-xl mb-4">Active</Text>
            {activeExpenses.map(expense => {
              const paidCount = expense.participants.filter(p => p.paid).length;
              const totalParticipants = expense.participants.length;
              const yourShare = expense.participants.find(p => p.name === 'You')?.amount || 0;
              const youPaid = expense.participants.find(p => p.name === 'You')?.paid || false;

              return (
                <TouchableOpacity
                  key={expense.id}
                  onPress={() => router.push(`/(split)/${expense.id}` as any)}
                  onLongPress={() => confirmDelete(expense)}
                  className="bg-surface rounded-xl p-5 mb-3 border border-border"
                  style={{ opacity: 1 }}
                >
                  <View className="flex-row justify-between items-start mb-3">
                    <View className="flex-1">
                      <Text className="text-foreground font-bold text-lg mb-1">
                        {expense.title}
                      </Text>
                      <Text className="text-muted text-sm">
                        {new Date(expense.date).toLocaleDateString()}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-foreground font-bold text-xl">
                        ${expense.totalAmount.toLocaleString()}
                      </Text>
                      <Text className="text-muted text-sm">total</Text>
                    </View>
                  </View>

                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <Text className="text-muted text-sm mr-2">Your share:</Text>
                      <Text className="text-foreground font-semibold">
                        ${yourShare.toLocaleString()}
                      </Text>
                    </View>
                    <View
                      className={`px-3 py-1 rounded-full ${
                        youPaid ? 'bg-success/20' : 'bg-warning/20'
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          youPaid ? 'text-success' : 'text-warning'
                        }`}
                      >
                        {youPaid ? '✓ Paid' : 'Pending'}
                      </Text>
                    </View>
                  </View>

                  <View className="mt-3 pt-3 border-t border-border">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-muted text-sm">
                        {paidCount} of {totalParticipants} paid
                      </Text>
                      <View className="flex-1 mx-3 h-2 bg-border/30 rounded-full overflow-hidden">
                        <View
                          className="h-full bg-success rounded-full"
                          style={{ width: `${(paidCount / totalParticipants) * 100}%` }}
                        />
                      </View>
                      <Text className="text-muted text-sm">
                        {Math.round((paidCount / totalParticipants) * 100)}%
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Settled Expenses */}
        {settledExpenses.length > 0 && (
          <View className="mb-6">
            <Text className="text-foreground font-bold text-xl mb-4">Settled</Text>
            {settledExpenses.map(expense => (
              <TouchableOpacity
                key={expense.id}
                onPress={() => router.push(`/(split)/${expense.id}` as any)}
                onLongPress={() => confirmDelete(expense)}
                className="bg-surface/50 rounded-xl p-5 mb-3 border border-border/50"
                style={{ opacity: 0.7 }}
              >
                <View className="flex-row justify-between items-center">
                  <View className="flex-1">
                    <Text className="text-foreground font-semibold text-lg mb-1">
                      {expense.title}
                    </Text>
                    <Text className="text-muted text-sm">
                      {new Date(expense.date).toLocaleDateString()}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-foreground font-bold text-xl">
                      ${expense.totalAmount.toLocaleString()}
                    </Text>
                    <View className="bg-success/20 px-3 py-1 rounded-full mt-1">
                      <Text className="text-success text-xs font-semibold">✓ Settled</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {expenses.length === 0 && (
          <View className="bg-surface rounded-xl p-12 items-center border border-border">
            <Text className="text-6xl mb-4">💸</Text>
            <Text className="text-foreground font-semibold text-lg mb-2">No Split Expenses</Text>
            <Text className="text-muted text-center">
              Create your first split expense to share costs with others
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
