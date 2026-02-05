import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const SCHEDULED_PAYMENTS_KEY = 'scheduledPayments';

interface ScheduledPayment {
  id: string;
  title: string;
  amount: number;
  recipient: string;
  scheduledDate: string;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly';
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: string;
}

export default function ScheduledPaymentsScreen() {
  const router = useRouter();
  const [payments, setPayments] = useState<ScheduledPayment[]>([]);

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      const stored = await AsyncStorage.getItem(SCHEDULED_PAYMENTS_KEY);
      let data: ScheduledPayment[];

      if (stored) {
        data = JSON.parse(stored);
      } else {
        // Sample data
        data = [
          {
            id: '1',
            title: 'Rent Payment',
            amount: 1200,
            recipient: 'Landlord',
            scheduledDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
            frequency: 'monthly',
            status: 'pending',
            createdAt: new Date().toISOString(),
          },
          {
            id: '2',
            title: 'Electricity Bill',
            amount: 150,
            recipient: 'Power Company',
            scheduledDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
            frequency: 'monthly',
            status: 'pending',
            createdAt: new Date().toISOString(),
          },
          {
            id: '3',
            title: 'Savings Transfer',
            amount: 500,
            recipient: 'Savings Account',
            scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
            frequency: 'weekly',
            status: 'pending',
            createdAt: new Date().toISOString(),
          },
        ];
        await AsyncStorage.setItem(SCHEDULED_PAYMENTS_KEY, JSON.stringify(data));
      }

      setPayments(data);
    } catch (error) {
      console.error('Failed to load scheduled payments:', error);
    }
  };

  const cancelPayment = async (id: string) => {
    try {
      const updated = payments.map(p =>
        p.id === id ? { ...p, status: 'cancelled' as const } : p
      );
      await AsyncStorage.setItem(SCHEDULED_PAYMENTS_KEY, JSON.stringify(updated));
      setPayments(updated);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to cancel payment:', error);
    }
  };

  const confirmCancel = (payment: ScheduledPayment) => {
    Alert.alert(
      'Cancel Payment',
      `Are you sure you want to cancel "${payment.title}"?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => cancelPayment(payment.id),
        },
      ]
    );
  };

  const deletePayment = async (id: string) => {
    try {
      const updated = payments.filter(p => p.id !== id);
      await AsyncStorage.setItem(SCHEDULED_PAYMENTS_KEY, JSON.stringify(updated));
      setPayments(updated);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to delete payment:', error);
    }
  };

  const confirmDelete = (payment: ScheduledPayment) => {
    Alert.alert(
      'Delete Payment',
      `Are you sure you want to delete "${payment.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deletePayment(payment.id),
        },
      ]
    );
  };

  const pendingPayments = payments.filter(p => p.status === 'pending');
  const completedPayments = payments.filter(p => p.status === 'completed');
  const cancelledPayments = payments.filter(p => p.status === 'cancelled');

  const getFrequencyLabel = (frequency: string) => {
    const labels: { [key: string]: string } = {
      once: 'One-time',
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
    };
    return labels[frequency] || frequency;
  };

  const getDaysUntil = (date: string) => {
    const days = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return 'Overdue';
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `in ${days} days`;
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Scheduled Payments', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-foreground font-bold text-3xl mb-2">Scheduled Payments</Text>
          <Text className="text-muted">Automate your recurring payments</Text>
        </View>

        {/* Add New Button */}
        <TouchableOpacity
          onPress={() => router.push('/(schedule)/add' as any)}
          className="bg-primary rounded-xl p-4 mb-6"
          style={{ opacity: 1 }}
        >
          <Text className="text-white text-center font-semibold text-lg">+ Schedule Payment</Text>
        </TouchableOpacity>

        {/* Pending Payments */}
        {pendingPayments.length > 0 && (
          <View className="mb-6">
            <Text className="text-foreground font-bold text-xl mb-4">Upcoming</Text>
            {pendingPayments.map(payment => (
              <TouchableOpacity
                key={payment.id}
                onPress={() => router.push(`/(schedule)/${payment.id}` as any)}
                onLongPress={() => confirmDelete(payment)}
                className="bg-surface rounded-xl p-5 mb-3 border border-border"
                style={{ opacity: 1 }}
              >
                <View className="flex-row justify-between items-start mb-3">
                  <View className="flex-1">
                    <Text className="text-foreground font-bold text-lg mb-1">
                      {payment.title}
                    </Text>
                    <Text className="text-muted text-sm mb-1">To: {payment.recipient}</Text>
                    <View className="flex-row items-center gap-2">
                      <View className="bg-primary/20 px-2 py-1 rounded-full">
                        <Text className="text-primary text-xs font-semibold">
                          {getFrequencyLabel(payment.frequency)}
                        </Text>
                      </View>
                      <Text className="text-muted text-xs">
                        {getDaysUntil(payment.scheduledDate)}
                      </Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className="text-foreground font-bold text-xl">
                      ${payment.amount.toLocaleString()}
                    </Text>
                    <Text className="text-muted text-sm">
                      {new Date(payment.scheduledDate).toLocaleDateString()}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => confirmCancel(payment)}
                  className="bg-error/10 rounded-lg p-2 mt-2"
                  style={{ opacity: 1 }}
                >
                  <Text className="text-error text-center text-sm font-semibold">
                    Cancel Payment
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Completed Payments */}
        {completedPayments.length > 0 && (
          <View className="mb-6">
            <Text className="text-foreground font-bold text-xl mb-4">Completed</Text>
            {completedPayments.map(payment => (
              <TouchableOpacity
                key={payment.id}
                onPress={() => router.push(`/(schedule)/${payment.id}` as any)}
                onLongPress={() => confirmDelete(payment)}
                className="bg-surface/50 rounded-xl p-5 mb-3 border border-border/50"
                style={{ opacity: 0.7 }}
              >
                <View className="flex-row justify-between items-center">
                  <View className="flex-1">
                    <Text className="text-foreground font-semibold text-lg mb-1">
                      {payment.title}
                    </Text>
                    <Text className="text-muted text-sm">To: {payment.recipient}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-foreground font-bold text-xl">
                      ${payment.amount.toLocaleString()}
                    </Text>
                    <View className="bg-success/20 px-3 py-1 rounded-full mt-1">
                      <Text className="text-success text-xs font-semibold">✓ Completed</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Cancelled Payments */}
        {cancelledPayments.length > 0 && (
          <View className="mb-6">
            <Text className="text-foreground font-bold text-xl mb-4">Cancelled</Text>
            {cancelledPayments.map(payment => (
              <TouchableOpacity
                key={payment.id}
                onPress={() => router.push(`/(schedule)/${payment.id}` as any)}
                onLongPress={() => confirmDelete(payment)}
                className="bg-surface/30 rounded-xl p-5 mb-3 border border-border/30"
                style={{ opacity: 0.5 }}
              >
                <View className="flex-row justify-between items-center">
                  <View className="flex-1">
                    <Text className="text-foreground font-semibold text-lg mb-1">
                      {payment.title}
                    </Text>
                    <Text className="text-muted text-sm">To: {payment.recipient}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-foreground font-bold text-xl">
                      ${payment.amount.toLocaleString()}
                    </Text>
                    <View className="bg-error/20 px-3 py-1 rounded-full mt-1">
                      <Text className="text-error text-xs font-semibold">✕ Cancelled</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {payments.length === 0 && (
          <View className="bg-surface rounded-xl p-12 items-center border border-border">
            <Text className="text-6xl mb-4">📅</Text>
            <Text className="text-foreground font-semibold text-lg mb-2">
              No Scheduled Payments
            </Text>
            <Text className="text-muted text-center">
              Schedule your first payment to automate your finances
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
