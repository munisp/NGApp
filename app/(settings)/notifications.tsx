import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, ActivityIndicator, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';

interface NotificationPreferences {
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  categories: {
    transaction: boolean;
    bill: boolean;
    goal: boolean;
    balance: boolean;
    security: boolean;
  };
}

export default function NotificationSettingsScreen() {
  const colors = useColors();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch preferences on mount
  const { data, isLoading, refetch } = trpc.notifications.getPreferences.useQuery();
  const updateMutation = trpc.notifications.updatePreferences.useMutation();

  useEffect(() => {
    if (data?.preferences) {
      setPreferences(data.preferences);
      setLoading(false);
    }
  }, [data]);

  const handleToggle = async (
    section: 'channels' | 'categories',
    key: string,
    value: boolean
  ) => {
    if (!preferences) return;

    // Optimistic update
    const newPreferences = { ...preferences };
    if (section === 'channels') {
      (newPreferences as any)[key] = value;
    } else {
      newPreferences.categories = {
        ...newPreferences.categories,
        [key]: value,
      };
    }
    setPreferences(newPreferences);

    // Save to server
    setSaving(true);
    try {
      const updateData: any = {};
      if (section === 'channels') {
        updateData[key] = value;
      } else {
        updateData.categories = { [key]: value };
      }

      await updateMutation.mutateAsync(updateData);
      await refetch();
    } catch (error) {
      Alert.alert('Error', 'Failed to update notification preferences');
      // Revert on error
      await refetch();
    } finally {
      setSaving(false);
    }
  };

  if (loading || isLoading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!preferences) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center p-6">
        <Text className="text-foreground text-center">
          Failed to load notification preferences
        </Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView className="flex-1">
        <View className="p-6 gap-6">
          {/* Header */}
          <View>
            <Text className="text-2xl font-bold text-foreground">
              Notification Settings
            </Text>
            <Text className="text-muted mt-2">
              Manage how you receive notifications from the app
            </Text>
          </View>

          {/* Notification Channels */}
          <View className="bg-surface rounded-2xl p-4 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-4">
              Notification Channels
            </Text>

            <View className="gap-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-foreground font-medium">Push Notifications</Text>
                  <Text className="text-muted text-sm mt-1">
                    Receive notifications on your device
                  </Text>
                </View>
                <Switch
                  value={preferences.pushEnabled}
                  onValueChange={(value) => handleToggle('channels', 'pushEnabled', value)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                  disabled={saving}
                />
              </View>

              <View className="h-px bg-border" />

              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-foreground font-medium">Email Notifications</Text>
                  <Text className="text-muted text-sm mt-1">
                    Receive notifications via email
                  </Text>
                </View>
                <Switch
                  value={preferences.emailEnabled}
                  onValueChange={(value) => handleToggle('channels', 'emailEnabled', value)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                  disabled={saving}
                />
              </View>

              <View className="h-px bg-border" />

              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-foreground font-medium">SMS Notifications</Text>
                  <Text className="text-muted text-sm mt-1">
                    Receive notifications via text message
                  </Text>
                </View>
                <Switch
                  value={preferences.smsEnabled}
                  onValueChange={(value) => handleToggle('channels', 'smsEnabled', value)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                  disabled={saving}
                />
              </View>
            </View>
          </View>

          {/* Notification Categories */}
          <View className="bg-surface rounded-2xl p-4 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-4">
              Notification Categories
            </Text>

            <View className="gap-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-foreground font-medium">Transactions</Text>
                  <Text className="text-muted text-sm mt-1">
                    Deposits, withdrawals, and transfers
                  </Text>
                </View>
                <Switch
                  value={preferences.categories.transaction}
                  onValueChange={(value) => handleToggle('categories', 'transaction', value)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                  disabled={saving}
                />
              </View>

              <View className="h-px bg-border" />

              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-foreground font-medium">Bills & Payments</Text>
                  <Text className="text-muted text-sm mt-1">
                    Upcoming bills and payment reminders
                  </Text>
                </View>
                <Switch
                  value={preferences.categories.bill}
                  onValueChange={(value) => handleToggle('categories', 'bill', value)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                  disabled={saving}
                />
              </View>

              <View className="h-px bg-border" />

              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-foreground font-medium">Savings Goals</Text>
                  <Text className="text-muted text-sm mt-1">
                    Goal progress and milestones
                  </Text>
                </View>
                <Switch
                  value={preferences.categories.goal}
                  onValueChange={(value) => handleToggle('categories', 'goal', value)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                  disabled={saving}
                />
              </View>

              <View className="h-px bg-border" />

              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-foreground font-medium">Balance Alerts</Text>
                  <Text className="text-muted text-sm mt-1">
                    Low balance and threshold alerts
                  </Text>
                </View>
                <Switch
                  value={preferences.categories.balance}
                  onValueChange={(value) => handleToggle('categories', 'balance', value)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                  disabled={saving}
                />
              </View>

              <View className="h-px bg-border" />

              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-foreground font-medium">Security</Text>
                  <Text className="text-muted text-sm mt-1">
                    Login alerts and security updates
                  </Text>
                </View>
                <Switch
                  value={preferences.categories.security}
                  onValueChange={(value) => handleToggle('categories', 'security', value)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                  disabled={saving}
                />
              </View>
            </View>
          </View>

          {/* Saving indicator */}
          {saving && (
            <View className="flex-row items-center justify-center gap-2 py-2">
              <ActivityIndicator size="small" color={colors.primary} />
              <Text className="text-muted">Saving...</Text>
            </View>
          )}

          {/* Info note */}
          <View className="bg-surface rounded-xl p-4 border border-border">
            <Text className="text-muted text-sm">
              <Text className="font-semibold">Note:</Text> Security notifications cannot be disabled
              and will always be sent to keep your account safe.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
