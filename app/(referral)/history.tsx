import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Referral {
  id: string;
  referredUser: string;
  status: 'pending' | 'completed';
  reward: number;
  date: string;
}

const REFERRALS_KEY = 'referrals';

export default function ReferralHistoryScreen() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadReferrals();
  }, []);

  const loadReferrals = async () => {
    try {
      setIsLoading(true);
      const stored = await AsyncStorage.getItem(REFERRALS_KEY);
      if (stored) {
        setReferrals(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load referrals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderReferral = ({ item }: { item: Referral }) => {
    return (
      <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-1">
            <Text className="text-foreground font-bold text-lg mb-1">
              {item.referredUser}
            </Text>
            <Text className="text-muted text-sm">
              {new Date(item.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>
          <View className="items-end">
            <Text className={`font-bold text-2xl ${item.status === 'completed' ? 'text-success' : 'text-warning'}`}>
              ${item.reward.toFixed(2)}
            </Text>
            <View className={`${item.status === 'completed' ? 'bg-success/20' : 'bg-warning/20'} rounded px-2 py-0.5 mt-1`}>
              <Text className={`${item.status === 'completed' ? 'text-success' : 'text-warning'} text-xs font-semibold`}>
                {item.status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {item.status === 'pending' && (
          <View className="bg-warning/10 rounded-lg p-3 mt-2">
            <Text className="text-warning text-xs">
              ⏳ Waiting for first transaction to complete
            </Text>
          </View>
        )}
      </View>
    );
  };

  const completedReferrals = referrals.filter(r => r.status === 'completed');
  const pendingReferrals = referrals.filter(r => r.status === 'pending');
  const totalEarned = completedReferrals.reduce((sum, r) => sum + r.reward, 0);

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Referral History', headerShown: true }} />

      {/* Summary */}
      {referrals.length > 0 && (
        <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30">
          <Text className="text-foreground font-bold text-xl mb-2">Summary</Text>
          <View className="flex-row justify-between">
            <View>
              <Text className="text-muted text-sm mb-1">Total Earned</Text>
              <Text className="text-primary font-bold text-2xl">${totalEarned.toFixed(2)}</Text>
            </View>
            <View>
              <Text className="text-muted text-sm mb-1">Completed</Text>
              <Text className="text-success font-bold text-2xl">{completedReferrals.length}</Text>
            </View>
            <View>
              <Text className="text-muted text-sm mb-1">Pending</Text>
              <Text className="text-warning font-bold text-2xl">{pendingReferrals.length}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Referrals List */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0a7ea4" />
        </View>
      ) : referrals.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-6xl mb-4">👥</Text>
          <Text className="text-foreground font-semibold text-lg mb-2">No Referrals Yet</Text>
          <Text className="text-muted text-center mb-6">
            Start sharing your referral code to earn rewards
          </Text>
        </View>
      ) : (
        <FlatList
          data={referrals}
          renderItem={renderReferral}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}
