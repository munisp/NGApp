import { View, Text, TextInput, TouchableOpacity, ScrollView, Share, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import QRCode from 'react-native-qrcode-svg';
import { ScreenContainer } from '@/components/screen-container';

export default function QRGenerateScreen() {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [recipientId, setRecipientId] = useState('USER_12345'); // In production, get from auth context

  const generateQRData = (): string => {
    const params = new URLSearchParams();
    params.append('recipient', recipientId);
    if (amount) params.append('amount', amount);
    if (note) params.append('note', note);
    
    return `fintech://pay?${params.toString()}`;
  };

  const handleShare = async () => {
    try {
      const qrData = generateQRData();
      await Share.share({
        message: `Pay me using this QR code:\n\n${qrData}\n\nAmount: ${amount ? `$${amount}` : 'Any amount'}\nNote: ${note || 'No note'}`,
        title: 'Payment QR Code',
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const qrData = generateQRData();

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Request Payment', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Instructions */}
        <View className="bg-primary/10 rounded-xl p-4 mb-6 border border-primary/30">
          <Text className="text-foreground font-semibold mb-2">How it works</Text>
          <Text className="text-muted text-sm">
            1. Enter the amount you want to receive (optional){'\n'}
            2. Add a note to describe the payment{'\n'}
            3. Show the QR code to the payer{'\n'}
            4. They scan it and confirm the payment
          </Text>
        </View>

        {/* Amount Input */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold mb-2">Amount (Optional)</Text>
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
          <Text className="text-muted text-sm mt-2">
            Leave empty to let the payer enter the amount
          </Text>
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

        {/* QR Code Display */}
        <View className="bg-surface rounded-xl p-8 mb-6 border border-border items-center">
          <Text className="text-foreground font-bold text-lg mb-4">Your Payment QR Code</Text>
          
          <View className="bg-white p-6 rounded-2xl mb-4">
            <QRCode
              value={qrData}
              size={200}
              backgroundColor="white"
              color="black"
            />
          </View>

          <View className="items-center">
            <Text className="text-muted text-sm mb-1">Recipient ID</Text>
            <Text className="text-foreground font-mono font-semibold">{recipientId}</Text>
          </View>

          {amount && (
            <View className="items-center mt-3">
              <Text className="text-muted text-sm mb-1">Requesting</Text>
              <Text className="text-primary font-bold text-3xl">${amount}</Text>
            </View>
          )}

          {note && (
            <View className="items-center mt-3">
              <Text className="text-muted text-sm mb-1">Note</Text>
              <Text className="text-foreground text-center">{note}</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          onPress={handleShare}
          className="bg-primary rounded-xl p-4 mb-4 flex-row items-center justify-center"
          style={{ opacity: 1 }}
        >
          <Text className="text-white text-xl mr-2">📤</Text>
          <Text className="text-white font-semibold text-lg">Share QR Code</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-surface border border-border rounded-xl p-4 mb-6"
          style={{ opacity: 1 }}
        >
          <Text className="text-foreground text-center font-semibold text-lg">
            Done
          </Text>
        </TouchableOpacity>

        {/* Tips */}
        <View className="bg-surface rounded-xl p-4 border border-border">
          <Text className="text-foreground font-semibold mb-2">💡 Tips</Text>
          <Text className="text-muted text-sm mb-2">
            • Make sure the QR code is well-lit and clearly visible
          </Text>
          <Text className="text-muted text-sm mb-2">
            • You can save a screenshot of this QR code to share later
          </Text>
          <Text className="text-muted text-sm">
            • The QR code works even without internet connection
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
