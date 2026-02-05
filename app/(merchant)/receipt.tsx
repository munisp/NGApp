import { View, Text, TouchableOpacity, ScrollView, Share } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

interface MerchantTransaction {
  id: string;
  merchantId: string;
  merchantName: string;
  category: string;
  amount: number;
  date: string;
  status: string;
}

const MERCHANT_TRANSACTIONS_KEY = 'merchantTransactions';

const categoryEmojis: { [key: string]: string } = {
  restaurant: '🍽️',
  grocery: '🛒',
  retail: '🛍️',
  gas: '⛽',
  entertainment: '🎬',
  health: '🏥',
  other: '🏪',
};

export default function MerchantReceiptScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const transactionId = params.id as string;

  const [transaction, setTransaction] = useState<MerchantTransaction | null>(null);

  useEffect(() => {
    loadTransaction();
  }, [transactionId]);

  const loadTransaction = async () => {
    try {
      const stored = await AsyncStorage.getItem(MERCHANT_TRANSACTIONS_KEY);
      if (stored) {
        const transactions: MerchantTransaction[] = JSON.parse(stored);
        const found = transactions.find(t => t.id === transactionId);
        if (found) {
          setTransaction(found);
        }
      }
    } catch (error) {
      console.error('Failed to load transaction:', error);
    }
  };

  const handleShare = async () => {
    if (!transaction) return;

    const message = `
Payment Receipt

Merchant: ${transaction.merchantName}
Amount: $${transaction.amount.toFixed(2)}
Date: ${new Date(transaction.date).toLocaleString()}
Transaction ID: ${transaction.id}
Status: ${transaction.status}
    `.trim();

    try {
      await Share.share({ message });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to share receipt:', error);
    }
  };

  if (!transaction) {
    return (
      <ScreenContainer className="p-4">
        <Stack.Screen options={{ title: 'Receipt', headerShown: true }} />
        <View className="flex-1 justify-center items-center">
          <Text className="text-muted">Receipt not found</Text>
        </View>
      </ScreenContainer>
    );
  }

  const emoji = categoryEmojis[transaction.category] || categoryEmojis.other;

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Payment Receipt', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Receipt Card */}
        <View className="bg-surface rounded-xl p-8 mb-6 border border-border">
          {/* Success Icon */}
          <View className="items-center mb-6">
            <View className="bg-success/20 rounded-full w-24 h-24 items-center justify-center mb-4">
              <Text className="text-6xl">✓</Text>
            </View>
            <Text className="text-success font-bold text-2xl mb-2">Payment Successful</Text>
            <Text className="text-muted">Transaction completed</Text>
          </View>

          {/* Amount */}
          <View className="items-center py-6 mb-6 border-y border-border">
            <Text className="text-muted mb-2">Amount Paid</Text>
            <Text className="text-foreground font-bold text-6xl">
              ${transaction.amount.toFixed(2)}
            </Text>
          </View>

          {/* Merchant Info */}
          <View className="mb-6">
            <View className="flex-row items-center mb-4">
              <Text className="text-5xl mr-4">{emoji}</Text>
              <View className="flex-1">
                <Text className="text-foreground font-bold text-xl mb-1">
                  {transaction.merchantName}
                </Text>
                <Text className="text-muted capitalize">{transaction.category}</Text>
              </View>
            </View>
          </View>

          {/* Transaction Details */}
          <View className="bg-background rounded-xl p-4 mb-4">
            <View className="flex-row justify-between mb-3 pb-3 border-b border-border">
              <Text className="text-muted">Transaction ID</Text>
              <Text className="text-foreground font-mono text-sm">{transaction.id}</Text>
            </View>

            <View className="flex-row justify-between mb-3 pb-3 border-b border-border">
              <Text className="text-muted">Date & Time</Text>
              <Text className="text-foreground">
                {new Date(transaction.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>

            <View className="flex-row justify-between mb-3 pb-3 border-b border-border">
              <Text className="text-muted">Merchant ID</Text>
              <Text className="text-foreground font-mono text-sm">{transaction.merchantId}</Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-muted">Status</Text>
              <View className="bg-success/20 px-3 py-1 rounded-full">
                <Text className="text-success font-semibold capitalize">{transaction.status}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Actions */}
        <TouchableOpacity
          onPress={handleShare}
          className="bg-primary rounded-xl p-4 mb-3"
          style={{ opacity: 1 }}
        >
          <Text className="text-white text-center font-semibold text-lg">📤 Share Receipt</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/(merchant)/history' as any)}
          className="bg-surface border border-border rounded-xl p-4 mb-3"
          style={{ opacity: 1 }}
        >
          <Text className="text-foreground text-center font-semibold text-lg">
            View All Transactions
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-surface border border-border rounded-xl p-4 mb-6"
          style={{ opacity: 1 }}
        >
          <Text className="text-foreground text-center font-semibold text-lg">Done</Text>
        </TouchableOpacity>

        {/* Info */}
        <View className="bg-primary/10 rounded-xl p-4 mb-6 border border-primary/30">
          <Text className="text-muted text-sm text-center">
            Keep this receipt for your records. You can access it anytime in your merchant payment
            history.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
