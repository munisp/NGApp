import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

interface InsurancePolicy {
  id: string;
  type: string;
  provider: string;
  policyNumber: string;
  coverage: number;
  premium: number;
  frequency: string;
  renewalDate: string;
  status: string;
}

const INSURANCE_POLICIES_KEY = 'insurancePolicies';

const policyEmojis: { [key: string]: string } = {
  health: '🏥',
  auto: '🚗',
  life: '🛡️',
  home: '🏠',
  travel: '✈️',
};

export default function PolicyDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const policyId = params.id as string;

  const [policy, setPolicy] = useState<InsurancePolicy | null>(null);

  useEffect(() => {
    loadPolicy();
  }, [policyId]);

  const loadPolicy = async () => {
    try {
      const stored = await AsyncStorage.getItem(INSURANCE_POLICIES_KEY);
      if (stored) {
        const policies: InsurancePolicy[] = JSON.parse(stored);
        const found = policies.find(p => p.id === policyId);
        if (found) {
          setPolicy(found);
        }
      }
    } catch (error) {
      console.error('Failed to load policy:', error);
    }
  };

  const handleFileClaim = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'File Claim',
      'Claim filing feature coming soon. You will be able to submit claims directly through the app.',
      [{ text: 'OK' }]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Policy',
      'Are you sure you want to delete this insurance policy?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const stored = await AsyncStorage.getItem(INSURANCE_POLICIES_KEY);
              if (stored) {
                const policies: InsurancePolicy[] = JSON.parse(stored);
                const updated = policies.filter(p => p.id !== policyId);
                await AsyncStorage.setItem(INSURANCE_POLICIES_KEY, JSON.stringify(updated));
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                router.back();
              }
            } catch (error) {
              console.error('Failed to delete policy:', error);
              Alert.alert('Error', 'Failed to delete policy');
            }
          },
        },
      ]
    );
  };

  if (!policy) {
    return (
      <ScreenContainer className="p-4">
        <Stack.Screen options={{ title: 'Policy Details', headerShown: true }} />
        <View className="flex-1 justify-center items-center">
          <Text className="text-muted">Policy not found</Text>
        </View>
      </ScreenContainer>
    );
  }

  const emoji = policyEmojis[policy.type] || '📄';
  const daysUntilRenewal = Math.floor(
    (new Date(policy.renewalDate).getTime() - Date.now()) / 86400000
  );

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Policy Details', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="bg-surface rounded-xl p-8 mb-6 border border-border items-center">
          <Text className="text-8xl mb-4">{emoji}</Text>
          <Text className="text-foreground font-bold text-3xl mb-2 capitalize">
            {policy.type} Insurance
          </Text>
          <Text className="text-muted text-lg">{policy.provider}</Text>
        </View>

        {/* Status Alert */}
        {daysUntilRenewal <= 30 && daysUntilRenewal > 0 && (
          <View className="bg-warning/10 rounded-xl p-4 mb-6 border border-warning/30">
            <Text className="text-warning font-semibold mb-1">⚠️ Renewal Reminder</Text>
            <Text className="text-muted text-sm">
              Your policy expires in {daysUntilRenewal} days. Contact your provider to renew.
            </Text>
          </View>
        )}

        {/* Policy Details */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-4">Policy Information</Text>

          <View className="mb-4">
            <Text className="text-muted text-sm mb-1">Policy Number</Text>
            <Text className="text-foreground font-semibold font-mono text-lg">
              {policy.policyNumber}
            </Text>
          </View>

          <View className="mb-4">
            <Text className="text-muted text-sm mb-1">Coverage Amount</Text>
            <Text className="text-foreground font-bold text-2xl">
              ${policy.coverage.toLocaleString()}
            </Text>
          </View>

          <View className="mb-4">
            <Text className="text-muted text-sm mb-1">Premium</Text>
            <Text className="text-foreground font-semibold text-lg">
              ${policy.premium.toLocaleString()} / {policy.frequency}
            </Text>
          </View>

          <View className="mb-4">
            <Text className="text-muted text-sm mb-1">Renewal Date</Text>
            <Text className="text-foreground font-semibold text-lg">
              {new Date(policy.renewalDate).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </View>

          <View>
            <Text className="text-muted text-sm mb-1">Status</Text>
            <View
              className={`self-start px-4 py-2 rounded-full ${
                policy.status === 'active'
                  ? 'bg-success/20'
                  : policy.status === 'expiring'
                  ? 'bg-warning/20'
                  : 'bg-error/20'
              }`}
            >
              <Text
                className={`font-semibold capitalize ${
                  policy.status === 'active'
                    ? 'text-success'
                    : policy.status === 'expiring'
                    ? 'text-warning'
                    : 'text-error'
                }`}
              >
                {policy.status}
              </Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <TouchableOpacity
          onPress={handleFileClaim}
          className="bg-primary rounded-xl p-4 mb-3"
          style={{ opacity: 1 }}
        >
          <Text className="text-white text-center font-semibold text-lg">📋 File a Claim</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => Alert.alert('Contact Provider', `Call ${policy.provider} to discuss your policy`, [{ text: 'OK' }])}
          className="bg-surface border border-border rounded-xl p-4 mb-3"
          style={{ opacity: 1 }}
        >
          <Text className="text-foreground text-center font-semibold text-lg">
            📞 Contact Provider
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleDelete}
          className="bg-error/10 border border-error/30 rounded-xl p-4 mb-6"
          style={{ opacity: 1 }}
        >
          <Text className="text-error text-center font-semibold text-lg">Delete Policy</Text>
        </TouchableOpacity>

        {/* Info */}
        <View className="bg-primary/10 rounded-xl p-4 mb-6 border border-primary/30">
          <Text className="text-muted text-sm text-center">
            Keep your policy information up to date. Set reminders for renewal dates to avoid
            coverage gaps.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
