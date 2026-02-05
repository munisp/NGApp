import { View, Text, TouchableOpacity, ScrollView, Share, Platform } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface BillPayment {
  id: string;
  billerName: string;
  category: string;
  amount: number;
  reference?: string;
  date: string;
  status: string;
}

const BILL_HISTORY_KEY = 'billPaymentHistory';

export default function BillReceiptScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const paymentId = params.paymentId as string;

  const [payment, setPayment] = useState<BillPayment | null>(null);

  useEffect(() => {
    loadPayment();
  }, [paymentId]);

  const loadPayment = async () => {
    try {
      const stored = await AsyncStorage.getItem(BILL_HISTORY_KEY);
      if (stored) {
        const payments = JSON.parse(stored);
        const found = payments.find((p: BillPayment) => p.id === paymentId);
        if (found) {
          setPayment(found);
        }
      }
    } catch (error) {
      console.error('Failed to load payment:', error);
    }
  };

  const handleShare = async () => {
    if (!payment) return;

    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const message = `
Bill Payment Receipt

Biller: ${payment.billerName}
Category: ${payment.category}
Amount: $${payment.amount.toFixed(2)}
${payment.reference ? `Reference: ${payment.reference}\n` : ''}Date: ${new Date(payment.date).toLocaleString()}
Status: ${payment.status}
Transaction ID: ${payment.id}
    `.trim();

    try {
      await Share.share({
        message,
        title: 'Bill Payment Receipt',
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  if (!payment) {
    return (
      <ScreenContainer className="p-4 justify-center items-center">
        <Text className="text-foreground">Loading receipt...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Payment Receipt', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Success Icon */}
        <View className="items-center mb-6">
          <View className="w-20 h-20 bg-success/20 rounded-full items-center justify-center mb-4">
            <Text className="text-5xl">✓</Text>
          </View>
          <Text className="text-foreground font-bold text-2xl mb-2">Payment Successful</Text>
          <Text className="text-muted text-center">
            Your bill payment has been processed
          </Text>
        </View>

        {/* Receipt Details */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <View className="mb-4">
            <Text className="text-muted text-sm mb-1">Biller</Text>
            <Text className="text-foreground font-semibold text-lg">{payment.billerName}</Text>
          </View>

          <View className="mb-4">
            <Text className="text-muted text-sm mb-1">Category</Text>
            <Text className="text-foreground font-semibold text-lg">
              {payment.category.charAt(0).toUpperCase() + payment.category.slice(1)}
            </Text>
          </View>

          <View className="mb-4">
            <Text className="text-muted text-sm mb-1">Amount Paid</Text>
            <Text className="text-primary font-bold text-3xl">${payment.amount.toFixed(2)}</Text>
          </View>

          {payment.reference && (
            <View className="mb-4">
              <Text className="text-muted text-sm mb-1">Reference</Text>
              <Text className="text-foreground font-semibold text-lg">{payment.reference}</Text>
            </View>
          )}

          <View className="mb-4">
            <Text className="text-muted text-sm mb-1">Date & Time</Text>
            <Text className="text-foreground font-semibold text-lg">
              {new Date(payment.date).toLocaleString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>

          <View className="mb-4">
            <Text className="text-muted text-sm mb-1">Transaction ID</Text>
            <Text className="text-foreground font-mono text-sm">{payment.id}</Text>
          </View>

          <View>
            <Text className="text-muted text-sm mb-1">Status</Text>
            <View
              className={`self-start px-3 py-1 rounded ${
                payment.status === 'completed' ? 'bg-success/20' : 'bg-warning/20'
              }`}
            >
              <Text
                className={`font-semibold ${
                  payment.status === 'completed' ? 'text-success' : 'text-warning'
                }`}
              >
                {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          onPress={handleShare}
          className="bg-primary rounded-xl p-4 mb-3"
          style={{ opacity: 1 }}
        >
          <Text className="text-white text-center font-semibold text-lg">
            Share Receipt
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/(bills)')}
          className="bg-surface border border-border rounded-xl p-4 mb-3"
          style={{ opacity: 1 }}
        >
          <Text className="text-foreground text-center font-semibold text-lg">
            Back to Bills
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/(tabs)')}
          className="bg-surface border border-border rounded-xl p-4 mb-6"
          style={{ opacity: 1 }}
        >
          <Text className="text-foreground text-center font-semibold text-lg">
            Go to Home
          </Text>
        </TouchableOpacity>

        {/* Footer */}
        <View className="bg-surface rounded-xl p-4 border border-border">
          <Text className="text-muted text-xs text-center">
            Keep this receipt for your records. For support, contact your biller directly.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
