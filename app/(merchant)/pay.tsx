import { View, Text, TouchableOpacity, Alert, TextInput } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';

const MERCHANT_TRANSACTIONS_KEY = 'merchantTransactions';

interface MerchantData {
  merchantId: string;
  merchantName: string;
  category: string;
  amount?: number;
}

export default function MerchantPayScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [merchantData, setMerchantData] = useState<MerchantData | null>(null);
  const [amount, setAmount] = useState('');

  if (!permission) {
    return (
      <ScreenContainer className="p-4">
        <Stack.Screen options={{ title: 'Merchant Payment', headerShown: true }} />
        <View className="flex-1 justify-center items-center">
          <Text className="text-muted">Requesting camera permission...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!permission.granted) {
    return (
      <ScreenContainer className="p-4">
        <Stack.Screen options={{ title: 'Merchant Payment', headerShown: true }} />
        <View className="flex-1 justify-center items-center p-6">
          <Text className="text-6xl mb-4">📷</Text>
          <Text className="text-foreground font-semibold text-lg mb-2 text-center">
            Camera Permission Required
          </Text>
          <Text className="text-muted text-center mb-6">
            We need camera access to scan merchant QR codes for payments
          </Text>
          <TouchableOpacity
            onPress={requestPermission}
            className="bg-primary px-6 py-3 rounded-xl"
            style={{ opacity: 1 }}
          >
            <Text className="text-white font-semibold">Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;

    setScanned(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      // Parse merchant QR code data
      const parsed = JSON.parse(data);
      setMerchantData(parsed);
      if (parsed.amount) {
        setAmount(parsed.amount.toString());
      }
    } catch (error) {
      Alert.alert('Invalid QR Code', 'This is not a valid merchant payment QR code', [
        { text: 'OK', onPress: () => setScanned(false) },
      ]);
    }
  };

  const handlePayment = async () => {
    if (!merchantData) return;

    const payAmount = parseFloat(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount');
      return;
    }

    try {
      // Authenticate with biometrics
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: `Pay $${payAmount.toFixed(2)} to ${merchantData.merchantName}`,
          fallbackLabel: 'Use Passcode',
        });

        if (!result.success) {
          return;
        }
      }

      // Save transaction
      const transaction = {
        id: Date.now().toString(),
        merchantId: merchantData.merchantId,
        merchantName: merchantData.merchantName,
        category: merchantData.category,
        amount: payAmount,
        date: new Date().toISOString(),
        status: 'completed',
      };

      const stored = await AsyncStorage.getItem(MERCHANT_TRANSACTIONS_KEY);
      const transactions = stored ? JSON.parse(stored) : [];
      transactions.unshift(transaction);
      await AsyncStorage.setItem(MERCHANT_TRANSACTIONS_KEY, JSON.stringify(transactions));

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        'Payment Successful',
        `Paid $${payAmount.toFixed(2)} to ${merchantData.merchantName}`,
        [
          {
            text: 'View Receipt',
            onPress: () => router.push(`/(merchant)/receipt?id=${transaction.id}` as any),
          },
          { text: 'Done', onPress: () => router.back() },
        ]
      );
    } catch (error) {
      console.error('Payment failed:', error);
      Alert.alert('Payment Failed', 'Failed to process payment');
    }
  };

  if (merchantData) {
    return (
      <ScreenContainer className="p-4">
        <Stack.Screen options={{ title: 'Confirm Payment', headerShown: true }} />

        <View className="flex-1">
          {/* Merchant Info */}
          <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
            <View className="items-center mb-6">
              <Text className="text-6xl mb-4">🏪</Text>
              <Text className="text-foreground font-bold text-2xl mb-2">
                {merchantData.merchantName}
              </Text>
              <Text className="text-muted capitalize">{merchantData.category}</Text>
            </View>

            {/* Amount Input */}
            <View className="mb-4">
              <Text className="text-muted text-sm mb-2">Payment Amount</Text>
              <View className="flex-row items-center bg-background border border-border rounded-xl p-4">
                <Text className="text-foreground text-3xl mr-2">$</Text>
                <TextInput
                  className="flex-1 text-foreground text-3xl font-bold"
                  placeholder="0.00"
                  placeholderTextColor="#9BA1A6"
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                  editable={!merchantData.amount}
                />
              </View>
              {merchantData.amount && (
                <Text className="text-muted text-xs mt-2">
                  Amount set by merchant
                </Text>
              )}
            </View>
          </View>

          {/* Actions */}
          <TouchableOpacity
            onPress={handlePayment}
            className="bg-primary rounded-xl p-4 mb-3"
            style={{ opacity: 1 }}
          >
            <Text className="text-white text-center font-semibold text-lg">
              Pay ${parseFloat(amount || '0').toFixed(2)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setMerchantData(null);
              setScanned(false);
              setAmount('');
            }}
            className="bg-surface border border-border rounded-xl p-4"
            style={{ opacity: 1 }}
          >
            <Text className="text-foreground text-center font-semibold text-lg">
              Scan Different Code
            </Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: 'Scan Merchant QR', headerShown: true }} />

      <View className="flex-1">
        <CameraView
          style={{ flex: 1 }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        />

        {/* Overlay */}
        <View className="absolute inset-0 items-center justify-center">
          <View className="w-64 h-64 border-4 border-white rounded-3xl" />
          <Text className="text-white font-semibold text-lg mt-6">
            Scan merchant QR code
          </Text>
        </View>

        {/* Cancel Button */}
        <View className="absolute bottom-8 left-0 right-0 px-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-white rounded-xl p-4"
            style={{ opacity: 0.9 }}
          >
            <Text className="text-foreground text-center font-semibold text-lg">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}
