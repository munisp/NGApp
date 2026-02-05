import { View, Text, ScrollView, Pressable, Switch, TextInput, RefreshControl } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const haptic = () => {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
};

export default function SpendingAlertsScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const { data: alerts, refetch: refetchAlerts } = trpc.spendingAlerts.getAlerts.useQuery({
    includeRead: false,
    includeDismissed: false,
  });

  const { data: settings, refetch: refetchSettings } = trpc.spendingAlerts.getSettings.useQuery();

  const markAsRead = trpc.spendingAlerts.markAsRead.useMutation({
    onSuccess: () => {
      refetchAlerts();
      haptic();
    },
  });

  const dismissAlert = trpc.spendingAlerts.dismissAlert.useMutation({
    onSuccess: () => {
      refetchAlerts();
      haptic();
    },
  });

  const updateSettings = trpc.spendingAlerts.updateSettings.useMutation({
    onSuccess: () => {
      refetchSettings();
      haptic();
    },
  });

  const analyzeTransactions = trpc.spendingAlerts.analyzeTransactions.useMutation({
    onSuccess: () => {
      refetchAlerts();
      haptic();
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchAlerts(), refetchSettings()]);
    setRefreshing(false);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "#EF4444";
      case "medium":
        return "#F59E0B";
      case "low":
        return "#3B82F6";
      default:
        return colors.muted;
    }
  };

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case "duplicate_charge":
        return "⚠️";
      case "large_transaction":
        return "💰";
      case "merchant_change":
        return "🏪";
      case "unusual_category":
        return "📊";
      case "spending_spike":
        return "📈";
      default:
        return "🔔";
    }
  };

  if (showSettings && settings) {
    return (
      <ScreenContainer className="p-4">
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-6">
            <Pressable
              onPress={() => {
                setShowSettings(false);
                haptic();
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text style={{ color: colors.primary }} className="text-base font-semibold">
                ← Back to Alerts
              </Text>
            </Pressable>
          </View>

          <Text style={{ color: colors.foreground }} className="text-2xl font-bold mb-6">
            Alert Settings
          </Text>

          {/* Alert Types */}
          <View className="mb-6">
            <Text style={{ color: colors.foreground }} className="text-lg font-semibold mb-4">
              Alert Types
            </Text>

            <View style={{ backgroundColor: colors.surface }} className="rounded-xl p-4 mb-3">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-1">
                  <Text style={{ color: colors.foreground }} className="text-base font-semibold">
                    Duplicate Charges
                  </Text>
                  <Text style={{ color: colors.muted }} className="text-sm">
                    Alert when same merchant charges twice within 24 hours
                  </Text>
                </View>
                <Switch
                  value={settings.duplicateChargeEnabled}
                  onValueChange={(value) => {
                    updateSettings.mutate({ duplicateChargeEnabled: value });
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
            </View>

            <View style={{ backgroundColor: colors.surface }} className="rounded-xl p-4 mb-3">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-1">
                  <Text style={{ color: colors.foreground }} className="text-base font-semibold">
                    Large Transactions
                  </Text>
                  <Text style={{ color: colors.muted }} className="text-sm">
                    Alert when transaction exceeds threshold
                  </Text>
                </View>
                <Switch
                  value={settings.largeTransactionEnabled}
                  onValueChange={(value) => {
                    updateSettings.mutate({ largeTransactionEnabled: value });
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
              {settings.largeTransactionEnabled && (
                <View className="mt-3">
                  <Text style={{ color: colors.muted }} className="text-sm mb-2">
                    Threshold Amount ($)
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: colors.background,
                      color: colors.foreground,
                      borderColor: colors.border,
                    }}
                    className="border rounded-lg px-4 py-3"
                    keyboardType="numeric"
                    value={settings.largeTransactionThreshold}
                    onChangeText={(value) => {
                      const numValue = parseFloat(value) || 500;
                      updateSettings.mutate({ largeTransactionThreshold: numValue });
                    }}
                    placeholder="500"
                    placeholderTextColor={colors.muted}
                  />
                </View>
              )}
            </View>

            <View style={{ backgroundColor: colors.surface }} className="rounded-xl p-4 mb-3">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-1">
                  <Text style={{ color: colors.foreground }} className="text-base font-semibold">
                    Merchant Changes
                  </Text>
                  <Text style={{ color: colors.muted }} className="text-sm">
                    Alert when merchant category changes unexpectedly
                  </Text>
                </View>
                <Switch
                  value={settings.merchantChangeEnabled}
                  onValueChange={(value) => {
                    updateSettings.mutate({ merchantChangeEnabled: value });
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
            </View>

            <View style={{ backgroundColor: colors.surface }} className="rounded-xl p-4 mb-3">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-1">
                  <Text style={{ color: colors.foreground }} className="text-base font-semibold">
                    Unusual Category Spending
                  </Text>
                  <Text style={{ color: colors.muted }} className="text-sm">
                    Alert when spending in a category is unusual
                  </Text>
                </View>
                <Switch
                  value={settings.unusualCategoryEnabled}
                  onValueChange={(value) => {
                    updateSettings.mutate({ unusualCategoryEnabled: value });
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
            </View>

            <View style={{ backgroundColor: colors.surface }} className="rounded-xl p-4 mb-3">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-1">
                  <Text style={{ color: colors.foreground }} className="text-base font-semibold">
                    Spending Spikes
                  </Text>
                  <Text style={{ color: colors.muted }} className="text-sm">
                    Alert when daily spending is 2x your average
                  </Text>
                </View>
                <Switch
                  value={settings.spendingSpikeEnabled}
                  onValueChange={(value) => {
                    updateSettings.mutate({ spendingSpikeEnabled: value });
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
            </View>
          </View>

          {/* Notification Preferences */}
          <View className="mb-6">
            <Text style={{ color: colors.foreground }} className="text-lg font-semibold mb-4">
              Notification Preferences
            </Text>

            <View style={{ backgroundColor: colors.surface }} className="rounded-xl p-4 mb-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text style={{ color: colors.foreground }} className="text-base font-semibold">
                    Push Notifications
                  </Text>
                  <Text style={{ color: colors.muted }} className="text-sm">
                    Receive alerts on your device
                  </Text>
                </View>
                <Switch
                  value={settings.pushNotificationsEnabled}
                  onValueChange={(value) => {
                    updateSettings.mutate({ pushNotificationsEnabled: value });
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
            </View>

            <View style={{ backgroundColor: colors.surface }} className="rounded-xl p-4 mb-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text style={{ color: colors.foreground }} className="text-base font-semibold">
                    Email Notifications
                  </Text>
                  <Text style={{ color: colors.muted }} className="text-sm">
                    Receive alerts via email
                  </Text>
                </View>
                <Switch
                  value={settings.emailNotificationsEnabled}
                  onValueChange={(value) => {
                    updateSettings.mutate({ emailNotificationsEnabled: value });
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-4">
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center justify-between mb-6">
          <Text style={{ color: colors.foreground }} className="text-2xl font-bold">
            Spending Alerts
          </Text>
          <Pressable
            onPress={() => {
              setShowSettings(true);
              haptic();
            }}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              backgroundColor: colors.surface,
            })}
            className="px-4 py-2 rounded-lg"
          >
            <Text style={{ color: colors.primary }} className="text-sm font-semibold">
              Settings
            </Text>
          </Pressable>
        </View>

        {/* Analyze Button */}
        <Pressable
          onPress={() => {
            analyzeTransactions.mutate();
            haptic();
          }}
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
            backgroundColor: colors.primary,
          })}
          className="rounded-xl p-4 mb-6"
        >
          <Text style={{ color: colors.background }} className="text-center text-base font-semibold">
            {analyzeTransactions.isPending ? "Analyzing..." : "Analyze Transactions"}
          </Text>
        </Pressable>

        {/* Alerts List */}
        {alerts && alerts.length > 0 ? (
          <View>
            {alerts.map((alert) => (
              <View
                key={alert.id}
                style={{
                  backgroundColor: colors.surface,
                  borderLeftColor: getSeverityColor(alert.severity),
                }}
                className="rounded-xl p-4 mb-3 border-l-4"
              >
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1">
                    <View className="flex-row items-center mb-2">
                      <Text className="text-2xl mr-2">{getAlertIcon(alert.alertType)}</Text>
                      <View
                        style={{ backgroundColor: getSeverityColor(alert.severity) }}
                        className="px-2 py-1 rounded"
                      >
                        <Text style={{ color: "#FFFFFF" }} className="text-xs font-semibold uppercase">
                          {alert.severity}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ color: colors.foreground }} className="text-base font-semibold mb-1">
                      {alert.description}
                    </Text>
                    {alert.merchant && (
                      <Text style={{ color: colors.muted }} className="text-sm mb-1">
                        {alert.merchant}
                      </Text>
                    )}
                    {alert.category && (
                      <Text style={{ color: colors.muted }} className="text-sm mb-1">
                        Category: {alert.category}
                      </Text>
                    )}
                    <Text style={{ color: colors.muted }} className="text-xs">
                      {new Date(alert.createdAt).toLocaleDateString()} at{" "}
                      {new Date(alert.createdAt).toLocaleTimeString()}
                    </Text>
                  </View>
                </View>

                <View className="flex-row gap-2 mt-3">
                  <Pressable
                    onPress={() => {
                      markAsRead.mutate({ alertId: alert.id });
                    }}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.7 : 1,
                      backgroundColor: colors.primary,
                    })}
                    className="flex-1 py-2 rounded-lg"
                  >
                    <Text style={{ color: colors.background }} className="text-center text-sm font-semibold">
                      Mark as Read
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      dismissAlert.mutate({ alertId: alert.id });
                    }}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.7 : 1,
                      backgroundColor: colors.border,
                    })}
                    className="flex-1 py-2 rounded-lg"
                  >
                    <Text style={{ color: colors.foreground }} className="text-center text-sm font-semibold">
                      Dismiss
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={{ backgroundColor: colors.surface }} className="rounded-xl p-8 items-center">
            <Text className="text-4xl mb-4">✅</Text>
            <Text style={{ color: colors.foreground }} className="text-lg font-semibold mb-2 text-center">
              No Active Alerts
            </Text>
            <Text style={{ color: colors.muted }} className="text-sm text-center">
              Your spending looks normal. We'll notify you if we detect any unusual activity.
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
