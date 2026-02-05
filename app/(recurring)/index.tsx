import { View, Text, TouchableOpacity, FlatList, Alert, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
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

export default function RecurringPaymentsScreen() {
  const router = useRouter();
  const [payments, setPayments] = useState<RecurringPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      setIsLoading(true);
      const stored = await AsyncStorage.getItem(RECURRING_PAYMENTS_KEY);
      if (stored) {
        setPayments(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load recurring payments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (payment: RecurringPayment) => {
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
              const updated = payments.map(p =>
                p.id === payment.id ? { ...p, status: newStatus as 'active' | 'paused' } : p
              );
              setPayments(updated);
              await AsyncStorage.setItem(RECURRING_PAYMENTS_KEY, JSON.stringify(updated));
            } catch (error) {
              console.error('Failed to update payment:', error);
              Alert.alert('Error', 'Failed to update payment status');
            }
          },
        },
      ]
    );
  };

  const handleDelete = async (payment: RecurringPayment) => {
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
              const updated = payments.filter(p => p.id !== payment.id);
              setPayments(updated);
              await AsyncStorage.setItem(RECURRING_PAYMENTS_KEY, JSON.stringify(updated));
            } catch (error) {
              console.error('Failed to delete payment:', error);
              Alert.alert('Error', 'Failed to delete payment');
            }
          },
        },
      ]
    );
  };

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

  const renderPayment = ({ item }: { item: RecurringPayment }) => {
    const daysUntil = getDaysUntilNext(item.nextDate);

    return (
      <TouchableOpacity
        onPress={() => router.push(`/(recurring)/${item.id}` as any)}
        className="bg-surface rounded-xl p-4 mb-3 border border-border"
        style={{ opacity: 1 }}
      >
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-1">
            <Text className="text-foreground font-bold text-lg mb-1">
              {item.recipient}
            </Text>
            <Text className="text-muted text-sm">{item.note || 'No description'}</Text>
          </View>
          <View className="items-end">
            <Text className="text-primary font-bold text-2xl">
              ${item.amount.toFixed(2)}
            </Text>
            <View className={`${item.status === 'active' ? 'bg-success/20' : 'bg-warning/20'} rounded px-2 py-0.5 mt-1`}>
              <Text className={`${item.status === 'active' ? 'text-success' : 'text-warning'} text-xs font-semibold`}>
                {item.status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-muted text-xs mb-1">Frequency</Text>
            <Text className="text-foreground font-medium">
              {getFrequencyLabel(item.frequency)}
            </Text>
          </View>
          <View className="flex-1 items-center">
            <Text className="text-muted text-xs mb-1">Next Payment</Text>
            <Text className="text-foreground font-medium">
              {item.status === 'active'
                ? daysUntil === 0
                  ? 'Today'
                  : `In ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`
                : 'Paused'}
            </Text>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => handleToggleStatus(item)}
              className={`${item.status === 'active' ? 'bg-warning/20' : 'bg-success/20'} rounded-lg px-3 py-2`}
              style={{ opacity: 1 }}
            >
              <Text className={`${item.status === 'active' ? 'text-warning' : 'text-success'} text-xs font-semibold`}>
                {item.status === 'active' ? 'Pause' : 'Resume'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDelete(item)}
              className="bg-error/20 rounded-lg px-3 py-2"
              style={{ opacity: 1 }}
            >
              <Text className="text-error text-xs font-semibold">Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const activePayments = payments.filter(p => p.status === 'active');
  const pausedPayments = payments.filter(p => p.status === 'paused');
  const totalMonthly = activePayments.reduce((sum, p) => {
    const multiplier = p.frequency === 'daily' ? 30 : p.frequency === 'weekly' ? 4 : 1;
    return sum + (p.amount * multiplier);
  }, 0);

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Recurring Payments', headerShown: true }} />

      {/* Summary */}
      {payments.length > 0 && (
        <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30">
          <Text className="text-foreground font-bold text-xl mb-2">Monthly Total</Text>
          <Text className="text-primary font-bold text-5xl mb-3">
            ${totalMonthly.toFixed(2)}
          </Text>
          <View className="flex-row justify-between">
            <View>
              <Text className="text-muted text-sm mb-1">Active</Text>
              <Text className="text-foreground font-semibold">{activePayments.length}</Text>
            </View>
            <View>
              <Text className="text-muted text-sm mb-1">Paused</Text>
              <Text className="text-foreground font-semibold">{pausedPayments.length}</Text>
            </View>
            <View>
              <Text className="text-muted text-sm mb-1">Total</Text>
              <Text className="text-foreground font-semibold">{payments.length}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Add Payment Button */}
      <TouchableOpacity
        onPress={() => router.push('/(recurring)/add' as any)}
        className="bg-primary rounded-xl p-4 mb-6 flex-row items-center justify-center"
        style={{ opacity: 1 }}
      >
        <Text className="text-white text-2xl mr-2">+</Text>
        <Text className="text-white font-semibold text-lg">Add Recurring Payment</Text>
      </TouchableOpacity>

      {/* Payments List */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0a7ea4" />
        </View>
      ) : payments.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-6xl mb-4">🔄</Text>
          <Text className="text-foreground font-semibold text-lg mb-2">
            No Recurring Payments
          </Text>
          <Text className="text-muted text-center mb-6">
            Set up automatic payments for bills and subscriptions
          </Text>
        </View>
      ) : (
        <FlatList
          data={payments}
          renderItem={renderPayment}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}
