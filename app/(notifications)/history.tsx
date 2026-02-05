import { ScrollView, Text, View, Pressable, FlatList } from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

interface Notification {
  id: string;
  type: "transaction" | "bill" | "goal" | "security" | "balance";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export default function NotificationHistoryScreen() {
  const colors = useColors();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const saved = await AsyncStorage.getItem("notification_history");
      if (saved) {
        setNotifications(JSON.parse(saved));
      } else {
        // Sample notifications for demo
        const sampleNotifications: Notification[] = [
          {
            id: "1",
            type: "transaction",
            title: "Payment Received",
            message: "You received $500 from John Doe",
            timestamp: new Date().toISOString(),
            read: false,
          },
          {
            id: "2",
            type: "bill",
            title: "Bill Due Tomorrow",
            message: "Your electricity bill of $75 is due tomorrow",
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            read: false,
          },
          {
            id: "3",
            type: "goal",
            title: "Goal Milestone Reached!",
            message: "You've reached 50% of your vacation savings goal",
            timestamp: new Date(Date.now() - 7200000).toISOString(),
            read: true,
          },
        ];
        setNotifications(sampleNotifications);
        await AsyncStorage.setItem("notification_history", JSON.stringify(sampleNotifications));
      }
    } catch (error) {
      console.error("Failed to load notifications:", error);
    }
  };

  const markAsRead = async (id: string) => {
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

  const getTypeColor = (type: Notification["type"]) => {
    switch (type) {
      case "transaction":
        return colors.primary;
      case "bill":
        return colors.warning;
      case "goal":
        return colors.success;
      case "security":
        return colors.error;
      case "balance":
        return colors.warning;
      default:
        return colors.muted;
    }
  };

  const getTypeIcon = (type: Notification["type"]) => {
    switch (type) {
      case "transaction":
        return "💳";
      case "bill":
        return "📄";
      case "goal":
        return "🎯";
      case "security":
        return "🔒";
      case "balance":
        return "⚠️";
      default:
        return "🔔";
    }
  };

  const filteredNotifications = filter === "unread"
    ? notifications.filter((n) => !n.read)
    : notifications;

  const renderNotification = ({ item }: { item: Notification }) => (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        markAsRead(item.id);
      }}
      style={({ pressed }) => [
        {
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      className="mb-3"
    >
      <View
        className={`bg-surface rounded-2xl p-4 border ${
          item.read ? "border-border" : "border-primary"
        }`}
      >
        <View className="flex-row items-start gap-3">
          <View
            style={{ backgroundColor: getTypeColor(item.type) + "20" }}
            className="w-10 h-10 rounded-full items-center justify-center"
          >
            <Text className="text-xl">{getTypeIcon(item.type)}</Text>
          </View>
          <View className="flex-1">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-base font-semibold text-foreground">
                {item.title}
              </Text>
              {!item.read && (
                <View className="w-2 h-2 rounded-full bg-primary" />
              )}
            </View>
            <Text className="text-sm text-muted mb-2">{item.message}</Text>
            <Text className="text-xs text-muted">
              {new Date(item.timestamp).toLocaleString()}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );

  return (
    <ScreenContainer className="p-6">
      <View className="flex-1 gap-6">
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-foreground">
              Notifications
            </Text>
            <Text className="text-sm text-muted">
              {notifications.filter((n) => !n.read).length} unread
            </Text>
          </View>
          <Pressable
            onPress={markAllAsRead}
            style={({ pressed }) => [
              {
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text className="text-primary font-semibold">Mark all read</Text>
          </Pressable>
        </View>

        {/* Filter Tabs */}
        <View className="flex-row gap-3">
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setFilter("all");
            }}
            style={({ pressed }) => [
              {
                backgroundColor: filter === "all" ? colors.primary : colors.surface,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            className="flex-1 py-3 rounded-full items-center"
          >
            <Text
              style={{
                color: filter === "all" ? colors.background : colors.foreground,
              }}
              className="font-semibold"
            >
              All ({notifications.length})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setFilter("unread");
            }}
            style={({ pressed }) => [
              {
                backgroundColor: filter === "unread" ? colors.primary : colors.surface,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            className="flex-1 py-3 rounded-full items-center"
          >
            <Text
              style={{
                color: filter === "unread" ? colors.background : colors.foreground,
              }}
              className="font-semibold"
            >
              Unread ({notifications.filter((n) => !n.read).length})
            </Text>
          </Pressable>
        </View>

        {/* Notifications List */}
        <FlatList
          data={filteredNotifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="items-center justify-center py-12">
              <Text className="text-6xl mb-4">🔔</Text>
              <Text className="text-lg font-semibold text-foreground mb-2">
                No notifications
              </Text>
              <Text className="text-sm text-muted text-center">
                You're all caught up!
              </Text>
            </View>
          }
        />
      </View>
    </ScreenContainer>
  );
}
