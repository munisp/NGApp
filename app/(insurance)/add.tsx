import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const INSURANCE_POLICIES_KEY = 'insurancePolicies';

const policyTypes = [
  { value: 'health', label: 'Health', emoji: '🏥' },
  { value: 'auto', label: 'Auto', emoji: '🚗' },
  { value: 'life', label: 'Life', emoji: '🛡️' },
  { value: 'home', label: 'Home', emoji: '🏠' },
  { value: 'travel', label: 'Travel', emoji: '✈️' },
];

const frequencies = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
];

export default function AddInsurancePolicyScreen() {
  const router = useRouter();
  const [type, setType] = useState<string>('health');
  const [provider, setProvider] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [coverage, setCoverage] = useState('');
  const [premium, setPremium] = useState('');
  const [frequency, setFrequency] = useState<string>('monthly');
  const [renewalDate, setRenewalDate] = useState('');

  const handleSave = async () => {
    if (!provider || !policyNumber || !coverage || !premium || !renewalDate) {
      Alert.alert('Missing Information', 'Please fill in all required fields');
      return;
    }

    try {
      const newPolicy = {
        id: Date.now().toString(),
        type,
        provider,
        policyNumber,
        coverage: parseFloat(coverage),
        premium: parseFloat(premium),
        frequency,
        renewalDate: new Date(renewalDate).toISOString(),
        status: 'active',
      };

      const stored = await AsyncStorage.getItem(INSURANCE_POLICIES_KEY);
      const policies = stored ? JSON.parse(stored) : [];
      policies.unshift(newPolicy);
      await AsyncStorage.setItem(INSURANCE_POLICIES_KEY, JSON.stringify(policies));

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Insurance policy added successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Failed to save policy:', error);
      Alert.alert('Error', 'Failed to save insurance policy');
    }
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Add Insurance Policy', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Policy Type */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-3">Policy Type *</Text>
          <View className="flex-row flex-wrap gap-3">
            {policyTypes.map(pt => (
              <TouchableOpacity
                key={pt.value}
                onPress={() => {
                  setType(pt.value);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className={`flex-1 min-w-[45%] rounded-xl p-4 border-2 ${
                  type === pt.value
                    ? 'bg-primary/10 border-primary'
                    : 'bg-surface border-border'
                }`}
                style={{ opacity: 1 }}
              >
                <Text className="text-center text-3xl mb-2">{pt.emoji}</Text>
                <Text
                  className={`text-center font-semibold ${
                    type === pt.value ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  {pt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Provider */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-3">Insurance Provider *</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl p-4 text-foreground"
            placeholder="e.g., Blue Cross, State Farm"
            placeholderTextColor="#9BA1A6"
            value={provider}
            onChangeText={setProvider}
          />
        </View>

        {/* Policy Number */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-3">Policy Number *</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl p-4 text-foreground font-mono"
            placeholder="e.g., POL-2024-001"
            placeholderTextColor="#9BA1A6"
            value={policyNumber}
            onChangeText={setPolicyNumber}
          />
        </View>

        {/* Coverage Amount */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-3">Coverage Amount *</Text>
          <View className="flex-row items-center bg-surface border border-border rounded-xl p-4">
            <Text className="text-foreground text-xl mr-2">$</Text>
            <TextInput
              className="flex-1 text-foreground text-xl"
              placeholder="0"
              placeholderTextColor="#9BA1A6"
              keyboardType="numeric"
              value={coverage}
              onChangeText={setCoverage}
            />
          </View>
        </View>

        {/* Premium */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-3">Premium Amount *</Text>
          <View className="flex-row items-center bg-surface border border-border rounded-xl p-4">
            <Text className="text-foreground text-xl mr-2">$</Text>
            <TextInput
              className="flex-1 text-foreground text-xl"
              placeholder="0"
              placeholderTextColor="#9BA1A6"
              keyboardType="decimal-pad"
              value={premium}
              onChangeText={setPremium}
            />
          </View>
        </View>

        {/* Payment Frequency */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-3">Payment Frequency *</Text>
          <View className="flex-row gap-3">
            {frequencies.map(freq => (
              <TouchableOpacity
                key={freq.value}
                onPress={() => {
                  setFrequency(freq.value);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className={`flex-1 rounded-xl p-4 border-2 ${
                  frequency === freq.value
                    ? 'bg-primary/10 border-primary'
                    : 'bg-surface border-border'
                }`}
                style={{ opacity: 1 }}
              >
                <Text
                  className={`text-center font-semibold ${
                    frequency === freq.value ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  {freq.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Renewal Date */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-3">Renewal Date *</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl p-4 text-foreground"
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#9BA1A6"
            value={renewalDate}
            onChangeText={setRenewalDate}
          />
          <Text className="text-muted text-xs mt-2">Format: YYYY-MM-DD (e.g., 2024-12-31)</Text>
        </View>

        {/* Actions */}
        <TouchableOpacity
          onPress={handleSave}
          className="bg-primary rounded-xl p-4 mb-3"
          style={{ opacity: 1 }}
        >
          <Text className="text-white text-center font-semibold text-lg">Save Policy</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-surface border border-border rounded-xl p-4 mb-6"
          style={{ opacity: 1 }}
        >
          <Text className="text-foreground text-center font-semibold text-lg">Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
