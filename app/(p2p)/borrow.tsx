import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function BorrowMoneyScreen() {
  const router = useRouter();
  const [contact, setContact] = useState('');
  const [amount, setAmount] = useState('');
  const [interestRate, setInterestRate] = useState('5');
  const [duration, setDuration] = useState('90');
  const [purpose, setPurpose] = useState('');

  const calculateRepayment = () => {
    const principal = parseFloat(amount) || 0;
    const rate = parseFloat(interestRate) || 0;
    const total = principal * (1 + rate / 100);
    return total;
  };

  const handleBorrow = async () => {
    if (!contact || !amount || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Input', 'Please fill in all fields correctly');
      return;
    }

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // In a real app, send request to backend
      const newLoan = {
        id: Date.now().toString(),
        type: 'borrowed',
        contact,
        amount: parseFloat(amount),
        interestRate: parseFloat(interestRate),
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + parseInt(duration) * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
        amountPaid: 0,
        purpose,
      };

      const stored = await AsyncStorage.getItem('p2pLoans');
      const loans = stored ? JSON.parse(stored) : [];
      loans.push(newLoan);
      await AsyncStorage.setItem('p2pLoans', JSON.stringify(loans));

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert(
        'Loan Request Sent',
        `Request sent to ${contact} for $${amount}`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Failed to create loan request:', error);
      Alert.alert('Error', 'Failed to send loan request');
    }
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Borrow Money', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-foreground font-bold text-3xl mb-2">Borrow Money</Text>
          <Text className="text-muted">Request a loan from a trusted contact</Text>
        </View>

        {/* Form */}
        <View className="gap-5">
          {/* Contact Name */}
          <View>
            <Text className="text-foreground font-semibold mb-2">Lender Name</Text>
            <TextInput
              value={contact}
              onChangeText={setContact}
              placeholder="Who are you borrowing from?"
              placeholderTextColor="#9BA1A6"
              className="bg-surface border border-border rounded-xl px-4 py-4 text-foreground text-lg"
            />
          </View>

          {/* Amount */}
          <View>
            <Text className="text-foreground font-semibold mb-2">Amount Needed</Text>
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

          {/* Purpose */}
          <View>
            <Text className="text-foreground font-semibold mb-2">Purpose (Optional)</Text>
            <TextInput
              value={purpose}
              onChangeText={setPurpose}
              placeholder="What will you use this money for?"
              placeholderTextColor="#9BA1A6"
              multiline
              numberOfLines={3}
              className="bg-surface border border-border rounded-xl px-4 py-4 text-foreground text-base"
              style={{ textAlignVertical: 'top' }}
            />
          </View>

          {/* Interest Rate */}
          <View>
            <Text className="text-foreground font-semibold mb-2">Proposed Interest Rate</Text>
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
              The lender can accept or negotiate this rate
            </Text>
          </View>

          {/* Duration */}
          <View>
            <Text className="text-foreground font-semibold mb-2">Repayment Period</Text>
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
              You'll repay by: {new Date(Date.now() + parseInt(duration || '0') * 24 * 60 * 60 * 1000).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Summary */}
        <View className="mt-6 bg-warning/10 rounded-xl p-6 border border-warning/30">
          <Text className="text-foreground font-bold text-lg mb-4">Repayment Summary</Text>
          <View className="gap-3">
            <View className="flex-row justify-between">
              <Text className="text-muted">Borrowed Amount</Text>
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
              <Text className="text-foreground font-bold text-lg">You'll Repay</Text>
              <Text className="text-warning font-bold text-2xl">
                ${calculateRepayment().toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          onPress={handleBorrow}
          className="bg-primary rounded-xl p-5 mt-6"
          style={{ opacity: 1 }}
        >
          <Text className="text-white font-bold text-center text-lg">Send Loan Request</Text>
        </TouchableOpacity>

        {/* Info */}
        <View className="mt-6 bg-primary/10 rounded-xl p-5 border border-primary/30">
          <Text className="text-foreground font-bold mb-2">💡 Tips for Borrowing</Text>
          <View className="gap-2">
            <Text className="text-foreground leading-relaxed">
              • Be clear about why you need the money
            </Text>
            <Text className="text-foreground leading-relaxed">
              • Only borrow what you can realistically repay
            </Text>
            <Text className="text-foreground leading-relaxed">
              • Set up automatic payments to avoid missing due dates
            </Text>
            <Text className="text-foreground leading-relaxed">
              • Communicate openly if you face repayment difficulties
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
