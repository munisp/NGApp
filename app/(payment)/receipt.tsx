import { View, Text, TouchableOpacity, Share } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';

export default function PaymentReceiptScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    payment_id: string;
    amount: string;
    recipient: string;
  }>();

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Payment Receipt\nAmount: USD ${params.amount}\nRecipient: ${params.recipient}\nPayment ID: ${params.payment_id}`,
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  return (
    <ScreenContainer className="p-6">
      <Stack.Screen options={{ title: 'Payment Receipt' }} />

      <View className="flex-1 justify-center items-center">
        {/* Success Icon */}
        <View className="bg-success/20 rounded-full p-8 mb-6">
          <Text className="text-6xl">✓</Text>
        </View>

        {/* Success Message */}
        <Text className="text-2xl font-bold text-foreground mb-2">Payment Successful!</Text>
        <Text className="text-muted text-center mb-8">
          Your payment has been processed successfully
        </Text>

        {/* Payment Details */}
        <View className="w-full bg-surface rounded-2xl p-6 mb-6 border border-border">
          <View className="mb-4">
            <Text className="text-muted text-sm mb-1">Amount</Text>
            <Text className="text-3xl font-bold text-foreground">USD {params.amount}</Text>
          </View>

          <View className="border-t border-border pt-4 mb-4">
            <Text className="text-muted text-sm mb-1">Recipient</Text>
            <Text className="text-foreground text-lg">{params.recipient}</Text>
          </View>

          <View className="border-t border-border pt-4">
            <Text className="text-muted text-sm mb-1">Transaction ID</Text>
            <Text className="text-foreground text-sm font-mono">{params.payment_id}</Text>
          </View>
        </View>

        {/* Actions */}
        <View className="w-full gap-3">
          <TouchableOpacity
            onPress={handleShare}
            className="bg-primary rounded-xl p-4"
            style={{ opacity: 1 }}
          >
            <Text className="text-white text-center font-semibold text-lg">Share Receipt</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(tabs)')}
            className="bg-surface border border-border rounded-xl p-4"
            style={{ opacity: 1 }}
          >
            <Text className="text-foreground text-center font-semibold text-lg">Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}
