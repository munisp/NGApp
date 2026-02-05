import { View, Text, TouchableOpacity, ScrollView, Switch, Alert } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

interface NotificationPreferences {
  transaction_max_per_day: number;
  transaction_min_interval: number;
  bill_max_per_day: number;
  bill_min_interval: number;
  goal_max_per_day: number;
  goal_min_interval: number;
  balance_max_per_day: number;
  balance_min_interval: number;
  security_max_per_day: number;
  security_min_interval: number;
}

const NOTIFICATION_TYPES = [
  {
    id: "transaction",
    name: "Transactions",
    description: "Alerts for incoming and outgoing transactions",
    icon: "💳",
  },
  {
    id: "bill",
    name: "Bills",
    description: "Reminders for upcoming bill payments",
    icon: "📄",
  },
  {
    id: "goal",
    name: "Goals",
    description: "Progress updates on savings goals",
    icon: "🎯",
  },
  {
    id: "balance",
    name: "Balance",
    description: "Low balance and threshold alerts",
    icon: "💰",
  },
  {
    id: "security",
    name: "Security",
    description: "Security and fraud alerts",
    icon: "🔒",
  },
];

export default function SmartNotificationsScreen() {
  const colors = useColors();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [enabledTypes, setEnabledTypes] = useState<Record<string, boolean>>({
    transaction: true,
    bill: true,
    goal: true,
    balance: true,
    security: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const preferencesQuery = trpc.smartNotifications.getPreferences.useQuery();
  const updatePreferencesMutation = trpc.smartNotifications.updatePreferences.useMutation();

  useEffect(() => {
    if (preferencesQuery.data) {
      setPreferences(preferencesQuery.data as NotificationPreferences);
      setIsLoading(false);
    }
  }, [preferencesQuery.data]);

  const handleToggleType = (typeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEnabledTypes((prev) => ({
      ...prev,
      [typeId]: !prev[typeId],
    }));
  };

  const handleSavePreferences = async () => {
    if (!preferences) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSaving(true);

    try {
      await updatePreferencesMutation.mutateAsync(preferences);
      Alert.alert("Success", "Notification preferences saved successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to save preferences");
    } finally {
      setIsSaving(false);
    }
  };

  const updatePreference = (key: keyof NotificationPreferences, value: number) => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      [key]: value,
    });
  };

  if (isLoading) {
    return (
      <ScreenContainer className="p-6 items-center justify-center">
        <Text className="text-lg text-muted">Loading preferences...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View>
            <Text className="text-2xl font-bold text-foreground">Smart Notifications</Text>
            <Text className="text-base text-muted mt-2">
              AI-powered notifications that learn your preferences
            </Text>
          </View>

          {/* How It Works */}
          <View
            className="rounded-xl p-4"
            style={{
              backgroundColor: colors.primary + "10",
              borderColor: colors.primary,
              borderWidth: 1,
            }}
          >
            <Text className="text-base font-semibold text-foreground mb-2">
              🧠 How Smart Notifications Work
            </Text>
            <Text className="text-sm text-muted leading-relaxed">
              Our AI learns from your interactions to optimize notification timing, relevance, and
              frequency. Over time, you'll receive fewer unnecessary alerts and more important ones
              at the right time.
            </Text>
          </View>

          {/* Notification Types */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Notification Types</Text>

            {NOTIFICATION_TYPES.map((type) => {
              const isEnabled = enabledTypes[type.id];
              const maxPerDay = preferences?.[`${type.id}_max_per_day` as keyof NotificationPreferences] || 0;
              const minInterval = preferences?.[`${type.id}_min_interval` as keyof NotificationPreferences] || 0;

              return (
                <View
                  key={type.id}
                  className="rounded-xl p-4 border"
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: isEnabled ? colors.primary : colors.border,
                    borderWidth: isEnabled ? 2 : 1,
                  }}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center gap-3 flex-1">
                      <Text className="text-2xl">{type.icon}</Text>
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-foreground">{type.name}</Text>
                        <Text className="text-sm text-muted">{type.description}</Text>
                      </View>
                    </View>
                    <Switch
                      value={isEnabled}
                      onValueChange={() => handleToggleType(type.id)}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor={isEnabled ? "#FFFFFF" : "#F4F3F4"}
                    />
                  </View>

                  {isEnabled && (
                    <View className="mt-3 pt-3 gap-2" style={{ borderTopWidth: 1, borderColor: colors.border }}>
                      <View className="flex-row justify-between items-center">
                        <Text className="text-sm text-muted">Max per day</Text>
                        <Text className="text-sm font-medium text-foreground">{maxPerDay}</Text>
                      </View>
                      <View className="flex-row justify-between items-center">
                        <Text className="text-sm text-muted">Min interval</Text>
                        <Text className="text-sm font-medium text-foreground">
                          {minInterval >= 60 ? `${Math.floor(minInterval / 60)}h` : `${minInterval}m`}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* AI Learning Status */}
          <View
            className="rounded-xl p-4 border"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            <Text className="text-base font-semibold text-foreground mb-3">AI Learning Status</Text>

            <View className="gap-2">
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">Notifications sent</Text>
                <Text className="text-sm font-medium text-foreground">247</Text>
              </View>

              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">Engagement rate</Text>
                <Text className="text-sm font-medium" style={{ color: colors.success }}>
                  68%
                </Text>
              </View>

              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">Optimal time learned</Text>
                <Text className="text-sm font-medium text-foreground">9:00 AM</Text>
              </View>

              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">Learning confidence</Text>
                <Text className="text-sm font-medium" style={{ color: colors.primary }}>
                  High
                </Text>
              </View>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSavePreferences}
            disabled={isSaving}
            className="rounded-xl p-4 items-center"
            style={{
              backgroundColor: isSaving ? colors.border : colors.primary,
            }}
          >
            <Text className="text-base font-semibold text-white">
              {isSaving ? "Saving..." : "Save Preferences"}
            </Text>
          </TouchableOpacity>

          {/* Info */}
          <View
            className="rounded-xl p-4"
            style={{ backgroundColor: colors.surface }}
          >
            <Text className="text-sm text-muted leading-relaxed">
              The AI continuously learns from your interactions. Tap on notifications you find useful
              and dismiss irrelevant ones to improve accuracy over time.
            </Text>
          </View>

          {/* Bottom Spacing */}
          <View className="h-8" />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
