import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

type GoalCategory = 'emergency' | 'vacation' | 'purchase' | 'education' | 'other';
type TransferFrequency = 'daily' | 'weekly' | 'monthly';

const SAVINGS_GOALS_KEY = 'savingsGoals';

const categories: { value: GoalCategory; label: string; icon: string }[] = [
  { value: 'emergency', label: 'Emergency', icon: '🚨' },
  { value: 'vacation', label: 'Vacation', icon: '✈️' },
  { value: 'purchase', label: 'Purchase', icon: '🛍️' },
  { value: 'education', label: 'Education', icon: '🎓' },
  { value: 'other', label: 'Other', icon: '💰' },
];

const frequencies: { value: TransferFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export default function CreateSavingsGoalScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  const [category, setCategory] = useState<GoalCategory>('emergency');
  const [deadline, setDeadline] = useState('');
  const [autoTransfer, setAutoTransfer] = useState(false);
  const [autoTransferAmount, setAutoTransferAmount] = useState('');
  const [autoTransferFrequency, setAutoTransferFrequency] = useState<TransferFrequency>('monthly');
  const [isSaving, setIsSaving] = useState(false);

  const handleCreate = async () => {
    if (!name || !targetAmount) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const target = parseFloat(targetAmount);
    if (target <= 0) {
      Alert.alert('Error', 'Target amount must be greater than 0');
      return;
    }

    try {
      setIsSaving(true);

      // Load existing goals
      const stored = await AsyncStorage.getItem(SAVINGS_GOALS_KEY);
      const goals = stored ? JSON.parse(stored) : [];

      // Create new goal
      const newGoal = {
        id: Date.now().toString(),
        name,
        targetAmount: target,
        currentAmount: initialAmount ? parseFloat(initialAmount) : 0,
        category,
        deadline: deadline || undefined,
        autoTransferAmount: autoTransfer && autoTransferAmount ? parseFloat(autoTransferAmount) : undefined,
        autoTransferFrequency: autoTransfer ? autoTransferFrequency : undefined,
        createdAt: new Date().toISOString(),
      };

      goals.push(newGoal);
      await AsyncStorage.setItem(SAVINGS_GOALS_KEY, JSON.stringify(goals));

      Alert.alert('Success', 'Savings goal created successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Failed to create goal:', error);
      Alert.alert('Error', 'Failed to create goal. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Create Savings Goal', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Goal Name */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold mb-2">Goal Name *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g., Emergency Fund, New Car"
            placeholderTextColor="#9BA1A6"
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
          />
        </View>

        {/* Category */}
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

        {/* Target Amount */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold mb-2">Target Amount *</Text>
          <View className="bg-surface border border-border rounded-xl px-4 py-3 flex-row items-center">
            <Text className="text-foreground text-xl font-bold mr-2">$</Text>
            <TextInput
              value={targetAmount}
              onChangeText={setTargetAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              placeholderTextColor="#9BA1A6"
              className="flex-1 text-foreground text-xl font-bold"
            />
          </View>
        </View>

        {/* Initial Amount */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold mb-2">Initial Amount (Optional)</Text>
          <View className="bg-surface border border-border rounded-xl px-4 py-3 flex-row items-center">
            <Text className="text-foreground text-xl font-bold mr-2">$</Text>
            <TextInput
              value={initialAmount}
              onChangeText={setInitialAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              placeholderTextColor="#9BA1A6"
              className="flex-1 text-foreground text-xl font-bold"
            />
          </View>
        </View>

        {/* Deadline */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold mb-2">Deadline (Optional)</Text>
          <TextInput
            value={deadline}
            onChangeText={setDeadline}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#9BA1A6"
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
          />
        </View>

        {/* Auto Transfer Toggle */}
        <TouchableOpacity
          onPress={() => setAutoTransfer(!autoTransfer)}
          className="bg-surface border border-border rounded-xl p-4 mb-4 flex-row items-center justify-between"
          style={{ opacity: 1 }}
        >
          <View className="flex-1">
            <Text className="text-foreground font-semibold mb-1">Automatic Transfers</Text>
            <Text className="text-muted text-sm">
              Set up recurring transfers to this goal
            </Text>
          </View>
          <View
            className={`w-12 h-7 rounded-full p-1 ${
              autoTransfer ? 'bg-primary' : 'bg-border'
            }`}
          >
            <View
              className={`w-5 h-5 rounded-full bg-white ${
                autoTransfer ? 'ml-auto' : ''
              }`}
            />
          </View>
        </TouchableOpacity>

        {/* Auto Transfer Settings */}
        {autoTransfer && (
          <View className="bg-primary/10 rounded-xl p-4 mb-4 border border-primary/30">
            <View className="mb-4">
              <Text className="text-foreground font-semibold mb-2">Transfer Amount</Text>
              <View className="bg-surface border border-border rounded-xl px-4 py-3 flex-row items-center">
                <Text className="text-foreground text-lg font-bold mr-2">$</Text>
                <TextInput
                  value={autoTransferAmount}
                  onChangeText={setAutoTransferAmount}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  placeholderTextColor="#9BA1A6"
                  className="flex-1 text-foreground text-lg font-bold"
                />
              </View>
            </View>

            <View>
              <Text className="text-foreground font-semibold mb-2">Frequency</Text>
              <View className="flex-row gap-2">
                {frequencies.map(freq => (
                  <TouchableOpacity
                    key={freq.value}
                    onPress={() => setAutoTransferFrequency(freq.value)}
                    className={`flex-1 rounded-xl py-3 ${
                      autoTransferFrequency === freq.value
                        ? 'bg-primary'
                        : 'bg-surface border border-border'
                    }`}
                    style={{ opacity: 1 }}
                  >
                    <Text
                      className={`text-center font-medium ${
                        autoTransferFrequency === freq.value ? 'text-white' : 'text-foreground'
                      }`}
                    >
                      {freq.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Create Button */}
        <TouchableOpacity
          onPress={handleCreate}
          disabled={isSaving}
          className="bg-primary rounded-xl p-4 mb-4"
          style={{ opacity: isSaving ? 0.6 : 1 }}
        >
          <Text className="text-white text-center font-semibold text-lg">
            {isSaving ? 'Creating...' : 'Create Goal'}
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
