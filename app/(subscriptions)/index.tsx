import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

interface Subscription {
  id: string;
  name: string;
  category: string;
  amount: number;
  billingCycle: 'monthly' | 'yearly';
  nextBillingDate: string;
  status: 'active' | 'cancelled';
  lastUsed?: string;
}

const categoryIcons: Record<string, string> = {
  streaming: '🎬',
  music: '🎵',
  fitness: '💪',
  productivity: '💼',
  gaming: '🎮',
  news: '📰',
  cloud: '☁️',
  other: '📦',
};

export default function SubscriptionsScreen() {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const loadSubscriptions = async () => {
    try {
      const stored = await AsyncStorage.getItem('subscriptions');
      if (stored) {
        setSubscriptions(JSON.parse(stored));
      } else {
        // Sample subscriptions
        const sampleSubs: Subscription[] = [
          {
            id: '1',
            name: 'Netflix',
            category: 'streaming',
            amount: 15.99,
            billingCycle: 'monthly',
            nextBillingDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            lastUsed: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: '2',
            name: 'Spotify Premium',
            category: 'music',
            amount: 9.99,
            billingCycle: 'monthly',
            nextBillingDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            lastUsed: new Date().toISOString(),
          },
          {
            id: '3',
            name: 'Adobe Creative Cloud',
            category: 'productivity',
            amount: 52.99,
            billingCycle: 'monthly',
            nextBillingDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            lastUsed: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ];
        await AsyncStorage.setItem('subscriptions', JSON.stringify(sampleSubs));
        setSubscriptions(sampleSubs);
      }
    } catch (error) {
      console.error('Failed to load subscriptions:', error);
    }
  };

  const getTotalMonthly = () => {
    return subscriptions
      .filter(sub => sub.status === 'active')
      .reduce((sum, sub) => {
        const monthly = sub.billingCycle === 'yearly' ? sub.amount / 12 : sub.amount;
        return sum + monthly;
      }, 0);
  };

  const getTotalYearly = () => {
    return getTotalMonthly() * 12;
  };

  const getUnusedSubscriptions = () => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return subscriptions.filter(
      sub => sub.status === 'active' && sub.lastUsed && new Date(sub.lastUsed).getTime() < thirtyDaysAgo
    );
  };

  const handleCancelSubscription = async (id: string) => {
    const sub = subscriptions.find(s => s.id === id);
    if (!sub) return;

    Alert.alert(
      'Cancel Subscription',
      `Are you sure you want to cancel ${sub.name}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            const updated = subscriptions.map(s =>
              s.id === id ? { ...s, status: 'cancelled' as const } : s
            );
            setSubscriptions(updated);
            await AsyncStorage.setItem('subscriptions', JSON.stringify(updated));
          },
        },
      ]
    );
  };

  const unusedSubs = getUnusedSubscriptions();

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Subscriptions', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-foreground font-bold text-3xl mb-2">Subscriptions</Text>
          <Text className="text-muted">Track and manage all your recurring payments</Text>
        </View>

        {/* Summary Cards */}
        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-primary/10 rounded-xl p-5 border border-primary/30">
            <Text className="text-primary text-sm mb-1">Monthly</Text>
            <Text className="text-foreground font-bold text-2xl">
              ${getTotalMonthly().toFixed(2)}
            </Text>
            <Text className="text-muted text-xs mt-1">
              {subscriptions.filter(s => s.status === 'active').length} active
            </Text>
          </View>
          <View className="flex-1 bg-warning/10 rounded-xl p-5 border border-warning/30">
            <Text className="text-warning text-sm mb-1">Yearly</Text>
            <Text className="text-foreground font-bold text-2xl">
              ${getTotalYearly().toFixed(2)}
            </Text>
            <Text className="text-muted text-xs mt-1">Total cost</Text>
          </View>
        </View>

        {/* Unused Subscriptions Alert */}
        {unusedSubs.length > 0 && (
          <View className="bg-error/10 rounded-xl p-5 mb-6 border border-error/30">
            <View className="flex-row items-start gap-3">
              <Text className="text-3xl">⚠️</Text>
              <View className="flex-1">
                <Text className="text-foreground font-bold text-lg mb-1">
                  {unusedSubs.length} Unused Subscription{unusedSubs.length > 1 ? 's' : ''}
                </Text>
                <Text className="text-foreground mb-3">
                  You haven't used these in over 30 days. Consider cancelling to save money.
                </Text>
                <View className="gap-2">
                  {unusedSubs.map(sub => (
                    <Text key={sub.id} className="text-foreground">
                      • {sub.name} - ${sub.amount}/{sub.billingCycle === 'monthly' ? 'mo' : 'yr'}
                    </Text>
                  ))}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Add Subscription Button */}
        <TouchableOpacity
          onPress={() => router.push('/(subscriptions)/add' as any)}
          className="bg-primary rounded-xl p-5 mb-6"
          style={{ opacity: 1 }}
        >
          <Text className="text-white font-bold text-center text-lg">+ Add Subscription</Text>
        </TouchableOpacity>

        {/* Subscriptions by Category */}
        <View>
          <Text className="text-foreground font-bold text-xl mb-4">Your Subscriptions</Text>

          {Object.entries(
            subscriptions.reduce((acc, sub) => {
              if (!acc[sub.category]) acc[sub.category] = [];
              acc[sub.category].push(sub);
              return acc;
            }, {} as Record<string, Subscription[]>)
          ).map(([category, subs]) => (
            <View key={category} className="mb-6">
              <View className="flex-row items-center gap-2 mb-3">
                <Text className="text-2xl">{categoryIcons[category] || '📦'}</Text>
                <Text className="text-foreground font-bold text-lg capitalize">{category}</Text>
                <Text className="text-muted">
                  (${subs.filter(s => s.status === 'active').reduce((sum, s) => sum + (s.billingCycle === 'monthly' ? s.amount : s.amount / 12), 0).toFixed(2)}/mo)
                </Text>
              </View>

              <View className="gap-3">
                {subs.map(sub => {
                  const daysUntilBilling = Math.ceil(
                    (new Date(sub.nextBillingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                  );
                  const daysSinceUsed = sub.lastUsed
                    ? Math.floor((Date.now() - new Date(sub.lastUsed).getTime()) / (1000 * 60 * 60 * 24))
                    : null;

                  return (
                    <TouchableOpacity
                      key={sub.id}
                      onPress={() => router.push(`/(subscriptions)/${sub.id}` as any)}
                      className={`bg-surface rounded-xl p-5 border ${
                        sub.status === 'cancelled' ? 'border-muted opacity-50' : 'border-border'
                      }`}
                      style={{ opacity: sub.status === 'cancelled' ? 0.5 : 1 }}
                    >
                      <View className="flex-row items-start justify-between mb-3">
                        <View className="flex-1">
                          <Text className="text-foreground font-bold text-lg mb-1">
                            {sub.name}
                          </Text>
                          <View className="flex-row items-center gap-2">
                            {sub.status === 'cancelled' ? (
                              <View className="bg-muted/20 px-3 py-1 rounded-full">
                                <Text className="text-muted text-xs font-semibold">CANCELLED</Text>
                              </View>
                            ) : (
                              <>
                                {daysUntilBilling <= 7 && (
                                  <View className="bg-warning/20 px-3 py-1 rounded-full">
                                    <Text className="text-warning text-xs font-semibold">
                                      Due in {daysUntilBilling}d
                                    </Text>
                                  </View>
                                )}
                                {daysSinceUsed !== null && daysSinceUsed > 30 && (
                                  <View className="bg-error/20 px-3 py-1 rounded-full">
                                    <Text className="text-error text-xs font-semibold">
                                      Unused {daysSinceUsed}d
                                    </Text>
                                  </View>
                                )}
                              </>
                            )}
                          </View>
                        </View>
                        <View className="items-end">
                          <Text className="text-foreground font-bold text-2xl">
                            ${sub.amount}
                          </Text>
                          <Text className="text-muted text-sm">
                            /{sub.billingCycle === 'monthly' ? 'month' : 'year'}
                          </Text>
                        </View>
                      </View>

                      {sub.status === 'active' && (
                        <View className="flex-row justify-between items-center pt-3 border-t border-border">
                          <Text className="text-muted text-sm">
                            Next billing: {new Date(sub.nextBillingDate).toLocaleDateString()}
                          </Text>
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              handleCancelSubscription(sub.id);
                            }}
                            className="px-4 py-2 rounded-lg bg-error/10"
                            style={{ opacity: 1 }}
                          >
                            <Text className="text-error font-semibold text-sm">Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        {/* Savings Tip */}
        <View className="mt-6 bg-success/10 rounded-xl p-5 border border-success/30">
          <Text className="text-foreground font-bold text-lg mb-3">💡 Savings Tip</Text>
          <Text className="text-foreground leading-relaxed">
            Review your subscriptions monthly and cancel unused ones. You could save $
            {unusedSubs.reduce((sum, sub) => sum + (sub.billingCycle === 'monthly' ? sub.amount : sub.amount / 12), 0).toFixed(2)}
            /month by cancelling unused subscriptions.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
