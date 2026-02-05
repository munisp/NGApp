import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
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

export default function ScheduledPaymentDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const paymentId = params.id as string;

  const [payment, setPayment] = useState<ScheduledPayment | null>(null);

  useEffect(() => {
    loadPayment();
  }, [paymentId]);

  const loadPayment = async () => {
    try {
      const stored = await AsyncStorage.getItem(SCHEDULED_PAYMENTS_KEY);
      if (stored) {
        const payments: ScheduledPayment[] = JSON.parse(stored);
        const found = payments.find(p => p.id === paymentId);
        if (found) {
          setPayment(found);
        }
      }
    } catch (error) {
      console.error('Failed to load payment:', error);
    }
  };

  const cancelPayment = async () => {
    if (!payment) return;

    try {
      const stored = await AsyncStorage.getItem(SCHEDULED_PAYMENTS_KEY);
      if (stored) {
        const payments: ScheduledPayment[] = JSON.parse(stored);
        const updated = payments.map(p =>
          p.id === paymentId ? { ...p, status: 'cancelled' as const } : p
        );
        await AsyncStorage.setItem(SCHEDULED_PAYMENTS_KEY, JSON.stringify(updated));
        setPayment({ ...payment, status: 'cancelled' });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', 'Payment cancelled');
      }
    } catch (error) {
      console.error('Failed to cancel payment:', error);
    }
  };

  const confirmCancel = () => {
    Alert.alert(
      'Cancel Payment',
      'Are you sure you want to cancel this scheduled payment?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: cancelPayment,
        },
      ]
    );
  };

  if (!payment) {
    return (
      <ScreenContainer className="p-4">
        <Stack.Screen options={{ title: 'Payment Detail', headerShown: true }} />
        <View className="flex-1 justify-center items-center">
          <Text className="text-muted">Loading...</Text>
        </View>
      </ScreenContainer>
    );
  }

  const getFrequencyLabel = (frequency: string) => {
    const labels: { [key: string]: string } = {
      once: 'One-time',
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
    };
    return labels[frequency] || frequency;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-warning/20 text-warning';
      case 'completed':
        return 'bg-success/20 text-success';
      case 'cancelled':
        return 'bg-error/20 text-error';
      default:
        return 'bg-muted/20 text-muted';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return '⏳ Pending';
      case 'completed':
        return '✓ Completed';
      case 'cancelled':
        return '✕ Cancelled';
      default:
        return status;
    }
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: payment.title, headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Amount Card */}
        <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30">
          <Text className="text-foreground font-bold text-4xl mb-2">
            ${payment.amount.toLocaleString()}
          </Text>
          <Text className="text-muted mb-1">{payment.title}</Text>
          <Text className="text-muted text-sm">To: {payment.recipient}</Text>
        </View>

        {/* Status */}
        <View className={`rounded-xl p-4 mb-6 border ${getStatusColor(payment.status)}`}>
          <Text className={`text-center font-semibold text-lg ${getStatusColor(payment.status).split(' ')[1]}`}>
            {getStatusLabel(payment.status)}
          </Text>
        </View>

        {/* Details */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-4">Payment Details</Text>

          <View className="gap-4">
            <View className="flex-row justify-between">
              <Text className="text-muted">Scheduled Date</Text>
              <Text className="text-foreground font-semibold">
                {new Date(payment.scheduledDate).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-muted">Frequency</Text>
              <Text className="text-foreground font-semibold">
                {getFrequencyLabel(payment.frequency)}
              </Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-muted">Created On</Text>
              <Text className="text-foreground font-semibold">
                {new Date(payment.createdAt).toLocaleDateString()}
              </Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-muted">Status</Text>
              <View className={`px-3 py-1 rounded-full ${getStatusColor(payment.status)}`}>
                <Text className={`text-xs font-semibold ${getStatusColor(payment.status).split(' ')[1]}`}>
                  {payment.status.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Actions */}
        {payment.status === 'pending' && (
          <View className="gap-3 mb-6">
            <TouchableOpacity
              onPress={confirmCancel}
              className="bg-error rounded-xl p-4"
              style={{ opacity: 1 }}
            >
              <Text className="text-white text-center font-semibold text-lg">
                Cancel Payment
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => Alert.alert('Edit', 'Edit feature coming soon!')}
              className="bg-surface border border-border rounded-xl p-4"
              style={{ opacity: 1 }}
            >
              <Text className="text-foreground text-center font-semibold text-lg">
                Edit Payment
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Info */}
        <View className="bg-primary/5 rounded-xl p-4 border border-primary/20">
          <Text className="text-muted text-sm text-center">
            {payment.status === 'pending' &&
              'This payment will be automatically executed on the scheduled date.'}
            {payment.status === 'completed' && 'This payment has been successfully completed.'}
            {payment.status === 'cancelled' && 'This payment has been cancelled and will not be executed.'}
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
