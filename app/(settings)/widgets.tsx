import { View, Text, TouchableOpacity, ScrollView, Alert, Platform } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  getWidgetData,
  refreshAllWidgets,
  formatWidgetCurrency,
  formatWidgetDate,
  type WidgetData,
} from "@/utils/home-widgets";

export default function WidgetSettingsScreen() {
  const colors = useColors();
  const [widgetData, setWidgetData] = useState<WidgetData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadWidgetData();
  }, []);

  const loadWidgetData = async () => {
    setIsLoading(true);
    const data = await getWidgetData();
    setWidgetData(data);
    setIsLoading(false);
  };

  const handleRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRefreshing(true);

    try {
      // Simulate fetching fresh data
      // In a real app, this would fetch from your API
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const mockBalance = 12450.75;
      const mockTransactions = [
        {
          id: "1",
          description: "Grocery Store",
          amount: -85.50,
          type: "debit" as const,
          date: new Date().toISOString(),
        },
        {
          id: "2",
          description: "Salary Deposit",
          amount: 3500.00,
          type: "credit" as const,
          date: new Date(Date.now() - 86400000).toISOString(),
        },
      ];
      const mockBills = [
        {
          id: "1",
          name: "Electric Bill",
          amount: 120.00,
          dueDate: new Date(Date.now() + 172800000).toISOString(),
          status: "pending" as const,
        },
      ];

      await refreshAllWidgets(mockBalance, mockTransactions, mockBills);
      await loadWidgetData();

      Alert.alert("Success", "Widget data has been refreshed");
    } catch (error) {
      Alert.alert("Error", "Failed to refresh widget data");
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer className="p-6 items-center justify-center">
        <Text className="text-lg text-muted">Loading...</Text>
      </ScreenContainer>
    );
  }

  const platformName = Platform.OS === "ios" ? "iOS" : "Android";

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View>
            <Text className="text-2xl font-bold text-foreground">Home Screen Widgets</Text>
            <Text className="text-base text-muted mt-2">
              View your financial information at a glance
            </Text>
          </View>

          {/* Refresh Button */}
          <TouchableOpacity
            onPress={handleRefresh}
            disabled={isRefreshing}
            className="rounded-xl p-4 items-center"
            style={{ backgroundColor: colors.primary }}
          >
            <Text className="text-base font-semibold text-white">
              {isRefreshing ? "Refreshing..." : "Refresh Widget Data"}
            </Text>
          </TouchableOpacity>

          {/* Current Widget Data */}
          {widgetData && (
            <View className="gap-4">
              <Text className="text-lg font-semibold text-foreground">Current Data</Text>

              {/* Balance Widget */}
              <View
                className="rounded-xl p-4 border"
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                }}
              >
                <Text className="text-sm font-medium text-muted mb-2">Balance Widget</Text>
                <Text className="text-3xl font-bold text-foreground">
                  {formatWidgetCurrency(widgetData.balance.total, widgetData.balance.currency)}
                </Text>
                <Text className="text-xs text-muted mt-2">
                  Last updated: {new Date(widgetData.balance.lastUpdated).toLocaleString()}
                </Text>
              </View>

              {/* Transactions Widget */}
              <View
                className="rounded-xl p-4 border"
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                }}
              >
                <Text className="text-sm font-medium text-muted mb-3">
                  Recent Transactions Widget
                </Text>
                {widgetData.recentTransactions.length > 0 ? (
                  <View className="gap-2">
                    {widgetData.recentTransactions.map((transaction) => (
                      <View key={transaction.id} className="flex-row justify-between items-center">
                        <Text className="text-sm text-foreground flex-1" numberOfLines={1}>
                          {transaction.description}
                        </Text>
                        <Text
                          className="text-sm font-semibold"
                          style={{
                            color: transaction.type === "credit" ? colors.success : colors.error,
                          }}
                        >
                          {transaction.type === "credit" ? "+" : "-"}
                          {formatWidgetCurrency(Math.abs(transaction.amount))}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text className="text-sm text-muted">No recent transactions</Text>
                )}
              </View>

              {/* Bills Widget */}
              <View
                className="rounded-xl p-4 border"
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                }}
              >
                <Text className="text-sm font-medium text-muted mb-3">Upcoming Bills Widget</Text>
                {widgetData.upcomingBills.length > 0 ? (
                  <View className="gap-2">
                    {widgetData.upcomingBills.map((bill) => (
                      <View key={bill.id} className="flex-row justify-between items-center">
                        <View className="flex-1">
                          <Text className="text-sm text-foreground">{bill.name}</Text>
                          <Text className="text-xs text-muted">
                            Due {formatWidgetDate(bill.dueDate)}
                          </Text>
                        </View>
                        <Text className="text-sm font-semibold text-foreground">
                          {formatWidgetCurrency(bill.amount)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text className="text-sm text-muted">No upcoming bills</Text>
                )}
              </View>
            </View>
          )}

          {/* Setup Instructions */}
          <View className="gap-4">
            <Text className="text-lg font-semibold text-foreground">Setup Instructions</Text>

            <View
              className="rounded-xl p-4"
              style={{ backgroundColor: colors.surface }}
            >
              <Text className="text-sm font-semibold text-foreground mb-3">
                How to Add Widgets ({platformName})
              </Text>
              
              {Platform.OS === "ios" ? (
                <View className="gap-2">
                  <Text className="text-sm text-muted">1. Long press on your home screen</Text>
                  <Text className="text-sm text-muted">2. Tap the "+" button in the top left</Text>
                  <Text className="text-sm text-muted">3. Search for "Fintech"</Text>
                  <Text className="text-sm text-muted">4. Choose a widget size</Text>
                  <Text className="text-sm text-muted">5. Tap "Add Widget"</Text>
                </View>
              ) : (
                <View className="gap-2">
                  <Text className="text-sm text-muted">1. Long press on your home screen</Text>
                  <Text className="text-sm text-muted">2. Tap "Widgets"</Text>
                  <Text className="text-sm text-muted">3. Find "Fintech" in the list</Text>
                  <Text className="text-sm text-muted">4. Drag a widget to your home screen</Text>
                  <Text className="text-sm text-muted">5. Resize as needed</Text>
                </View>
              )}
            </View>

            {/* Available Widgets */}
            <View
              className="rounded-xl p-4"
              style={{ backgroundColor: colors.surface }}
            >
              <Text className="text-sm font-semibold text-foreground mb-3">
                Available Widgets
              </Text>
              
              <View className="gap-3">
                {[
                  {
                    name: "Balance",
                    description: "Shows your current account balance",
                    sizes: "Small, Medium",
                  },
                  {
                    name: "Transactions",
                    description: "Displays recent transactions",
                    sizes: "Medium, Large",
                  },
                  {
                    name: "Bills",
                    description: "Lists upcoming bill payments",
                    sizes: "Medium, Large",
                  },
                ].map((widget, index) => (
                  <View key={index}>
                    <Text className="text-sm font-medium text-foreground">{widget.name}</Text>
                    <Text className="text-xs text-muted">{widget.description}</Text>
                    <Text className="text-xs text-muted mt-1">Sizes: {widget.sizes}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Privacy Note */}
          <View
            className="rounded-xl p-4"
            style={{ backgroundColor: colors.surface }}
          >
            <Text className="text-sm text-muted leading-relaxed">
              <Text className="font-semibold">Privacy Note:</Text> Widget data is stored locally
              on your device and updates automatically when you open the app. Sensitive
              information like account numbers is never displayed in widgets.
            </Text>
          </View>

          {/* Bottom Spacing */}
          <View className="h-8" />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
