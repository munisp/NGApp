import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface BillPayment {
  id: string;
  billerName: string;
  category: string;
  amount: number;
  reference?: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
}

const BILL_HISTORY_KEY = 'billPaymentHistory';

const categoryIcons: Record<string, string> = {
  electricity: '⚡',
  water: '💧',
  internet: '🌐',
  phone: '📱',
  gas: '🔥',
  cable: '📺',
};

export default function BillHistoryScreen() {
  const router = useRouter();
  const [payments, setPayments] = useState<BillPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      const stored = await AsyncStorage.getItem(BILL_HISTORY_KEY);
      if (stored) {
        setPayments(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load payment history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderPayment = ({ item }: { item: BillPayment }) => {
    return (
      <TouchableOpacity
        onPress={() => router.push(`/(bills)/receipt?paymentId=${item.id}`)}
        className="bg-surface rounded-xl p-4 mb-3 border border-border"
        style={{ opacity: 1 }}
      >
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center flex-1">
            <View className="w-10 h-10 bg-primary/20 rounded-full items-center justify-center mr-3">
              <Text className="text-xl">{categoryIcons[item.category] || '💳'}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-foreground font-semibold text-base mb-1">
                {item.billerName}
              </Text>
              <Text className="text-muted text-sm">
                {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                {item.reference && ` • ${item.reference}`}
              </Text>
            </View>
          </View>
          <Text className="text-foreground font-bold text-lg">
            ${item.amount.toFixed(2)}
          </Text>
        </View>
        <View className="flex-row justify-between items-center">
          <Text className="text-muted text-xs">
            {new Date(item.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          <View
            className={`px-2 py-1 rounded ${
              item.status === 'completed'
                ? 'bg-success/20'
                : item.status === 'pending'
                ? 'bg-warning/20'
                : 'bg-error/20'
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                item.status === 'completed'
                  ? 'text-success'
                  : item.status === 'pending'
                  ? 'text-warning'
                  : 'text-error'
              }`}
            >
              {item.status}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Payment History', headerShown: true }} />

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0a7ea4" />
        </View>
      ) : payments.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-6xl mb-4">📋</Text>
          <Text className="text-foreground font-semibold text-lg mb-2">No Payment History</Text>
          <Text className="text-muted text-center mb-6">
            Your bill payment history will appear here
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-primary rounded-xl px-6 py-3"
            style={{ opacity: 1 }}
          >
            <Text className="text-white font-semibold">Go Back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text className="text-muted text-sm mb-3">
            Showing {payments.length} payment{payments.length !== 1 ? 's' : ''}
          </Text>
          <FlatList
            data={payments}
            renderItem={renderPayment}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </ScreenContainer>
  );
}
