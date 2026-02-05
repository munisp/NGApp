import { ScrollView, Text, View, Switch, Pressable } from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

interface NotificationPreferences {
  transactions: boolean;
  billsDue: boolean;
  goalMilestones: boolean;
  lowBalance: boolean;
  securityAlerts: boolean;
  marketingOffers: boolean;
}

export default function NotificationPreferencesScreen() {
  const colors = useColors();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    transactions: true,
    billsDue: true,
    goalMilestones: true,
    lowBalance: true,
    securityAlerts: true,
    marketingOffers: false,
  });

  useEffect(() => {
    loadPreferences();
  }, []);

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
    } catch (error) {
      console.error("Failed to save preferences:", error);
    }
  };

  const togglePreference = (key: keyof NotificationPreferences) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newPreferences = { ...preferences, [key]: !preferences[key] };
    setPreferences(newPreferences);
    savePreferences(newPreferences);
  };

  const preferenceItems = [
    { key: "transactions" as const, label: "Transaction Alerts", description: "Get notified of all account transactions" },
    { key: "billsDue" as const, label: "Bill Due Reminders", description: "Reminders before bills are due" },
    { key: "goalMilestones" as const, label: "Goal Milestones", description: "Celebrate when you reach savings goals" },
    { key: "lowBalance" as const, label: "Low Balance Alerts", description: "Warning when balance is low" },
    { key: "securityAlerts" as const, label: "Security Alerts", description: "Important security notifications" },
    { key: "marketingOffers" as const, label: "Marketing Offers", description: "Promotions and special offers" },
  ];

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">
              Notification Preferences
            </Text>
            <Text className="text-sm text-muted">
              Manage what notifications you receive
            </Text>
          </View>

          {/* Preference Items */}
          <View className="gap-4">
            {preferenceItems.map((item) => (
              <View
                key={item.key}
                className="bg-surface rounded-2xl p-4 border border-border"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-4">
                    <Text className="text-base font-semibold text-foreground mb-1">
                      {item.label}
                    </Text>
                    <Text className="text-sm text-muted">
                      {item.description}
                    </Text>
                  </View>
                  <Switch
                    value={preferences[item.key]}
                    onValueChange={() => togglePreference(item.key)}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.background}
                  />
                </View>
              </View>
            ))}
          </View>

          {/* Test Notification Button */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              // In a real app, this would trigger a test notification
              alert("Test notification sent!");
            }}
            style={({ pressed }) => [
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            className="py-4 rounded-full items-center"
          >
            <Text className="text-background font-semibold text-base">
              Send Test Notification
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
