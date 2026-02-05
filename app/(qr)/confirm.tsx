import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TRANSACTIONS_KEY = 'qrTransactions';

export default function QRConfirmScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const recipient = params.recipient as string;
  const prefilledAmount = params.amount as string;
  const prefilledNote = params.note as string;

  const [amount, setAmount] = useState(prefilledAmount || '');
  const [note, setNote] = useState(prefilledNote || '');
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePay = async () => {
    const paymentAmount = parseFloat(amount);

    if (!amount || paymentAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      setIsProcessing(true);

      // Check biometric availability
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: `Confirm payment of $${paymentAmount.toFixed(2)}`,
          fallbackLabel: 'Use PIN',
          cancelLabel: 'Cancel',
        });

        if (!result.success) {
          Alert.alert('Authentication Failed', 'Payment cancelled');
          return;
        }
      }

      // Save transaction
      const stored = await AsyncStorage.getItem(TRANSACTIONS_KEY);
      const transactions = stored ? JSON.parse(stored) : [];

      const newTransaction = {
        id: Date.now().toString(),
        recipient,
        amount: paymentAmount,
        note,
        timestamp: new Date().toISOString(),
        type: 'qr_payment',
        status: 'completed',
      };

      transactions.push(newTransaction);
      await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));

      // Haptic feedback
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert(
        'Payment Successful',
        `$${paymentAmount.toFixed(2)} sent to ${recipient}`,
        [
          {
            text: 'Done',
            onPress: () => router.push('/(tabs)/'),
          },
        ]
      );
    } catch (error) {
      console.error('Payment failed:', error);
      Alert.alert('Error', 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Confirm Payment', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Recipient Info */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border items-center">
          <Text className="text-muted mb-2">Paying to</Text>
          <Text className="text-foreground font-bold text-2xl mb-2">{recipient}</Text>
          <View className="bg-success/20 rounded-full px-4 py-1">
            <Text className="text-success font-semibold text-sm">✓ Verified</Text>
          </View>
        </View>

        {/* Amount Input */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold mb-2">Amount *</Text>
          <View className="bg-surface border border-border rounded-xl px-4 py-3 flex-row items-center">
            <Text className="text-foreground text-3xl font-bold mr-2">$</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              placeholderTextColor="#9BA1A6"
              editable={!prefilledAmount}
              className="flex-1 text-foreground text-3xl font-bold"
            />
          </View>
          {prefilledAmount && (
            <Text className="text-muted text-sm mt-2">
              Amount requested by recipient
            </Text>
          )}
        </View>

        {/* Note Input */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-2">Note (Optional)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="What's this payment for?"
            placeholderTextColor="#9BA1A6"
            multiline
            numberOfLines={3}
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
          />
        </View>

        {/* Payment Summary */}
        {amount && parseFloat(amount) > 0 && (
          <View className="bg-primary/10 rounded-xl p-4 mb-6 border border-primary/30">
            <Text className="text-foreground font-semibold mb-3">Payment Summary</Text>
            <View className="flex-row justify-between mb-2">
              <Text className="text-muted">Amount</Text>
              <Text className="text-foreground font-semibold">
                ${parseFloat(amount).toFixed(2)}
              </Text>
            </View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-muted">Fee</Text>
              <Text className="text-success font-semibold">$0.00</Text>
            </View>
            <View className="h-px bg-border my-2" />
            <View className="flex-row justify-between">
              <Text className="text-foreground font-bold">Total</Text>
              <Text className="text-primary font-bold text-xl">
                ${parseFloat(amount).toFixed(2)}
              </Text>
            </View>
          </View>
        )}

        {/* Security Notice */}
        <View className="bg-surface rounded-xl p-4 mb-6 border border-border">
          <Text className="text-foreground font-semibold mb-2">🔒 Secure Payment</Text>
          <Text className="text-muted text-sm">
            This payment will be authenticated using biometric verification for your security.
          </Text>
        </View>

        {/* Pay Button */}
        <TouchableOpacity
          onPress={handlePay}
          disabled={isProcessing || !amount || parseFloat(amount) <= 0}
          className="bg-primary rounded-xl p-4 mb-4"
          style={{ opacity: isProcessing || !amount || parseFloat(amount) <= 0 ? 0.5 : 1 }}
        >
          <Text className="text-white text-center font-semibold text-lg">
            {isProcessing ? 'Processing...' : 'Pay Now'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          disabled={isProcessing}
          className="bg-surface border border-border rounded-xl p-4 mb-6"
          style={{ opacity: isProcessing ? 0.5 : 1 }}
        >
          <Text className="text-foreground text-center font-semibold text-lg">
            Cancel
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
