import { ScrollView, Text, View, Pressable, Alert, Switch } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  getBudgetAlerts,
  getBudgetAlertSettings,
  updateBudgetAlertSettings,
  acknowledgeAlert,
  acknowledgeAllAlerts,
  getAlertStatistics,
  formatAlertMessage,
  checkBudgetAndAlert,
  type BudgetAlert,
  type BudgetAlertSettings,
} from "@/utils/budget-alerts";

export default function BudgetAlertsScreen() {
  const colors = useColors();
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [settings, setSettings] = useState<BudgetAlertSettings | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [alertsData, settingsData, statsData] = await Promise.all([
      getBudgetAlerts(),
      getBudgetAlertSettings(),
      getAlertStatistics(),
    ]);
    
    setAlerts(alertsData);
    setSettings(settingsData);
    setStats(statsData);
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const success = await acknowledgeAlert(alertId);
      
      if (success) {
        await loadData();
      } else {
        Alert.alert("Error", "Failed to acknowledge alert");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to acknowledge alert");
    }
  };

  const handleAcknowledgeAll = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const success = await acknowledgeAllAlerts();
      
      if (success) {
        await loadData();
        Alert.alert("Success", "All alerts acknowledged");
      } else {
        Alert.alert("Error", "Failed to acknowledge alerts");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to acknowledge alerts");
    }
  };

  const handleUpdateSetting = async (key: keyof BudgetAlertSettings, value: any) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const success = await updateBudgetAlertSettings({ [key]: value });
      
      if (success) {
        await loadData();
      } else {
        Alert.alert("Error", "Failed to update setting");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update setting");
    }
  };

  const handleTestAlert = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Create test alert
      const testAlert = await checkBudgetAndAlert("Food", 500, 450);
      
      if (testAlert) {
        await loadData();
        Alert.alert("Test Alert Created", formatAlertMessage(testAlert));
      } else {
        Alert.alert("Info", "Alerts are disabled or threshold not met");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to create test alert");
    }
  };

  if (showSettings && settings) {
    return (
      <ScreenContainer className="p-6">
        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="gap-6">
            <View className="flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-foreground">Alert Settings</Text>
              <Pressable onPress={() => setShowSettings(false)}>
                <Text className="text-base text-muted">Done</Text>
              </Pressable>
            </View>

            <View className="gap-4">
              <View
                style={{ backgroundColor: colors.surface }}
                className="rounded-xl p-4 border border-border"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-foreground">
                      Enable Budget Alerts
                    </Text>
                    <Text className="text-sm text-muted">
                      Receive notifications when approaching budget limits
                    </Text>
                  </View>
                  <Switch
                    value={settings.enabled}
                    onValueChange={(value) => handleUpdateSetting("enabled", value)}
                    trackColor={{
                      false: colors.border,
                      true: colors.primary,
                    }}
                    thumbColor={colors.background}
                  />
                </View>
              </View>

              <View
                style={{ backgroundColor: colors.surface }}
                className="rounded-xl p-4 border border-border"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-foreground">
                      Notify on Approaching
                    </Text>
                    <Text className="text-sm text-muted">
                      Alert when reaching threshold percentage
                    </Text>
                  </View>
                  <Switch
                    value={settings.notify_on_approach}
                    onValueChange={(value) => handleUpdateSetting("notify_on_approach", value)}
                    trackColor={{
                      false: colors.border,
                      true: colors.primary,
                    }}
                    thumbColor={colors.background}
                  />
                </View>
              </View>

              <View
                style={{ backgroundColor: colors.surface }}
                className="rounded-xl p-4 border border-border"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-foreground">
                      Notify on Exceeded
                    </Text>
                    <Text className="text-sm text-muted">Alert when budget is exceeded</Text>
                  </View>
                  <Switch
                    value={settings.notify_on_exceed}
                    onValueChange={(value) => handleUpdateSetting("notify_on_exceed", value)}
                    trackColor={{
                      false: colors.border,
                      true: colors.primary,
                    }}
                    thumbColor={colors.background}
                  />
                </View>
              </View>

              <View
                style={{ backgroundColor: colors.surface }}
                className="rounded-xl p-4 border border-border gap-3"
              >
                <Text className="text-base font-semibold text-foreground">
                  Alert Threshold: {settings.threshold_percentage}%
                </Text>
                <Text className="text-sm text-muted">
                  Get notified when you reach this percentage of your budget
                </Text>
                <View className="flex-row gap-2">
                  {[70, 80, 90, 95].map((threshold) => (
                    <Pressable
                      key={threshold}
                      onPress={() => handleUpdateSetting("threshold_percentage", threshold)}
                      style={({ pressed }) => [
                        {
                          backgroundColor:
                            settings.threshold_percentage === threshold
                              ? colors.primary
                              : colors.background,
                          borderColor: colors.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                      className="flex-1 rounded-lg py-2 border"
                    >
                      <Text
                        style={{
                          color:
                            settings.threshold_percentage === threshold
                              ? colors.background
                              : colors.foreground,
                        }}
                        className="text-center font-semibold text-sm"
                      >
                        {threshold}%
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Pressable
                onPress={handleTestAlert}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                className="rounded-xl py-3"
              >
                <Text
                  style={{ color: colors.background }}
                  className="text-center font-semibold text-base"
                >
                  Test Alert
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          <View className="flex-row items-center justify-between">
            <View className="gap-1">
              <Text className="text-2xl font-bold text-foreground">Budget Alerts</Text>
              <Text className="text-sm text-muted">Monitor your spending limits</Text>
            </View>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowSettings(true);
              }}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              className="px-3 py-2 rounded-full border"
            >
              <Text className="text-sm font-semibold text-foreground">⚙️</Text>
            </Pressable>
          </View>

          {/* Statistics */}
          {stats && (
            <View className="flex-row gap-3">
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Unread</Text>
                <Text
                  style={{ color: stats.unacknowledged > 0 ? colors.warning : colors.success }}
                  className="text-2xl font-bold"
                >
                  {stats.unacknowledged}
                </Text>
              </View>
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Exceeded</Text>
                <Text
                  style={{ color: stats.exceeded > 0 ? colors.error : colors.success }}
                  className="text-2xl font-bold"
                >
                  {stats.exceeded}
                </Text>
              </View>
            </View>
          )}

          {/* Acknowledge All */}
          {stats && stats.unacknowledged > 0 && (
            <Pressable
              onPress={handleAcknowledgeAll}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.primary + "20",
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              className="rounded-xl py-3"
            >
              <Text
                style={{ color: colors.primary }}
                className="text-center font-semibold text-base"
              >
                Acknowledge All Alerts
              </Text>
            </Pressable>
          )}

          {/* Alerts List */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">
              {alerts.length} Alerts
            </Text>
            
            {alerts.length > 0 ? (
              alerts.map((alert) => (
                <View
                  key={alert.id}
                  style={{
                    backgroundColor: alert.acknowledged
                      ? colors.surface
                      : alert.alert_type === "exceeded"
                      ? colors.error + "10"
                      : colors.warning + "10",
                    borderColor: alert.acknowledged
                      ? colors.border
                      : alert.alert_type === "exceeded"
                      ? colors.error
                      : colors.warning,
                  }}
                  className="rounded-xl p-4 border"
                >
                  <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2 mb-1">
                        <Text className="text-2xl">
                          {alert.alert_type === "exceeded" ? "🚨" : "⚠️"}
                        </Text>
                        <Text className="text-base font-semibold text-foreground">
                          {alert.category}
                        </Text>
                      </View>
                      <Text className="text-sm text-muted">
                        {new Date(alert.timestamp).toLocaleString()}
                      </Text>
                    </View>
                    
                    <View
                      style={{
                        backgroundColor:
                          alert.alert_type === "exceeded"
                            ? colors.error + "20"
                            : colors.warning + "20",
                      }}
                      className="px-2 py-1 rounded-full"
                    >
                      <Text
                        style={{
                          color: alert.alert_type === "exceeded" ? colors.error : colors.warning,
                        }}
                        className="text-xs font-semibold"
                      >
                        {alert.alert_type === "exceeded" ? "Exceeded" : "Approaching"}
                      </Text>
                    </View>
                  </View>
                  
                  <Text className="text-sm text-foreground mb-3">
                    {formatAlertMessage(alert)}
                  </Text>
                  
                  {!alert.acknowledged && (
                    <Pressable
                      onPress={() => handleAcknowledge(alert.id)}
                      style={({ pressed }) => [
                        {
                          backgroundColor: colors.primary,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                      className="rounded-lg py-2"
                    >
                      <Text
                        style={{ color: colors.background }}
                        className="text-center font-semibold text-sm"
                      >
                        Acknowledge
                      </Text>
                    </Pressable>
                  )}
                </View>
              ))
            ) : (
              <View className="items-center py-12">
                <Text className="text-6xl mb-4">✅</Text>
                <Text className="text-lg font-semibold text-foreground mb-2">
                  No Budget Alerts
                </Text>
                <Text className="text-sm text-muted text-center">
                  You're staying within your budgets!
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
