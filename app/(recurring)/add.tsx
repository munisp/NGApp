import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RECURRING_PAYMENTS_KEY = 'recurringPayments';

type Frequency = 'daily' | 'weekly' | 'monthly';

export default function AddRecurringPaymentScreen() {
  const router = useRouter();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const calculateNextDate = (freq: Frequency): Date => {
    const now = new Date();
    switch (freq) {
      case 'daily':
        now.setDate(now.getDate() + 1);
        break;
      case 'weekly':
        now.setDate(now.getDate() + 7);
        break;
      case 'monthly':
        now.setMonth(now.getMonth() + 1);
        break;
    }
    return now;
  };

  const handleSave = async () => {
    if (!recipient || !amount) {
      Alert.alert('Error', 'Please fill in recipient and amount');
      return;
    }

    const paymentAmount = parseFloat(amount);
    if (paymentAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      setIsSaving(true);

      // Load existing payments
      const stored = await AsyncStorage.getItem(RECURRING_PAYMENTS_KEY);
      const payments = stored ? JSON.parse(stored) : [];

      // Create new payment
      const newPayment = {
        id: Date.now().toString(),
        recipient,
        amount: paymentAmount,
        frequency,
        nextDate: calculateNextDate(frequency).toISOString(),
        status: 'active',
        note,
        createdDate: new Date().toISOString(),
      };

      payments.push(newPayment);
      await AsyncStorage.setItem(RECURRING_PAYMENTS_KEY, JSON.stringify(payments));

      Alert.alert('Success', 'Recurring payment added successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Failed to add recurring payment:', error);
      Alert.alert('Error', 'Failed to add recurring payment. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const frequencyOptions: { value: Frequency; label: string; description: string }[] = [
    { value: 'daily', label: 'Daily', description: 'Every day' },
    { value: 'weekly', label: 'Weekly', description: 'Every 7 days' },
    { value: 'monthly', label: 'Monthly', description: 'Every 30 days' },
  ];

  const estimatedMonthly = amount
    ? parseFloat(amount) * (frequency === 'daily' ? 30 : frequency === 'weekly' ? 4 : 1)
    : 0;

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Add Recurring Payment', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Instructions */}
        <View className="bg-primary/10 rounded-xl p-4 mb-6 border border-primary/30">
          <Text className="text-foreground font-semibold mb-2">Automatic Payments</Text>
          <Text className="text-muted text-sm">
            Set up automatic recurring payments for bills, subscriptions, or savings. You'll receive a notification before each payment is processed.
          </Text>
        </View>

        {/* Recipient */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold mb-2">Recipient *</Text>
          <TextInput
            value={recipient}
            onChangeText={setRecipient}
            placeholder="Who are you paying?"
            placeholderTextColor="#9BA1A6"
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
          />
        </View>

        {/* Amount */}
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

        {/* Frequency */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold mb-2">Frequency *</Text>
          <View className="gap-2">
            {frequencyOptions.map(option => (
              <TouchableOpacity
                key={option.value}
                onPress={() => setFrequency(option.value)}
                className={`px-4 py-4 rounded-xl flex-row items-center justify-between ${
                  frequency === option.value
                    ? 'bg-primary'
                    : 'bg-surface border border-border'
                }`}
                style={{ opacity: 1 }}
              >
                <View className="flex-1">
                  <Text
                    className={`font-semibold text-lg mb-1 ${
                      frequency === option.value ? 'text-white' : 'text-foreground'
                    }`}
                  >
                    {option.label}
                  </Text>
                  <Text
                    className={`text-sm ${
                      frequency === option.value ? 'text-white/80' : 'text-muted'
                    }`}
                  >
                    {option.description}
                  </Text>
                </View>
                {frequency === option.value && (
                  <Text className="text-white text-2xl">✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Note */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-2">Note (Optional)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="e.g., Netflix subscription, Rent payment"
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
              <Text className="text-muted">Payment Amount</Text>
              <Text className="text-foreground font-semibold">
                ${parseFloat(amount).toFixed(2)}
              </Text>
            </View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-muted">Frequency</Text>
              <Text className="text-foreground font-semibold">
                {frequencyOptions.find(f => f.value === frequency)?.label}
              </Text>
            </View>
            <View className="h-px bg-border my-2" />
            <View className="flex-row justify-between">
              <Text className="text-foreground font-bold">Estimated Monthly</Text>
              <Text className="text-primary font-bold text-xl">
                ${estimatedMonthly.toFixed(2)}
              </Text>
            </View>
          </View>
        )}

        {/* Important Notice */}
        <View className="bg-warning/10 rounded-xl p-4 mb-6 border border-warning/30">
          <Text className="text-foreground font-semibold mb-2">⚠️ Important</Text>
          <Text className="text-muted text-sm mb-2">
            • You'll receive a notification 1 day before each payment
          </Text>
          <Text className="text-muted text-sm mb-2">
            • Ensure sufficient balance in your account
          </Text>
          <Text className="text-muted text-sm">
            • You can pause or cancel anytime
          </Text>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          className="bg-primary rounded-xl p-4 mb-4"
          style={{ opacity: isSaving ? 0.6 : 1 }}
        >
          <Text className="text-white text-center font-semibold text-lg">
            {isSaving ? 'Setting Up...' : 'Set Up Recurring Payment'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          disabled={isSaving}
          className="bg-surface border border-border rounded-xl p-4 mb-6"
          style={{ opacity: isSaving ? 0.6 : 1 }}
        >
          <Text className="text-foreground text-center font-semibold text-lg">
            Cancel
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
