import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

export default function CreateJointAccountScreen() {
  const router = useRouter();
  const [accountName, setAccountName] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [initialBalance, setInitialBalance] = useState('');

  const handleCreate = async () => {
    if (!accountName.trim()) {
      Alert.alert('Error', 'Please enter an account name');
      return;
    }

    if (!partnerEmail.trim() || !partnerEmail.includes('@')) {
      Alert.alert('Error', 'Please enter a valid partner email');
      return;
    }

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const newAccount = {
        id: Date.now().toString(),
        name: accountName,
        balance: initialBalance ? parseFloat(initialBalance) : 0,
        partners: [
          { id: 'user1', name: 'You', email: 'you@example.com' },
          { id: 'invite', name: 'Pending', email: partnerEmail },
        ],
        createdAt: new Date().toISOString(),
      };

      const stored = await AsyncStorage.getItem('jointAccounts');
      const accounts = stored ? JSON.parse(stored) : [];
      accounts.push(newAccount);
      await AsyncStorage.setItem('jointAccounts', JSON.stringify(accounts));

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Joint Account Created',
        `Invitation sent to ${partnerEmail}`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('Failed to create joint account:', error);
      Alert.alert('Error', 'Failed to create joint account');
    }
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Create Joint Account', headerShown: true }} />

      <View className="flex-1">
        <Text className="text-foreground font-bold text-3xl mb-2">Create Joint Account</Text>
        <Text className="text-muted mb-8">Set up a shared account with your partner</Text>

        <View className="gap-6">
          <View>
            <Text className="text-foreground font-semibold mb-3">Account Name</Text>
            <TextInput
              value={accountName}
              onChangeText={setAccountName}
              placeholder="e.g., Family Account"
              placeholderTextColor="#9BA1A6"
              className="bg-surface border border-border rounded-xl px-4 py-4 text-foreground text-lg"
            />
          </View>

          <View>
            <Text className="text-foreground font-semibold mb-3">Partner Email</Text>
            <TextInput
              value={partnerEmail}
              onChangeText={setPartnerEmail}
              placeholder="partner@example.com"
              placeholderTextColor="#9BA1A6"
              keyboardType="email-address"
              autoCapitalize="none"
              className="bg-surface border border-border rounded-xl px-4 py-4 text-foreground text-lg"
            />
          </View>

          <View>
            <Text className="text-foreground font-semibold mb-3">Initial Balance (Optional)</Text>
            <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
              <Text className="text-muted text-2xl mr-2">$</Text>
              <TextInput
                value={initialBalance}
                onChangeText={setInitialBalance}
                placeholder="0.00"
                placeholderTextColor="#9BA1A6"
                keyboardType="decimal-pad"
                className="flex-1 py-4 text-foreground text-lg"
              />
            </View>
          </View>
        </View>

        <View className="flex-1" />

        <TouchableOpacity
          onPress={handleCreate}
          className="bg-primary rounded-xl p-5 mb-4"
          style={{ opacity: 1 }}
        >
          <Text className="text-white font-bold text-center text-lg">Create Account</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}
