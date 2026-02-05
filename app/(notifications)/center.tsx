import { ScrollView, Text, View, Pressable, FlatList, Switch } from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

interface Notification {
  id: string;
  type: "transaction" | "bill" | "goal" | "balance" | "security";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

interface NotificationPreferences {
  transactions: boolean;
  bills: boolean;
  goals: boolean;
  balance: boolean;
  security: boolean;
  marketing: boolean;
}

export default function NotificationCenterScreen() {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    transactions: true,
    bills: true,
    goals: true,
    balance: true,
    security: true,
    marketing: false,
  });

  useEffect(() => {
    loadNotifications();
    loadPreferences();
  }, []);

  const loadNotifications = async () => {
    try {
      const saved = await AsyncStorage.getItem("notification_history");
      if (saved) {
        setNotifications(JSON.parse(saved));
      } else {
        // Mock notifications for demonstration
        const mockNotifications: Notification[] = [
          {
            id: "1",
            type: "transaction",
            title: "Payment Received",
            message: "You received $250.00 from John Doe",
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            read: false,
          },
          {
            id: "2",
            type: "bill",
            title: "Bill Due Soon",
            message: "Your electricity bill of $85.00 is due in 3 days",
            timestamp: new Date(Date.now() - 7200000).toISOString(),
            read: false,
          },
          {
            id: "3",
            type: "goal",
            title: "Goal Milestone Reached",
            message: "You've reached 50% of your Emergency Fund goal!",
            timestamp: new Date(Date.now() - 86400000).toISOString(),
            read: true,
          },
          {
            id: "4",
            type: "balance",
            title: "Low Balance Alert",
            message: "Your checking account balance is below $100",
            timestamp: new Date(Date.now() - 172800000).toISOString(),
            read: true,
          },
          {
            id: "5",
            type: "security",
            title: "Security Alert",
            message: "New device logged into your account",
            timestamp: new Date(Date.now() - 259200000).toISOString(),
            read: true,
          },
        ];
        setNotifications(mockNotifications);
        await AsyncStorage.setItem("notification_history", JSON.stringify(mockNotifications));
      }
    } catch (error) {
      console.error("Failed to load notifications:", error);
    }
  };

  const loadPreferences = async () => {
    try {
      const saved = await AsyncStorage.getItem("notification_preferences");
      if (saved) {
        setPreferences(JSON.parse(saved));
      }
    } catch (error) {
      console.error("Failed to load preferences:", error);
    }
  };

  const savePreferences = async (newPreferences: NotificationPreferences) => {
    try {
      await AsyncStorage.setItem("notification_preferences", JSON.stringify(newPreferences));
      setPreferences(newPreferences);
    } catch (error) {
      console.error("Failed to save preferences:", error);
    }
  };

  const markAsRead = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    setNotifications(updated);
    await AsyncStorage.setItem("notification_history", JSON.stringify(updated));
  };

  const markAllAsRead = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    await AsyncStorage.setItem("notification_history", JSON.stringify(updated));
  };

  const deleteNotification = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = notifications.filter((n) => n.id !== id);
    setNotifications(updated);
    await AsyncStorage.setItem("notification_history", JSON.stringify(updated));
  };

  const clearAll = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNotifications([]);
    await AsyncStorage.removeItem("notification_history");
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "transaction":
        return "💰";
      case "bill":
        return "📄";
      case "goal":
        return "🎯";
      case "balance":
        return "⚠️";
      case "security":
        return "🔒";
      default:
        return "🔔";
    }
  };

  const filteredNotifications =
    activeTab === "unread"
      ? notifications.filter((n) => !n.read)
      : notifications;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const renderNotification = ({ item }: { item: Notification }) => (
    <Pressable
      onPress={() => markAsRead(item.id)}
      style={({ pressed }) => [
        {
          backgroundColor: item.read ? colors.background : colors.surface,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      className="p-4 mb-3 rounded-2xl border border-border"
    >
      <View className="flex-row items-start gap-3">
        <Text className="text-3xl">{getNotificationIcon(item.type)}</Text>
        <View className="flex-1">
          <View className="flex-row items-center justify-between mb-1">
            <Text
              className={`text-base font-semibold ${
                item.read ? "text-muted" : "text-foreground"
              }`}
            >
              {item.title}
            </Text>
            {!item.read && (
              <View
                style={{ backgroundColor: colors.primary }}
                className="w-2 h-2 rounded-full"
              />
            )}
          </View>
          <Text className="text-sm text-muted mb-2">{item.message}</Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-muted">
              {new Date(item.timestamp).toLocaleString()}
            </Text>
            <Pressable
              onPress={() => deleteNotification(item.id)}
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.5 : 1,
                },
              ]}
            >
              <Text className="text-xs text-error">Delete</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Pressable>
  );

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-2xl font-bold text-foreground">
                Notifications
              </Text>
              <Text className="text-sm text-muted">
                {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
              </Text>
            </View>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text className="text-primary font-semibold">Done</Text>
            </Pressable>
          </View>

          {/* Tabs */}
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => {
                setActiveTab("all");
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={({ pressed }) => [
                {
                  backgroundColor:
                    activeTab === "all" ? colors.primary : colors.surface,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              className="flex-1 py-3 rounded-xl"
            >
              <Text
                style={{
                  color: activeTab === "all" ? colors.background : colors.foreground,
                }}
                className="text-center font-semibold"
              >
                All ({notifications.length})
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setActiveTab("unread");
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={({ pressed }) => [
                {
                  backgroundColor:
                    activeTab === "unread" ? colors.primary : colors.surface,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              className="flex-1 py-3 rounded-xl"
            >
              <Text
                style={{
                  color:
                    activeTab === "unread" ? colors.background : colors.foreground,
                }}
                className="text-center font-semibold"
              >
                Unread ({unreadCount})
              </Text>
            </Pressable>
          </View>

          {/* Actions */}
          {notifications.length > 0 && (
            <View className="flex-row gap-3">
              {unreadCount > 0 && (
                <Pressable
                  onPress={markAllAsRead}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.surface,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  className="flex-1 py-3 rounded-xl border border-border"
                >
                  <Text className="text-center font-semibold text-primary">
                    Mark All Read
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={clearAll}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.surface,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                className="flex-1 py-3 rounded-xl border border-border"
              >
                <Text className="text-center font-semibold text-error">
                  Clear All
                </Text>
              </Pressable>
            </View>
          )}

          {/* Notification Preferences */}
          <View
            style={{ backgroundColor: colors.surface }}
            className="p-4 rounded-2xl border border-border"
          >
            <Text className="text-lg font-semibold text-foreground mb-4">
              Notification Preferences
            </Text>
            <View className="gap-4">
              {Object.entries(preferences).map(([key, value]) => (
                <View key={key} className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-base font-medium text-foreground capitalize">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </Text>
                    <Text className="text-xs text-muted">
                      {key === "transactions" && "Get notified about account transactions"}
                      {key === "bills" && "Reminders for upcoming bill payments"}
                      {key === "goals" && "Updates on your savings goals progress"}
                      {key === "balance" && "Alerts when your balance is low"}
                      {key === "security" && "Important security notifications"}
                      {key === "marketing" && "News and promotional offers"}
                    </Text>
                  </View>
                  <Switch
                    value={value}
                    onValueChange={(newValue) => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      savePreferences({ ...preferences, [key]: newValue });
                    }}
                    trackColor={{ false: colors.border, true: colors.primary }}
                  />
                </View>
              ))}
            </View>
          </View>

          {/* Notifications List */}
          {filteredNotifications.length > 0 ? (
            <View className="gap-3">
              <Text className="text-base font-semibold text-foreground">
                Recent Notifications
              </Text>
              {filteredNotifications.map((notification) => (
                <View key={notification.id}>
                  {renderNotification({ item: notification })}
                </View>
              ))}
            </View>
          ) : (
            <View className="items-center py-12">
              <Text className="text-6xl mb-4">🔔</Text>
              <Text className="text-lg font-semibold text-foreground mb-2">
                No Notifications
              </Text>
              <Text className="text-sm text-muted text-center">
                {activeTab === "unread"
                  ? "You're all caught up!"
                  : "You'll see your notifications here"}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
