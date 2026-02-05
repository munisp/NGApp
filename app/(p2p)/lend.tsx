import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LendMoneyScreen() {
  const router = useRouter();
  const [contact, setContact] = useState('');
  const [amount, setAmount] = useState('');
  const [interestRate, setInterestRate] = useState('5');
  const [duration, setDuration] = useState('90');

  const calculateRepayment = () => {
    const principal = parseFloat(amount) || 0;
    const rate = parseFloat(interestRate) || 0;
    const total = principal * (1 + rate / 100);
    return total;
  };

  const handleLend = async () => {
    if (!contact || !amount || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Input', 'Please fill in all fields correctly');
      return;
    }

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // In a real app, save to backend
      const newLoan = {
        id: Date.now().toString(),
        type: 'lent',
        contact,
        amount: parseFloat(amount),
        interestRate: parseFloat(interestRate),
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + parseInt(duration) * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
        amountPaid: 0,
      };

      const stored = await AsyncStorage.getItem('p2pLoans');
      const loans = stored ? JSON.parse(stored) : [];
      loans.push(newLoan);
      await AsyncStorage.setItem('p2pLoans', JSON.stringify(loans));

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert(
        'Loan Created',
        `You've lent $${amount} to ${contact}`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Failed to create loan:', error);
      Alert.alert('Error', 'Failed to create loan');
    }
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Lend Money', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-foreground font-bold text-3xl mb-2">Lend Money</Text>
          <Text className="text-muted">Set up a loan agreement with a contact</Text>
        </View>

        {/* Form */}
        <View className="gap-5">
          {/* Contact Name */}
          <View>
            <Text className="text-foreground font-semibold mb-2">Contact Name</Text>
            <TextInput
              value={contact}
              onChangeText={setContact}
              placeholder="Enter contact name"
              placeholderTextColor="#9BA1A6"
              className="bg-surface border border-border rounded-xl px-4 py-4 text-foreground text-lg"
            />
          </View>

          {/* Amount */}
          <View>
            <Text className="text-foreground font-semibold mb-2">Loan Amount</Text>
            <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
              <Text className="text-muted text-2xl mr-2">$</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor="#9BA1A6"
                keyboardType="decimal-pad"
                className="flex-1 py-4 text-foreground text-2xl font-bold"
              />
            </View>
          </View>

          {/* Interest Rate */}
          <View>
            <Text className="text-foreground font-semibold mb-2">Interest Rate (Annual)</Text>
            <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
              <TextInput
                value={interestRate}
                onChangeText={setInterestRate}
                placeholder="5"
                placeholderTextColor="#9BA1A6"
                keyboardType="decimal-pad"
                className="flex-1 py-4 text-foreground text-lg"
              />
              <Text className="text-muted text-xl ml-2">%</Text>
            </View>
            <Text className="text-muted text-sm mt-2">
              Typical rates: 0% (no interest) to 10% (standard)
            </Text>
          </View>

          {/* Duration */}
          <View>
            <Text className="text-foreground font-semibold mb-2">Loan Duration</Text>
            <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
              <TextInput
                value={duration}
                onChangeText={setDuration}
                placeholder="90"
                placeholderTextColor="#9BA1A6"
                keyboardType="number-pad"
                className="flex-1 py-4 text-foreground text-lg"
              />
              <Text className="text-muted text-lg ml-2">days</Text>
            </View>
            <Text className="text-muted text-sm mt-2">
              Repayment due date: {new Date(Date.now() + parseInt(duration || '0') * 24 * 60 * 60 * 1000).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Summary */}
        <View className="mt-6 bg-primary/10 rounded-xl p-6 border border-primary/30">
          <Text className="text-foreground font-bold text-lg mb-4">Loan Summary</Text>
          <View className="gap-3">
            <View className="flex-row justify-between">
              <Text className="text-muted">Principal Amount</Text>
              <Text className="text-foreground font-semibold">
                ${parseFloat(amount || '0').toFixed(2)}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-muted">Interest ({interestRate}%)</Text>
              <Text className="text-foreground font-semibold">
                ${(calculateRepayment() - parseFloat(amount || '0')).toFixed(2)}
              </Text>
            </View>
            <View className="h-px bg-border" />
            <View className="flex-row justify-between">
              <Text className="text-foreground font-bold text-lg">Total Repayment</Text>
              <Text className="text-primary font-bold text-2xl">
                ${calculateRepayment().toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          onPress={handleLend}
          className="bg-primary rounded-xl p-5 mt-6"
          style={{ opacity: 1 }}
        >
          <Text className="text-white font-bold text-center text-lg">Create Loan Agreement</Text>
        </TouchableOpacity>

        {/* Info */}
        <View className="mt-6 bg-warning/10 rounded-xl p-5 border border-warning/30">
          <Text className="text-foreground font-bold mb-2">⚠️ Important</Text>
          <Text className="text-foreground leading-relaxed">
            Only lend money to people you know and trust. This app tracks loans but doesn't enforce legal agreements. Consider creating a written contract for larger amounts.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
