import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
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

export default function SplitExpenseDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const expenseId = params.id as string;

  const [expense, setExpense] = useState<SplitExpense | null>(null);

  useEffect(() => {
    loadExpense();
  }, [expenseId]);

  const loadExpense = async () => {
    try {
      const stored = await AsyncStorage.getItem(SPLIT_EXPENSES_KEY);
      if (stored) {
        const expenses: SplitExpense[] = JSON.parse(stored);
        const found = expenses.find(e => e.id === expenseId);
        if (found) {
          setExpense(found);
        }
      }
    } catch (error) {
      console.error('Failed to load expense:', error);
    }
  };

  const togglePaid = async (participantId: string) => {
    if (!expense) return;

    try {
      const updatedParticipants = expense.participants.map(p =>
        p.id === participantId ? { ...p, paid: !p.paid } : p
      );

      const updatedExpense = { ...expense, participants: updatedParticipants };

      const stored = await AsyncStorage.getItem(SPLIT_EXPENSES_KEY);
      if (stored) {
        const expenses: SplitExpense[] = JSON.parse(stored);
        const updated = expenses.map(e => (e.id === expenseId ? updatedExpense : e));
        await AsyncStorage.setItem(SPLIT_EXPENSES_KEY, JSON.stringify(updated));
        setExpense(updatedExpense);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Failed to toggle paid status:', error);
    }
  };

  const settleExpense = async () => {
    if (!expense) return;

    const allPaid = expense.participants.every(p => p.paid);
    if (!allPaid) {
      Alert.alert('Cannot Settle', 'All participants must pay before settling');
      return;
    }

    try {
      const updatedExpense = { ...expense, settled: true };

      const stored = await AsyncStorage.getItem(SPLIT_EXPENSES_KEY);
      if (stored) {
        const expenses: SplitExpense[] = JSON.parse(stored);
        const updated = expenses.map(e => (e.id === expenseId ? updatedExpense : e));
        await AsyncStorage.setItem(SPLIT_EXPENSES_KEY, JSON.stringify(updated));
        setExpense(updatedExpense);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', 'Expense settled!');
      }
    } catch (error) {
      console.error('Failed to settle expense:', error);
    }
  };

  const sendReminder = (participant: Participant) => {
    Alert.alert(
      'Send Reminder',
      `Send payment reminder to ${participant.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Reminder Sent', `Payment reminder sent to ${participant.name}`);
          },
        },
      ]
    );
  };

  if (!expense) {
    return (
      <ScreenContainer className="p-4">
        <Stack.Screen options={{ title: 'Expense Detail', headerShown: true }} />
        <View className="flex-1 justify-center items-center">
          <Text className="text-muted">Loading...</Text>
        </View>
      </ScreenContainer>
    );
  }

  const paidCount = expense.participants.filter(p => p.paid).length;
  const totalParticipants = expense.participants.length;
  const allPaid = paidCount === totalParticipants;

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: expense.title, headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Card */}
        <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30">
          <Text className="text-foreground font-bold text-3xl mb-2">
            ${expense.totalAmount.toLocaleString()}
          </Text>
          <Text className="text-muted mb-1">{expense.title}</Text>
          <Text className="text-muted text-sm">
            Created on {new Date(expense.date).toLocaleDateString()}
          </Text>
        </View>

        {/* Status */}
        {expense.settled ? (
          <View className="bg-success/10 rounded-xl p-4 mb-6 border border-success/30">
            <Text className="text-success font-semibold text-center text-lg">
              ✓ Expense Settled
            </Text>
          </View>
        ) : (
          <View className="bg-surface rounded-xl p-5 mb-6 border border-border">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-foreground font-semibold">Payment Progress</Text>
              <Text className="text-muted">
                {paidCount} / {totalParticipants}
              </Text>
            </View>
            <View className="h-3 bg-border/30 rounded-full overflow-hidden">
              <View
                className="h-full bg-success rounded-full"
                style={{ width: `${(paidCount / totalParticipants) * 100}%` }}
              />
            </View>
          </View>
        )}

        {/* Participants */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-4">Participants</Text>

          {expense.participants.map(participant => (
            <View key={participant.id} className="mb-4 last:mb-0">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-foreground font-semibold text-lg mb-1">
                    {participant.name}
                  </Text>
                  <Text className="text-muted text-sm">
                    ${participant.amount.toLocaleString()}
                  </Text>
                </View>

                {!expense.settled && (
                  <TouchableOpacity
                    onPress={() => togglePaid(participant.id)}
                    className={`px-4 py-2 rounded-full ${
                      participant.paid ? 'bg-success/20' : 'bg-warning/20'
                    }`}
                    style={{ opacity: 1 }}
                  >
                    <Text
                      className={`font-semibold ${
                        participant.paid ? 'text-success' : 'text-warning'
                      }`}
                    >
                      {participant.paid ? '✓ Paid' : 'Pending'}
                    </Text>
                  </TouchableOpacity>
                )}

                {expense.settled && (
                  <View className="px-4 py-2 rounded-full bg-success/20">
                    <Text className="text-success font-semibold">✓ Paid</Text>
                  </View>
                )}
              </View>

              {!expense.settled && !participant.paid && participant.name !== 'You' && (
                <TouchableOpacity
                  onPress={() => sendReminder(participant)}
                  className="mt-2 bg-primary/10 rounded-lg p-2"
                  style={{ opacity: 1 }}
                >
                  <Text className="text-primary text-center text-sm font-semibold">
                    Send Reminder
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Actions */}
        {!expense.settled && (
          <View className="gap-3 mb-6">
            {allPaid && (
              <TouchableOpacity
                onPress={settleExpense}
                className="bg-success rounded-xl p-4"
                style={{ opacity: 1 }}
              >
                <Text className="text-white text-center font-semibold text-lg">
                  ✓ Mark as Settled
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() =>
                Alert.alert('Share', 'Share expense details feature coming soon!')
              }
              className="bg-surface border border-border rounded-xl p-4"
              style={{ opacity: 1 }}
            >
              <Text className="text-foreground text-center font-semibold text-lg">
                📤 Share Details
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
