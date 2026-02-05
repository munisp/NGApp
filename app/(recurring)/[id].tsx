import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface RecurringPayment {
  id: string;
  recipient: string;
  amount: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  nextDate: string;
  status: 'active' | 'paused';
  note: string;
  createdDate: string;
}

const RECURRING_PAYMENTS_KEY = 'recurringPayments';

export default function RecurringPaymentDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const paymentId = params.id as string;

  const [payment, setPayment] = useState<RecurringPayment | null>(null);

  useEffect(() => {
    loadPayment();
  }, [paymentId]);

  const loadPayment = async () => {
    try {
      const stored = await AsyncStorage.getItem(RECURRING_PAYMENTS_KEY);
      if (stored) {
        const payments = JSON.parse(stored);
        const found = payments.find((p: RecurringPayment) => p.id === paymentId);
        if (found) {
          setPayment(found);
        }
      }
    } catch (error) {
      console.error('Failed to load payment:', error);
    }
  };

  const handleToggleStatus = async () => {
    if (!payment) return;

    const newStatus = payment.status === 'active' ? 'paused' : 'active';
    const action = newStatus === 'paused' ? 'pause' : 'resume';

    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Payment`,
      `Are you sure you want to ${action} this recurring payment?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          onPress: async () => {
            try {
              const stored = await AsyncStorage.getItem(RECURRING_PAYMENTS_KEY);
              if (stored) {
                const payments = JSON.parse(stored);
                const updated = payments.map((p: RecurringPayment) =>
                  p.id === paymentId ? { ...p, status: newStatus } : p
                );
                await AsyncStorage.setItem(RECURRING_PAYMENTS_KEY, JSON.stringify(updated));
                setPayment({ ...payment, status: newStatus });
              }
            } catch (error) {
              console.error('Failed to update payment:', error);
              Alert.alert('Error', 'Failed to update payment status');
            }
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Recurring Payment',
      'Are you sure you want to delete this recurring payment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const stored = await AsyncStorage.getItem(RECURRING_PAYMENTS_KEY);
              if (stored) {
                const payments = JSON.parse(stored);
                const updated = payments.filter((p: RecurringPayment) => p.id !== paymentId);
                await AsyncStorage.setItem(RECURRING_PAYMENTS_KEY, JSON.stringify(updated));
              }
              router.back();
            } catch (error) {
              console.error('Failed to delete payment:', error);
              Alert.alert('Error', 'Failed to delete payment');
            }
          },
        },
      ]
    );
  };

  if (!payment) {
    return (
      <ScreenContainer className="p-4 justify-center items-center">
        <Text className="text-foreground">Loading...</Text>
      </ScreenContainer>
    );
  }

  const getFrequencyLabel = (frequency: string): string => {
    switch (frequency) {
      case 'daily':
        return 'Every day';
      case 'weekly':
        return 'Every week';
      case 'monthly':
        return 'Every month';
      default:
        return frequency;
    }
  };

  const getDaysUntilNext = (nextDate: string): number => {
    const days = Math.ceil(
      (new Date(nextDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.max(0, days);
  };

  const daysUntil = getDaysUntilNext(payment.nextDate);
  const estimatedMonthly =
    payment.amount * (payment.frequency === 'daily' ? 30 : payment.frequency === 'weekly' ? 4 : 1);

  // Calculate days since creation
  const daysSince = Math.floor(
    (new Date().getTime() - new Date(payment.createdDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Payment Details', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Payment Header */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border items-center">
          <View className={`${payment.status === 'active' ? 'bg-success/20' : 'bg-warning/20'} rounded-full px-4 py-1 mb-3`}>
            <Text className={`${payment.status === 'active' ? 'text-success' : 'text-warning'} font-semibold`}>
              {payment.status.toUpperCase()}
            </Text>
          </View>

          <Text className="text-foreground font-bold text-2xl mb-2">
            {payment.recipient}
          </Text>
          <Text className="text-muted mb-4">{payment.note || 'No description'}</Text>

          <Text className="text-primary font-bold text-6xl mb-2">
            ${payment.amount.toFixed(2)}
          </Text>
          <Text className="text-muted">{getFrequencyLabel(payment.frequency)}</Text>
        </View>

        {/* Next Payment */}
        {payment.status === 'active' && (
          <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30">
            <Text className="text-foreground font-bold text-lg mb-2">Next Payment</Text>
            <Text className="text-primary font-bold text-4xl mb-2">
              {daysUntil === 0 ? 'Today' : `${daysUntil} day${daysUntil !== 1 ? 's' : ''}`}
            </Text>
            <Text className="text-muted">
              {new Date(payment.nextDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>
        )}

        {/* Payment Details */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-4">Details</Text>

          <View className="flex-row justify-between mb-3">
            <Text className="text-muted">Amount</Text>
            <Text className="text-foreground font-semibold">${payment.amount.toFixed(2)}</Text>
          </View>

          <View className="flex-row justify-between mb-3">
            <Text className="text-muted">Frequency</Text>
            <Text className="text-foreground font-semibold">
              {getFrequencyLabel(payment.frequency)}
            </Text>
          </View>

          <View className="flex-row justify-between mb-3">
            <Text className="text-muted">Estimated Monthly</Text>
            <Text className="text-primary font-bold text-lg">${estimatedMonthly.toFixed(2)}</Text>
          </View>

          <View className="h-px bg-border my-3" />

          <View className="flex-row justify-between mb-3">
            <Text className="text-muted">Created</Text>
            <Text className="text-foreground font-semibold">
              {new Date(payment.createdDate).toLocaleDateString()}
            </Text>
          </View>

          <View className="flex-row justify-between">
            <Text className="text-muted">Days Active</Text>
            <Text className="text-foreground font-semibold">{daysSince} days</Text>
          </View>
        </View>

        {/* Status Info */}
        {payment.status === 'paused' ? (
          <View className="bg-warning/10 rounded-xl p-4 mb-6 border border-warning/30">
            <Text className="text-warning font-semibold mb-2">⏸️ Payment Paused</Text>
            <Text className="text-muted text-sm">
              This recurring payment is currently paused. No payments will be processed until you resume it.
            </Text>
          </View>
        ) : (
          <View className="bg-success/10 rounded-xl p-4 mb-6 border border-success/30">
            <Text className="text-success font-semibold mb-2">✓ Payment Active</Text>
            <Text className="text-muted text-sm">
              This payment will be automatically processed on the scheduled date. You'll receive a notification 1 day before.
            </Text>
          </View>
        )}

        {/* Actions */}
        <TouchableOpacity
          onPress={handleToggleStatus}
          className={`${payment.status === 'active' ? 'bg-warning/20 border-warning' : 'bg-success/20 border-success'} rounded-xl p-4 mb-3 border`}
          style={{ opacity: 1 }}
        >
          <Text className={`${payment.status === 'active' ? 'text-warning' : 'text-success'} text-center font-semibold text-lg`}>
            {payment.status === 'active' ? 'Pause Payment' : 'Resume Payment'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleDelete}
          className="bg-error/20 border border-error rounded-xl p-4 mb-6"
          style={{ opacity: 1 }}
        >
          <Text className="text-error text-center font-semibold text-lg">
            Delete Recurring Payment
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
