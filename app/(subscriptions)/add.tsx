import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const categories = [
  { id: 'streaming', label: 'Streaming', icon: '🎬' },
  { id: 'music', label: 'Music', icon: '🎵' },
  { id: 'fitness', label: 'Fitness', icon: '💪' },
  { id: 'productivity', label: 'Productivity', icon: '💼' },
  { id: 'gaming', label: 'Gaming', icon: '🎮' },
  { id: 'news', label: 'News', icon: '📰' },
  { id: 'cloud', label: 'Cloud Storage', icon: '☁️' },
  { id: 'other', label: 'Other', icon: '📦' },
];

export default function AddSubscriptionScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('streaming');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [nextBillingDate, setNextBillingDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  const handleAdd = async () => {
    if (!name || !amount || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Input', 'Please fill in all fields correctly');
      return;
    }

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const newSub = {
        id: Date.now().toString(),
        name,
        category,
        amount: parseFloat(amount),
        billingCycle,
        nextBillingDate: new Date(nextBillingDate).toISOString(),
        status: 'active' as const,
        lastUsed: new Date().toISOString(),
      };

      const stored = await AsyncStorage.getItem('subscriptions');
      const subs = stored ? JSON.parse(stored) : [];
      subs.push(newSub);
      await AsyncStorage.setItem('subscriptions', JSON.stringify(subs));

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert(
        'Subscription Added',
        `${name} has been added to your subscriptions`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Failed to add subscription:', error);
      Alert.alert('Error', 'Failed to add subscription');
    }
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Add Subscription', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-foreground font-bold text-3xl mb-2">Add Subscription</Text>
          <Text className="text-muted">Track a new recurring payment</Text>
        </View>

        {/* Form */}
        <View className="gap-5">
          {/* Name */}
          <View>
            <Text className="text-foreground font-semibold mb-2">Service Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g., Netflix, Spotify"
              placeholderTextColor="#9BA1A6"
              className="bg-surface border border-border rounded-xl px-4 py-4 text-foreground text-lg"
            />
          </View>

          {/* Amount */}
          <View>
            <Text className="text-foreground font-semibold mb-2">Amount</Text>
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

          {/* Billing Cycle */}
          <View>
            <Text className="text-foreground font-semibold mb-2">Billing Cycle</Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setBillingCycle('monthly');
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className={`flex-1 rounded-xl p-4 border ${
                  billingCycle === 'monthly'
                    ? 'bg-primary border-primary'
                    : 'bg-surface border-border'
                }`}
                style={{ opacity: 1 }}
              >
                <Text
                  className={`text-center font-semibold ${
                    billingCycle === 'monthly' ? 'text-white' : 'text-foreground'
                  }`}
                >
                  Monthly
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setBillingCycle('yearly');
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className={`flex-1 rounded-xl p-4 border ${
                  billingCycle === 'yearly'
                    ? 'bg-primary border-primary'
                    : 'bg-surface border-border'
                }`}
                style={{ opacity: 1 }}
              >
                <Text
                  className={`text-center font-semibold ${
                    billingCycle === 'yearly' ? 'text-white' : 'text-foreground'
                  }`}
                >
                  Yearly
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Category */}
          <View>
            <Text className="text-foreground font-semibold mb-2">Category</Text>
            <View className="flex-row flex-wrap gap-2">
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => {
                    setCategory(cat.id);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  className={`rounded-xl px-4 py-3 border ${
                    category === cat.id
                      ? 'bg-primary border-primary'
                      : 'bg-surface border-border'
                  }`}
                  style={{ opacity: 1 }}
                >
                  <View className="flex-row items-center gap-2">
                    <Text className="text-xl">{cat.icon}</Text>
                    <Text
                      className={`font-semibold ${
                        category === cat.id ? 'text-white' : 'text-foreground'
                      }`}
                    >
                      {cat.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Next Billing Date */}
          <View>
            <Text className="text-foreground font-semibold mb-2">Next Billing Date</Text>
            <TextInput
              value={nextBillingDate}
              onChangeText={setNextBillingDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9BA1A6"
              className="bg-surface border border-border rounded-xl px-4 py-4 text-foreground text-lg"
            />
            <Text className="text-muted text-sm mt-2">
              Format: YYYY-MM-DD (e.g., 2024-12-31)
            </Text>
          </View>
        </View>

        {/* Summary */}
        <View className="mt-6 bg-primary/10 rounded-xl p-6 border border-primary/30">
          <Text className="text-foreground font-bold text-lg mb-4">Cost Summary</Text>
          <View className="gap-3">
            <View className="flex-row justify-between">
              <Text className="text-muted">Monthly Cost</Text>
              <Text className="text-foreground font-bold">
                ${billingCycle === 'monthly' 
                  ? parseFloat(amount || '0').toFixed(2)
                  : (parseFloat(amount || '0') / 12).toFixed(2)}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-muted">Yearly Cost</Text>
              <Text className="text-foreground font-bold">
                ${billingCycle === 'yearly'
                  ? parseFloat(amount || '0').toFixed(2)
                  : (parseFloat(amount || '0') * 12).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          onPress={handleAdd}
          className="bg-primary rounded-xl p-5 mt-6"
          style={{ opacity: 1 }}
        >
          <Text className="text-white font-bold text-center text-lg">Add Subscription</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
