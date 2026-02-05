import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

type BillerCategory = 'electricity' | 'water' | 'internet' | 'phone' | 'gas' | 'cable';

const BILLERS_STORAGE_KEY = 'savedBillers';

const categories: { value: BillerCategory; label: string; icon: string }[] = [
  { value: 'electricity', label: 'Electricity', icon: '⚡' },
  { value: 'water', label: 'Water', icon: '💧' },
  { value: 'internet', label: 'Internet', icon: '🌐' },
  { value: 'phone', label: 'Phone', icon: '📱' },
  { value: 'gas', label: 'Gas', icon: '🔥' },
  { value: 'cable', label: 'Cable TV', icon: '📺' },
];

export default function AddBillerScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<BillerCategory>('electricity');
  const [accountNumber, setAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name || !accountNumber) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setIsSaving(true);

      // Load existing billers
      const stored = await AsyncStorage.getItem(BILLERS_STORAGE_KEY);
      const billers = stored ? JSON.parse(stored) : [];

      // Add new biller
      const newBiller = {
        id: Date.now().toString(),
        name,
        category,
        accountNumber,
        amount: amount ? parseFloat(amount) : undefined,
        isRecurring,
        createdAt: new Date().toISOString(),
      };

      billers.push(newBiller);
      await AsyncStorage.setItem(BILLERS_STORAGE_KEY, JSON.stringify(billers));

      Alert.alert('Success', 'Biller added successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Failed to save biller:', error);
      Alert.alert('Error', 'Failed to save biller. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Add Biller', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Biller Name */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold mb-2">Biller Name *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g., City Power Company"
            placeholderTextColor="#9BA1A6"
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
          />
        </View>

        {/* Category Selection */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold mb-2">Category *</Text>
          <View className="flex-row flex-wrap gap-2">
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.value}
                onPress={() => setCategory(cat.value)}
                className={`flex-row items-center px-4 py-3 rounded-xl ${
                  category === cat.value
                    ? 'bg-primary'
                    : 'bg-surface border border-border'
                }`}
                style={{ opacity: 1 }}
              >
                <Text className="text-xl mr-2">{cat.icon}</Text>
                <Text
                  className={`font-medium ${
                    category === cat.value ? 'text-white' : 'text-foreground'
                  }`}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Account Number */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold mb-2">Account Number *</Text>
          <TextInput
            value={accountNumber}
            onChangeText={setAccountNumber}
            placeholder="Enter your account number"
            placeholderTextColor="#9BA1A6"
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
          />
        </View>

        {/* Typical Amount */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold mb-2">Typical Amount (Optional)</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            keyboardType="decimal-pad"
            placeholderTextColor="#9BA1A6"
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
          />
          <Text className="text-muted text-sm mt-1">
            Pre-fill this amount when paying this bill
          </Text>
        </View>

        {/* Recurring Payment Toggle */}
        <TouchableOpacity
          onPress={() => setIsRecurring(!isRecurring)}
          className="bg-surface border border-border rounded-xl p-4 mb-6 flex-row items-center justify-between"
          style={{ opacity: 1 }}
        >
          <View className="flex-1">
            <Text className="text-foreground font-semibold mb-1">Recurring Payment</Text>
            <Text className="text-muted text-sm">
              Set up automatic monthly payments
            </Text>
          </View>
          <View
            className={`w-12 h-7 rounded-full p-1 ${
              isRecurring ? 'bg-primary' : 'bg-border'
            }`}
          >
            <View
              className={`w-5 h-5 rounded-full bg-white ${
                isRecurring ? 'ml-auto' : ''
              }`}
            />
          </View>
        </TouchableOpacity>

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          className="bg-primary rounded-xl p-4 mb-4"
          style={{ opacity: isSaving ? 0.6 : 1 }}
        >
          <Text className="text-white text-center font-semibold text-lg">
            {isSaving ? 'Saving...' : 'Save Biller'}
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
