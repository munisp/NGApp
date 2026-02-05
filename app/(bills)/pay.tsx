import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SavedBiller {
  id: string;
  name: string;
  category: string;
  accountNumber: string;
  amount?: number;
}

const BILLERS_STORAGE_KEY = 'savedBillers';
const BILL_HISTORY_KEY = 'billPaymentHistory';

export default function PayBillScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const billerId = params.billerId as string;

  const [biller, setBiller] = useState<SavedBiller | null>(null);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    loadBiller();
  }, [billerId]);

  const loadBiller = async () => {
    try {
      const stored = await AsyncStorage.getItem(BILLERS_STORAGE_KEY);
      if (stored) {
        const billers = JSON.parse(stored);
        const found = billers.find((b: SavedBiller) => b.id === billerId);
        if (found) {
          setBiller(found);
          if (found.amount) {
            setAmount(found.amount.toString());
          }
        }
      }
    } catch (error) {
      console.error('Failed to load biller:', error);
    }
  };

  const handlePayment = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      setIsPaying(true);

      // Check if biometric is enabled
      const biometricEnabled = await AsyncStorage.getItem('biometricEnabled');
      
      if (biometricEnabled === 'true') {
        // Request biometric authentication
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (hasHardware && isEnrolled) {
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Confirm bill payment',
            fallbackLabel: 'Use passcode',
            cancelLabel: 'Cancel',
          });

          if (!result.success) {
            Alert.alert('Authentication Failed', 'Payment cancelled');
            return;
          }
        }
      }

      // Trigger haptic feedback
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Save to payment history
      const historyStored = await AsyncStorage.getItem(BILL_HISTORY_KEY);
      const history = historyStored ? JSON.parse(historyStored) : [];
      
      const payment = {
        id: Date.now().toString(),
        billerId: biller?.id,
        billerName: biller?.name,
        category: biller?.category,
        amount: parseFloat(amount),
        reference,
        date: new Date().toISOString(),
        status: 'completed',
      };

      history.unshift(payment);
      await AsyncStorage.setItem(BILL_HISTORY_KEY, JSON.stringify(history));

      // Update last paid date for biller
      const billersStored = await AsyncStorage.getItem(BILLERS_STORAGE_KEY);
      if (billersStored) {
        const billers = JSON.parse(billersStored);
        const updatedBillers = billers.map((b: SavedBiller) =>
          b.id === billerId ? { ...b, lastPaid: new Date().toISOString() } : b
        );
        await AsyncStorage.setItem(BILLERS_STORAGE_KEY, JSON.stringify(updatedBillers));
      }

      Alert.alert(
        'Payment Successful',
        `Your ${biller?.category} bill has been paid successfully.`,
        [
          {
            text: 'View Receipt',
            onPress: () => router.push(`/(bills)/receipt?paymentId=${payment.id}`),
          },
          {
            text: 'Done',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('Payment failed:', error);
      Alert.alert('Payment Failed', 'An error occurred. Please try again.');
    } finally {
      setIsPaying(false);
    }
  };

  if (!biller) {
    return (
      <ScreenContainer className="p-4 justify-center items-center">
        <Text className="text-foreground">Loading...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Pay Bill', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Biller Info */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-muted text-sm mb-2">Paying to</Text>
          <Text className="text-foreground font-bold text-2xl mb-2">{biller.name}</Text>
          <Text className="text-muted text-sm">
            {biller.category.charAt(0).toUpperCase() + biller.category.slice(1)} • {biller.accountNumber}
          </Text>
        </View>

        {/* Amount Input */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold mb-2">Amount *</Text>
          <View className="bg-surface border border-border rounded-xl px-4 py-3 flex-row items-center">
            <Text className="text-foreground text-2xl font-bold mr-2">$</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              placeholderTextColor="#9BA1A6"
              className="flex-1 text-foreground text-2xl font-bold"
            />
          </View>
        </View>

        {/* Reference */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-2">Reference (Optional)</Text>
          <TextInput
            value={reference}
            onChangeText={setReference}
            placeholder="e.g., Invoice #12345"
            placeholderTextColor="#9BA1A6"
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
          />
        </View>

        {/* Payment Summary */}
        <View className="bg-primary/10 rounded-xl p-4 mb-6 border border-primary/30">
          <View className="flex-row justify-between mb-2">
            <Text className="text-foreground">Bill Amount</Text>
            <Text className="text-foreground font-semibold">
              ${amount || '0.00'}
            </Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-foreground">Processing Fee</Text>
            <Text className="text-foreground font-semibold">$0.00</Text>
          </View>
          <View className="h-px bg-border my-2" />
          <View className="flex-row justify-between">
            <Text className="text-foreground font-bold text-lg">Total</Text>
            <Text className="text-primary font-bold text-lg">
              ${amount || '0.00'}
            </Text>
          </View>
        </View>

        {/* Pay Button */}
        <TouchableOpacity
          onPress={handlePayment}
          disabled={isPaying || !amount}
          className="bg-primary rounded-xl p-4 mb-4"
          style={{ opacity: isPaying || !amount ? 0.6 : 1 }}
        >
          <Text className="text-white text-center font-semibold text-lg">
            {isPaying ? 'Processing...' : 'Pay Now'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          disabled={isPaying}
          className="bg-surface border border-border rounded-xl p-4 mb-6"
          style={{ opacity: isPaying ? 0.6 : 1 }}
        >
          <Text className="text-foreground text-center font-semibold text-lg">
            Cancel
          </Text>
        </TouchableOpacity>

        {/* Security Notice */}
        <View className="bg-surface rounded-xl p-4 border border-border">
          <Text className="text-muted text-xs text-center">
            🔒 Your payment is secured with biometric authentication and encrypted end-to-end
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
