import { View, Text, ScrollView, RefreshControl, Alert, Pressable } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { analyzePredictiveAlerts, type Alert as MLAlert, type Transaction } from "@/lib/api/ml-service-client";

export default function PredictiveAlertsMLScreen() {
  const colors = useColors();
  const [alerts, setAlerts] = useState<MLAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [summary, setSummary] = useState<{
    total_alerts: number;
    by_severity: Record<string, number>;
    requires_action: number;
  } | null>(null);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    setIsLoading(true);
    
    try {
      // Load transactions from AsyncStorage
      const transactionsJson = await AsyncStorage.getItem("transactions");
      const transactions = transactionsJson ? JSON.parse(transactionsJson) : [];
      
      // Load budgets from AsyncStorage for user context
      const budgetsJson = await AsyncStorage.getItem("budgets");
      const budgets = budgetsJson ? JSON.parse(budgetsJson) : [];
      
      if (transactions.length === 0) {
        setAlerts([]);
        setIsLoading(false);
        return;
      }
      
      // Calculate monthly budget and current spending
      const monthlyBudget = budgets.reduce((sum: number, b: any) => sum + (b.limit || 0), 0);
      const currentSpending = transactions
        .filter((t: any) => t.type === 'debit')
        .reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);
      
      // Convert transactions to ML format
      const mlTransactions: Transaction[] = transactions.map((t: any) => ({
        id: t.id,
        amount: Math.abs(t.amount),
        merchant: t.merchant || t.description || 'Unknown',
        category: t.category || 'Other',
        description: t.description || '',
        timestamp: t.date || new Date().toISOString(),
        type: t.type === 'debit' ? 'debit' : 'credit',
      }));
      
      // Call ML service
      const result = await analyzePredictiveAlerts(
        mlTransactions,
        'user123', // TODO: Get actual user ID from auth context
        {
          monthly_budget: monthlyBudget,
          current_spending: currentSpending,
        }
      );
      
      setAlerts(result.alerts);
      setSummary(result.summary);
      setLastUpdate(new Date());
    } catch (error: any) {
      console.error("Failed to load ML predictive alerts:", error);
      Alert.alert("Error", "Failed to load predictive alerts. ML service may be unavailable.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    await loadAlerts();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "#DC2626";
      case "high":
        return colors.error;
      case "medium":
        return colors.warning;
      case "low":
        return colors.success;
      default:
        return colors.muted;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return "🔴";
      case "high":
        return "🚨";
      case "medium":
        return "⚠️";
      case "low":
        return "ℹ️";
      default:
        return "📊";
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center">
          <Text className="text-lg text-muted">Loading ML-powered alerts...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground">Predictive Alerts</Text>
          <Text className="text-sm text-muted mt-1">ML-powered anomaly detection</Text>
          {lastUpdate && (
            <Text className="text-xs text-muted mt-2">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </Text>
          )}
        </View>

        {/* Summary */}
        {summary && summary.total_alerts > 0 && (
          <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-3">Alert Summary</Text>
            <View className="flex-row justify-between mb-2">
              <Text className="text-muted">Total Alerts:</Text>
              <Text className="font-semibold text-foreground">{summary.total_alerts}</Text>
            </View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-muted">Requires Action:</Text>
              <Text className="font-semibold text-error">{summary.requires_action}</Text>
            </View>
            {Object.entries(summary.by_severity).map(([severity, count]) => (
              <View key={severity} className="flex-row justify-between mb-1">
                <Text className="text-muted capitalize">{severity}:</Text>
                <Text className="font-medium" style={{ color: getSeverityColor(severity) }}>
                  {count}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Alerts List */}
        {alerts.length === 0 ? (
          <View className="flex-1 items-center justify-center py-12">
            <Text className="text-6xl mb-4">✅</Text>
            <Text className="text-xl font-semibold text-foreground mb-2">All Clear!</Text>
            <Text className="text-muted text-center">
              No unusual transactions detected. Your spending looks normal.
            </Text>
          </View>
        ) : (
          <View className="gap-4">
            {alerts.map((alert) => (
              <Pressable
                key={alert.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Alert.alert(
                    alert.type.replace(/_/g, ' ').toUpperCase(),
                    `${alert.message}\n\nConfidence: ${alert.confidence}%\nAnomaly Score: ${alert.anomaly_score.toFixed(2)}\n\nRecommended Actions:\n${alert.actions.join('\n')}`
                  );
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <View
                  className="bg-surface rounded-2xl p-4 border-l-4"
                  style={{ borderLeftColor: getSeverityColor(alert.severity) }}
                >
                  {/* Alert Header */}
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-2xl">{getSeverityIcon(alert.severity)}</Text>
                      <Text className="text-sm font-semibold text-foreground capitalize">
                        {alert.type.replace(/_/g, ' ')}
                      </Text>
                    </View>
                    <View className="bg-background px-3 py-1 rounded-full">
                      <Text className="text-xs font-medium" style={{ color: getSeverityColor(alert.severity) }}>
                        {alert.severity.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* Transaction Details */}
                  <View className="bg-background rounded-xl p-3 mb-3">
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-muted">Merchant:</Text>
                      <Text className="font-semibold text-foreground">{alert.transaction.merchant}</Text>
                    </View>
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-muted">Amount:</Text>
                      <Text className="font-bold text-foreground">${alert.transaction.amount.toFixed(2)}</Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-muted">Category:</Text>
                      <Text className="text-foreground">{alert.transaction.category}</Text>
                    </View>
                  </View>

                  {/* Alert Message */}
                  <Text className="text-sm text-foreground mb-3 leading-relaxed">{alert.message}</Text>

                  {/* ML Metrics */}
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-xs text-muted">Confidence:</Text>
                      <Text className="text-xs font-semibold text-foreground">{alert.confidence}%</Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Text className="text-xs text-muted">Anomaly Score:</Text>
                      <Text className="text-xs font-semibold text-foreground">
                        {alert.anomaly_score.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  {/* Actionable Badge */}
                  {alert.actionable && (
                    <View className="mt-3 bg-error/10 rounded-lg p-2">
                      <Text className="text-xs font-semibold text-error text-center">
                        ⚠️ Action Required
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* ML Info Footer */}
        <View className="mt-6 bg-primary/10 rounded-xl p-4">
          <Text className="text-xs text-muted text-center leading-relaxed">
            🤖 Powered by ML-based anomaly detection using Isolation Forest and Qwen LLM.
            Alerts are personalized based on your spending patterns.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
