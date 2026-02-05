import { ScrollView, Text, View, Pressable, Alert, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:3000";

interface PredictiveAlert {
  category: string;
  current_spending: number;
  budget_limit: number;
  budget_used_percentage: number;
  days_remaining: number;
  spending_pattern: {
    average_daily_spending: number;
    spending_trend: string;
    high_spending_days: Array<{ date: string; amount: number }>;
    spending_velocity: number;
  };
  risk_prediction: {
    risk_level: string;
    risk_score: number;
    predicted_total: number;
    predicted_overage: number;
    confidence: number;
    recommended_daily_limit: number;
  };
  alert: {
    title: string;
    message: string;
    urgency: string;
    risk_level: string;
    risk_score: number;
    recommended_action: string;
  };
}

export default function PredictiveAlertsScreen() {
  const colors = useColors();
  const [alerts, setAlerts] = useState<PredictiveAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    setIsLoading(true);
    
    try {
      // Load transactions from AsyncStorage
      const transactionsJson = await AsyncStorage.getItem("transactions");
      const transactions = transactionsJson ? JSON.parse(transactionsJson) : [];
      
      // Load budgets from AsyncStorage
      const budgetsJson = await AsyncStorage.getItem("budgets");
      const budgets = budgetsJson ? JSON.parse(budgetsJson) : [];
      
      if (transactions.length === 0 || budgets.length === 0) {
        setAlerts([]);
        setIsLoading(false);
        return;
      }
      
      // Calculate current period (this month)
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
      
      // Call predictive alerts API
      const response = await axios.post(
        `${API_URL}/api/trpc/predictiveAlerts.getAllAlerts`,
        {
          transactions: transactions.map((t: any) => ({
            id: t.id,
            amount: t.amount,
            category: t.category,
            date: t.date,
            description: t.description || "",
          })),
          budgets: budgets.map((b: any) => ({
            category: b.category,
            limit: b.limit,
          })),
          period_start: periodStart,
          period_end: periodEnd,
        },
        { timeout: 10000 }
      );
      
      const result = response.data.result.data;
      
      setAlerts(result);
      setLastUpdate(new Date());
    } catch (error: any) {
      console.error("Failed to load predictive alerts:", error);
      Alert.alert("Error", "Failed to load predictive alerts");
    } finally {
      setIsLoading(false);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "info":
        return colors.success;
      case "warning":
        return colors.warning;
      case "high":
        return colors.error;
      case "critical":
        return "#DC2626";
      default:
        return colors.muted;
    }
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case "info":
        return "✅";
      case "warning":
        return "⚠️";
      case "high":
        return "🚨";
      case "critical":
        return "🔴";
      default:
        return "ℹ️";
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "increasing":
        return "📈";
      case "decreasing":
        return "📉";
      default:
        return "➡️";
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-base text-muted mt-4">Analyzing spending patterns...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-2xl font-bold text-foreground">Predictive Alerts</Text>
              <Text className="text-sm text-muted">
                {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : "AI-powered spending forecasts"}
              </Text>
            </View>
            
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                loadAlerts();
              }}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              className="w-12 h-12 rounded-full items-center justify-center"
            >
              <Text style={{ color: colors.background }} className="text-xl">🔄</Text>
            </Pressable>
          </View>

          {alerts.length > 0 ? (
            alerts.map((alert, index) => (
              <View
                key={alert.category}
                style={{
                  backgroundColor: colors.surface,
                  borderLeftWidth: 4,
                  borderLeftColor: getUrgencyColor(alert.alert.urgency),
                }}
                className="rounded-2xl p-5 border-l-4"
              >
                <View className="flex-row items-start gap-3 mb-4">
                  <Text className="text-3xl">{getUrgencyIcon(alert.alert.urgency)}</Text>
                  <View className="flex-1">
                    <Text className="text-lg font-bold text-foreground mb-1">
                      {alert.alert.title}
                    </Text>
                    <Text className="text-sm text-muted">{alert.alert.message}</Text>
                  </View>
                </View>

                {/* Current Status */}
                <View
                  style={{ backgroundColor: colors.background }}
                  className="rounded-xl p-4 mb-4"
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-sm text-muted">Current Spending</Text>
                    <Text className="text-lg font-bold text-foreground">
                      ${alert.current_spending.toFixed(2)}
                    </Text>
                  </View>
                  
                  <View className="h-2 bg-muted/20 rounded-full overflow-hidden mb-2">
                    <View
                      style={{
                        width: `${Math.min(100, alert.budget_used_percentage)}%`,
                        backgroundColor: getUrgencyColor(alert.alert.urgency),
                      }}
                      className="h-full"
                    />
                  </View>
                  
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs text-muted">
                      {alert.budget_used_percentage.toFixed(0)}% of ${alert.budget_limit.toFixed(0)} budget
                    </Text>
                    <Text className="text-xs text-muted">
                      {alert.days_remaining} days left
                    </Text>
                  </View>
                </View>

                {/* Spending Pattern */}
                <View
                  style={{ backgroundColor: colors.background }}
                  className="rounded-xl p-4 mb-4"
                >
                  <Text className="text-sm font-semibold text-foreground mb-3">
                    Spending Pattern
                  </Text>
                  
                  <View className="gap-2">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm text-muted">Avg Daily</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        ${alert.spending_pattern.average_daily_spending.toFixed(2)}
                      </Text>
                    </View>
                    
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm text-muted">Trend</Text>
                      <View className="flex-row items-center gap-2">
                        <Text className="text-base">{getTrendIcon(alert.spending_pattern.spending_trend)}</Text>
                        <Text className="text-sm font-semibold text-foreground capitalize">
                          {alert.spending_pattern.spending_trend}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Risk Prediction */}
                <View
                  style={{
                    backgroundColor: getUrgencyColor(alert.alert.urgency) + "10",
                  }}
                  className="rounded-xl p-4 mb-4"
                >
                  <Text className="text-sm font-semibold text-foreground mb-3">
                    📊 Prediction
                  </Text>
                  
                  <View className="gap-2">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm text-muted">Risk Score</Text>
                      <Text
                        style={{ color: getUrgencyColor(alert.alert.urgency) }}
                        className="text-sm font-bold"
                      >
                        {alert.risk_prediction.risk_score.toFixed(0)}/100
                      </Text>
                    </View>
                    
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm text-muted">Predicted Total</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        ${alert.risk_prediction.predicted_total.toFixed(2)}
                      </Text>
                    </View>
                    
                    {alert.risk_prediction.predicted_overage > 0 && (
                      <View className="flex-row items-center justify-between">
                        <Text className="text-sm text-muted">Predicted Overage</Text>
                        <Text
                          style={{ color: colors.error }}
                          className="text-sm font-bold"
                        >
                          +${alert.risk_prediction.predicted_overage.toFixed(2)}
                        </Text>
                      </View>
                    )}
                    
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm text-muted">Confidence</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        {alert.risk_prediction.confidence}%
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Recommended Action */}
                <View
                  style={{ backgroundColor: colors.primary + "10" }}
                  className="rounded-xl p-4"
                >
                  <View className="flex-row items-center gap-2 mb-2">
                    <Text className="text-base">💡</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      Recommended Action
                    </Text>
                  </View>
                  <Text style={{ color: colors.primary }} className="text-sm font-semibold">
                    {alert.alert.recommended_action}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View className="items-center py-16">
              <Text className="text-6xl mb-4">✅</Text>
              <Text className="text-lg font-semibold text-foreground mb-2">
                All Budgets On Track
              </Text>
              <Text className="text-sm text-muted text-center mb-6">
                Your spending is within budget limits. Keep up the good work!
              </Text>
              <Pressable
                onPress={loadAlerts}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                className="rounded-xl px-6 py-3"
              >
                <Text
                  style={{ color: colors.background }}
                  className="font-semibold text-base"
                >
                  Refresh Analysis
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
