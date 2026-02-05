import { ScrollView, Text, View, TouchableOpacity, Switch, TextInput, RefreshControl, Platform } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  getNotificationAlerts,
  getNotificationPreferences,
  updateNotificationPreferences,
  getStockPriceAlerts,
  addStockPriceAlert,
  removeStockPriceAlert,
  updateStockPriceAlert,
  markAlertAsRead,
  markAllAlertsAsRead,
  deleteAlert,
  clearAllAlerts,
  getUnreadCount,
  simulateNotifications,
  requestNotificationPermissions,
  type NotificationAlert,
  type NotificationPreferences,
  type StockPriceAlert,
} from "@/utils/notification-system";

export default function NotificationSystemScreen() {
  const colors = useColors();
  const [alerts, setAlerts] = useState<NotificationAlert[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [stockAlerts, setStockAlerts] = useState<StockPriceAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState<"alerts" | "preferences" | "stock_alerts">("alerts");
  const [refreshing, setRefreshing] = useState(false);
  const [newStockSymbol, setNewStockSymbol] = useState("");
  const [newStockPrice, setNewStockPrice] = useState("");
  const [newStockCondition, setNewStockCondition] = useState<"above" | "below">("above");

  useEffect(() => {
    loadData();
    requestNotificationPermissions();
  }, []);

  const loadData = async () => {
    const [alertsData, prefsData, stockAlertsData, unread] = await Promise.all([
      getNotificationAlerts(),
      getNotificationPreferences(),
      getStockPriceAlerts(),
      getUnreadCount(),
    ]);

    setAlerts(alertsData);
    setPreferences(prefsData);
    setStockAlerts(stockAlertsData);
    setUnreadCount(unread);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleTogglePreference = async (key: keyof NotificationPreferences) => {
    if (!preferences) return;

    const updated = { ...preferences, [key]: !preferences[key] };
    setPreferences(updated);
    await updateNotificationPreferences({ [key]: updated[key] });

    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleMarkAsRead = async (alertId: string) => {
    await markAlertAsRead(alertId);
    await loadData();
  };

  const handleMarkAllAsRead = async () => {
    await markAllAlertsAsRead();
    await loadData();
  };

  const handleDeleteAlert = async (alertId: string) => {
    await deleteAlert(alertId);
    await loadData();
  };

  const handleClearAll = async () => {
    await clearAllAlerts();
    await loadData();
  };

  const handleAddStockAlert = async () => {
    if (!newStockSymbol || !newStockPrice) return;

    const price = parseFloat(newStockPrice);
    if (isNaN(price) || price <= 0) return;

    await addStockPriceAlert({
      symbol: newStockSymbol.toUpperCase(),
      targetPrice: price,
      condition: newStockCondition,
      enabled: true,
    });

    setNewStockSymbol("");
    setNewStockPrice("");
    await loadData();

    if (Platform.OS !== "web") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleToggleStockAlert = async (symbol: string, enabled: boolean) => {
    await updateStockPriceAlert(symbol, { enabled });
    await loadData();
  };

  const handleRemoveStockAlert = async (symbol: string) => {
    await removeStockPriceAlert(symbol);
    await loadData();
  };

  const handleSimulateNotifications = async () => {
    await simulateNotifications();
    await loadData();

    if (Platform.OS !== "web") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  if (!preferences) {
    return (
      <ScreenContainer className="p-4 justify-center items-center">
        <Text className="text-muted">Loading notifications...</Text>
      </ScreenContainer>
    );
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "stock_price":
        return "📈";
      case "loyalty_reward":
        return "🎁";
      case "health_score":
        return "💪";
      case "transaction":
        return "💳";
      case "bill_due":
        return "📅";
      case "goal_milestone":
        return "🎯";
      default:
        return "🔔";
    }
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Header */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-3xl font-bold text-foreground">Notifications</Text>
              <Text className="text-sm text-muted mt-1">Manage your alerts and preferences</Text>
            </View>
            {unreadCount > 0 && (
              <View className="bg-error rounded-full px-3 py-1">
                <Text className="text-background font-bold">{unreadCount}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Tabs */}
        <View className="flex-row mb-4 bg-surface rounded-xl p-1">
          {(["alerts", "preferences", "stock_alerts"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg ${activeTab === tab ? "bg-primary" : ""}`}
            >
              <Text
                className={`text-center font-semibold text-xs ${
                  activeTab === tab ? "text-background" : "text-muted"
                }`}
              >
                {tab === "stock_alerts" ? "Stock" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Alerts Tab */}
        {activeTab === "alerts" && (
          <View>
            {alerts.length > 0 && (
              <View className="flex-row justify-between mb-4">
                <TouchableOpacity
                  onPress={handleMarkAllAsRead}
                  className="bg-surface px-4 py-2 rounded-lg border border-border"
                >
                  <Text className="text-primary font-semibold">Mark All Read</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleClearAll}
                  className="bg-surface px-4 py-2 rounded-lg border border-border"
                >
                  <Text className="text-error font-semibold">Clear All</Text>
                </TouchableOpacity>
              </View>
            )}

            {alerts.length === 0 ? (
              <View className="bg-surface rounded-xl p-6 border border-border items-center">
                <Text className="text-4xl mb-4">🔔</Text>
                <Text className="text-muted text-center mb-4">No notifications yet</Text>
                <TouchableOpacity
                  onPress={handleSimulateNotifications}
                  className="bg-primary px-6 py-3 rounded-full"
                >
                  <Text className="text-background font-semibold">Simulate Notifications</Text>
                </TouchableOpacity>
              </View>
            ) : (
              alerts.map((alert) => (
                <TouchableOpacity
                  key={alert.id}
                  onPress={() => handleMarkAsRead(alert.id)}
                  className={`bg-surface rounded-xl p-4 mb-3 border ${
                    alert.read ? "border-border" : "border-primary"
                  }`}
                >
                  <View className="flex-row items-start">
                    <Text className="text-3xl mr-3">{getAlertIcon(alert.type)}</Text>
                    <View className="flex-1">
                      <Text className={`text-base font-bold ${alert.read ? "text-muted" : "text-foreground"}`}>
                        {alert.title}
                      </Text>
                      <Text className={`text-sm mt-1 ${alert.read ? "text-muted" : "text-foreground"}`}>
                        {alert.body}
                      </Text>
                      <Text className="text-xs text-muted mt-2">
                        {new Date(alert.timestamp).toLocaleString()}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteAlert(alert.id)} className="ml-2">
                      <Text className="text-error text-lg">×</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Preferences Tab */}
        {activeTab === "preferences" && (
          <View>
            <View className="bg-surface rounded-xl p-4 mb-4 border border-border">
              <View className="flex-row justify-between items-center mb-4">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">Push Notifications</Text>
                  <Text className="text-sm text-muted">Enable all push notifications</Text>
                </View>
                <Switch
                  value={preferences.pushEnabled}
                  onValueChange={() => handleTogglePreference("pushEnabled")}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>

              <View className="flex-row justify-between items-center mb-4">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">Stock Price Alerts</Text>
                  <Text className="text-sm text-muted">Notify when stocks hit target prices</Text>
                </View>
                <Switch
                  value={preferences.stockPriceAlerts}
                  onValueChange={() => handleTogglePreference("stockPriceAlerts")}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>

              <View className="flex-row justify-between items-center mb-4">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">Loyalty Rewards</Text>
                  <Text className="text-sm text-muted">Notify when you earn points</Text>
                </View>
                <Switch
                  value={preferences.loyaltyRewards}
                  onValueChange={() => handleTogglePreference("loyaltyRewards")}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>

              <View className="flex-row justify-between items-center mb-4">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">Health Score Changes</Text>
                  <Text className="text-sm text-muted">Notify when your score changes</Text>
                </View>
                <Switch
                  value={preferences.healthScoreChanges}
                  onValueChange={() => handleTogglePreference("healthScoreChanges")}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>

              <View className="flex-row justify-between items-center mb-4">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">Transactions</Text>
                  <Text className="text-sm text-muted">Notify for all transactions</Text>
                </View>
                <Switch
                  value={preferences.transactions}
                  onValueChange={() => handleTogglePreference("transactions")}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>

              <View className="flex-row justify-between items-center mb-4">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">Bill Due Dates</Text>
                  <Text className="text-sm text-muted">Remind me when bills are due</Text>
                </View>
                <Switch
                  value={preferences.billDue}
                  onValueChange={() => handleTogglePreference("billDue")}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>

              <View className="flex-row justify-between items-center">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">Goal Milestones</Text>
                  <Text className="text-sm text-muted">Celebrate progress on goals</Text>
                </View>
                <Switch
                  value={preferences.goalMilestones}
                  onValueChange={() => handleTogglePreference("goalMilestones")}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>
            </View>
          </View>
        )}

        {/* Stock Alerts Tab */}
        {activeTab === "stock_alerts" && (
          <View>
            <View className="bg-surface rounded-xl p-4 mb-4 border border-border">
              <Text className="text-lg font-bold text-foreground mb-4">Add Stock Price Alert</Text>

              <TextInput
                value={newStockSymbol}
                onChangeText={setNewStockSymbol}
                placeholder="Stock Symbol (e.g., AAPL)"
                placeholderTextColor={colors.muted}
                className="bg-background border border-border rounded-lg px-4 py-3 text-foreground mb-3"
                autoCapitalize="characters"
              />

              <TextInput
                value={newStockPrice}
                onChangeText={setNewStockPrice}
                placeholder="Target Price"
                keyboardType="numeric"
                placeholderTextColor={colors.muted}
                className="bg-background border border-border rounded-lg px-4 py-3 text-foreground mb-3"
              />

              <View className="flex-row mb-4">
                <TouchableOpacity
                  onPress={() => setNewStockCondition("above")}
                  className={`flex-1 py-3 rounded-lg mr-2 ${
                    newStockCondition === "above" ? "bg-success" : "bg-background border border-border"
                  }`}
                >
                  <Text
                    className={`text-center font-semibold ${
                      newStockCondition === "above" ? "text-background" : "text-foreground"
                    }`}
                  >
                    Above
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setNewStockCondition("below")}
                  className={`flex-1 py-3 rounded-lg ml-2 ${
                    newStockCondition === "below" ? "bg-error" : "bg-background border border-border"
                  }`}
                >
                  <Text
                    className={`text-center font-semibold ${
                      newStockCondition === "below" ? "text-background" : "text-foreground"
                    }`}
                  >
                    Below
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={handleAddStockAlert}
                className="bg-primary rounded-xl py-4 items-center"
              >
                <Text className="text-background font-bold text-lg">Add Alert</Text>
              </TouchableOpacity>
            </View>

            {stockAlerts.length === 0 ? (
              <View className="bg-surface rounded-xl p-6 border border-border items-center">
                <Text className="text-muted text-center">No stock price alerts configured</Text>
              </View>
            ) : (
              stockAlerts.map((alert) => (
                <View key={alert.symbol} className="bg-surface rounded-xl p-4 mb-3 border border-border">
                  <View className="flex-row justify-between items-center">
                    <View className="flex-1">
                      <Text className="text-lg font-bold text-foreground">{alert.symbol}</Text>
                      <Text className="text-sm text-muted">
                        Alert when price goes {alert.condition} ${alert.targetPrice.toFixed(2)}
                      </Text>
                    </View>

                    <View className="flex-row items-center">
                      <Switch
                        value={alert.enabled}
                        onValueChange={(enabled) => handleToggleStockAlert(alert.symbol, enabled)}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor={colors.background}
                      />
                      <TouchableOpacity
                        onPress={() => handleRemoveStockAlert(alert.symbol)}
                        className="ml-3"
                      >
                        <Text className="text-error text-xl">×</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
