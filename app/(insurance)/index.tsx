import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface InsurancePolicy {
  id: string;
  type: 'health' | 'auto' | 'life' | 'home' | 'travel';
  provider: string;
  policyNumber: string;
  coverage: number;
  premium: number;
  frequency: 'monthly' | 'quarterly' | 'annually';
  renewalDate: string;
  status: 'active' | 'expiring' | 'expired';
}

const INSURANCE_POLICIES_KEY = 'insurancePolicies';

const policyEmojis = {
  health: '🏥',
  auto: '🚗',
  life: '🛡️',
  home: '🏠',
  travel: '✈️',
};

const policyColors = {
  health: '#22C55E',
  auto: '#0a7ea4',
  life: '#F59E0B',
  home: '#EF4444',
  travel: '#8B5CF6',
};

export default function InsurancePoliciesScreen() {
  const router = useRouter();
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPolicies();
  }, []);

  const loadPolicies = async () => {
    try {
      const stored = await AsyncStorage.getItem(INSURANCE_POLICIES_KEY);
      let policiesData: InsurancePolicy[] = [];

      if (stored) {
        policiesData = JSON.parse(stored);
      } else {
        // Generate sample data
        policiesData = [
          {
            id: '1',
            type: 'health',
            provider: 'Blue Cross',
            policyNumber: 'BC-2024-001',
            coverage: 500000,
            premium: 450,
            frequency: 'monthly',
            renewalDate: new Date(Date.now() + 45 * 86400000).toISOString(),
            status: 'active',
          },
          {
            id: '2',
            type: 'auto',
            provider: 'State Farm',
            policyNumber: 'SF-AUTO-789',
            coverage: 100000,
            premium: 1200,
            frequency: 'annually',
            renewalDate: new Date(Date.now() + 15 * 86400000).toISOString(),
            status: 'expiring',
          },
          {
            id: '3',
            type: 'life',
            provider: 'MetLife',
            policyNumber: 'ML-LIFE-456',
            coverage: 1000000,
            premium: 850,
            frequency: 'quarterly',
            renewalDate: new Date(Date.now() + 90 * 86400000).toISOString(),
            status: 'active',
          },
        ];
        await AsyncStorage.setItem(INSURANCE_POLICIES_KEY, JSON.stringify(policiesData));
      }

      // Update status based on renewal date
      policiesData = policiesData.map(policy => {
        const daysUntilRenewal = Math.floor(
          (new Date(policy.renewalDate).getTime() - Date.now()) / 86400000
        );
        return {
          ...policy,
          status:
            daysUntilRenewal < 0
              ? 'expired'
              : daysUntilRenewal <= 30
              ? 'expiring'
              : 'active',
        };
      });

      setPolicies(policiesData);
    } catch (error) {
      console.error('Failed to load policies:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPolicies();
    setRefreshing(false);
  };

  const totalCoverage = policies.reduce((sum, p) => sum + p.coverage, 0);
  const expiringCount = policies.filter(p => p.status === 'expiring').length;

  const renderPolicy = ({ item }: { item: InsurancePolicy }) => {
    const emoji = policyEmojis[item.type];
    const color = policyColors[item.type];
    const daysUntilRenewal = Math.floor(
      (new Date(item.renewalDate).getTime() - Date.now()) / 86400000
    );

    return (
      <TouchableOpacity
        onPress={() => router.push(`/(insurance)/${item.id}` as any)}
        className="bg-surface rounded-xl p-5 mb-4 border border-border"
        style={{ opacity: 1 }}
      >
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center flex-1">
            <View
              className="w-14 h-14 rounded-full items-center justify-center mr-4"
              style={{ backgroundColor: `${color}20` }}
            >
              <Text className="text-3xl">{emoji}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-foreground font-bold text-lg mb-1 capitalize">
                {item.type} Insurance
              </Text>
              <Text className="text-muted text-sm">{item.provider}</Text>
            </View>
          </View>
          <View
            className={`px-3 py-1 rounded-full ${
              item.status === 'active'
                ? 'bg-success/20'
                : item.status === 'expiring'
                ? 'bg-warning/20'
                : 'bg-error/20'
            }`}
          >
            <Text
              className={`text-xs font-semibold capitalize ${
                item.status === 'active'
                  ? 'text-success'
                  : item.status === 'expiring'
                  ? 'text-warning'
                  : 'text-error'
              }`}
            >
              {item.status}
            </Text>
          </View>
        </View>

        <View className="bg-background rounded-xl p-4">
          <View className="flex-row justify-between mb-3">
            <Text className="text-muted text-sm">Coverage</Text>
            <Text className="text-foreground font-semibold">
              ${item.coverage.toLocaleString()}
            </Text>
          </View>
          <View className="flex-row justify-between mb-3">
            <Text className="text-muted text-sm">Premium</Text>
            <Text className="text-foreground font-semibold">
              ${item.premium}/{item.frequency === 'monthly' ? 'mo' : item.frequency === 'quarterly' ? 'qtr' : 'yr'}
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-muted text-sm">Renewal</Text>
            <Text className={`font-semibold ${daysUntilRenewal <= 30 ? 'text-warning' : 'text-foreground'}`}>
              {daysUntilRenewal > 0 ? `${daysUntilRenewal} days` : 'Expired'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Insurance', headerShown: true }} />

      {/* Summary Cards */}
      <View className="flex-row gap-3 mb-6">
        <View className="flex-1 bg-primary/10 rounded-xl p-4 border border-primary/30">
          <Text className="text-muted text-sm mb-2">Total Coverage</Text>
          <Text className="text-primary font-bold text-2xl">
            ${(totalCoverage / 1000000).toFixed(1)}M
          </Text>
        </View>
        <View className="flex-1 bg-warning/10 rounded-xl p-4 border border-warning/30">
          <Text className="text-muted text-sm mb-2">Expiring Soon</Text>
          <Text className="text-warning font-bold text-2xl">{expiringCount}</Text>
        </View>
      </View>

      {/* Policies List */}
      {policies.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-6xl mb-4">🛡️</Text>
          <Text className="text-foreground font-semibold text-lg mb-2">No Policies</Text>
          <Text className="text-muted text-center mb-6">
            Add your insurance policies to track coverage and renewals
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(insurance)/add' as any)}
            className="bg-primary px-6 py-3 rounded-xl"
            style={{ opacity: 1 }}
          >
            <Text className="text-white font-semibold">Add Policy</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={policies}
          renderItem={renderPolicy}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0a7ea4" />
          }
          ListFooterComponent={
            <TouchableOpacity
              onPress={() => router.push('/(insurance)/add' as any)}
              className="bg-primary rounded-xl p-4 mb-6"
              style={{ opacity: 1 }}
            >
              <Text className="text-white text-center font-semibold text-lg">
                ➕ Add New Policy
              </Text>
            </TouchableOpacity>
          }
        />
      )}
    </ScreenContainer>
  );
}
