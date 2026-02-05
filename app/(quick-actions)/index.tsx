import { ScrollView, Text, View, Pressable, Alert, Switch } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  getQuickActionsSettings,
  updateQuickActionSetting,
  isBiometricAvailable,
  executeCheckBalance,
  executePayLastRecipient,
  executeRecentTransactions,
  getQuickActionStatistics,
  type QuickAction,
} from "@/utils/quick-actions";

export default function QuickActionsScreen() {
  const colors = useColors();
  const [actions, setActions] = useState<QuickAction[]>([]);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [actionsData, bioAvailable, statistics] = await Promise.all([
      getQuickActionsSettings(),
      isBiometricAvailable(),
      getQuickActionStatistics(),
    ]);
    
    setActions(actionsData);
    setBiometricAvailable(bioAvailable);
    setStats(statistics);
  };

  const handleToggleAction = async (actionId: string, enabled: boolean) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const success = await updateQuickActionSetting(actionId, enabled);
      
      if (success) {
        await loadData();
      } else {
        Alert.alert("Error", "Failed to update setting");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update setting");
    }
  };

  const handleExecuteAction = async (actionId: string) => {
    if (loading) return;
    
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      switch (actionId) {
        case "check_balance":
          const balanceResult = await executeCheckBalance();
          if (balanceResult.success) {
            Alert.alert(
              "Account Balance",
              `Your current balance is $${balanceResult.balance?.toFixed(2)}`
            );
          } else {
            Alert.alert("Error", balanceResult.error || "Failed to check balance");
          }
          break;
          
        case "pay_last_recipient":
          const payResult = await executePayLastRecipient();
          if (payResult.success && payResult.recipient) {
            Alert.alert(
              "Pay Last Recipient",
              `Ready to pay ${payResult.recipient.name}\nAmount: $${payResult.recipient.amount.toFixed(2)}`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Confirm",
                  onPress: () => {
                    Alert.alert("Success", "Payment sent successfully");
                  },
                },
              ]
            );
          } else {
            Alert.alert("Error", payResult.error || "Failed to load recipient");
          }
          break;
          
        case "recent_transactions":
          const txResult = await executeRecentTransactions();
          if (txResult.success && txResult.transactions) {
            const txList = txResult.transactions
              .map(
                (tx) =>
                  `${tx.description}: ${tx.amount >= 0 ? "+" : ""}$${tx.amount.toFixed(2)}`
              )
              .join("\n");
            Alert.alert("Recent Transactions", txList);
          } else {
            Alert.alert("Error", txResult.error || "Failed to load transactions");
          }
          break;
          
        case "scan_qr":
          Alert.alert("Scan QR Code", "QR scanner would open here");
          break;
          
        case "voice_assistant":
          Alert.alert("Voice Assistant", "Voice assistant would open here");
          break;
          
        default:
          Alert.alert("Error", "Unknown action");
      }
      
      await loadData();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to execute action");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">Quick Actions</Text>
            <Text className="text-sm text-muted">
              Fast access to common tasks with biometric security
            </Text>
          </View>

          {/* Biometric Status */}
          <View
            style={{
              backgroundColor: biometricAvailable
                ? colors.success + "20"
                : colors.warning + "20",
            }}
            className="rounded-2xl p-4 border border-border"
          >
            <View className="flex-row items-center gap-3">
              <Text className="text-3xl">
                {biometricAvailable ? "✓" : "⚠️"}
              </Text>
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">
                  {biometricAvailable
                    ? "Biometric Available"
                    : "Biometric Not Available"}
                </Text>
                <Text className="text-sm text-muted">
                  {biometricAvailable
                    ? "Face ID / Touch ID is enabled"
                    : "Enable biometric authentication in device settings"}
                </Text>
              </View>
            </View>
          </View>

          {/* Statistics */}
          {stats && stats.total_uses > 0 && (
            <View className="flex-row gap-3">
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Total Uses</Text>
                <Text className="text-2xl font-bold text-foreground">
                  {stats.total_uses}
                </Text>
              </View>
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Most Used</Text>
                <Text className="text-base font-semibold text-foreground">
                  {stats.most_used.replace(/_/g, " ")}
                </Text>
              </View>
            </View>
          )}

          {/* Quick Actions */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Available Actions</Text>
            
            {actions.map((action) => (
              <View
                key={action.id}
                style={{ backgroundColor: colors.surface }}
                className="rounded-xl border border-border overflow-hidden"
              >
                <View className="p-4">
                  <View className="flex-row items-center gap-3 mb-3">
                    <View
                      style={{ backgroundColor: colors.primary + "20" }}
                      className="w-12 h-12 rounded-full items-center justify-center"
                    >
                      <Text className="text-2xl">{action.icon}</Text>
                    </View>
                    
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-foreground">
                        {action.title}
                      </Text>
                      <Text className="text-sm text-muted">{action.description}</Text>
                    </View>
                    
                    <Switch
                      value={action.enabled}
                      onValueChange={(value) => handleToggleAction(action.id, value)}
                      trackColor={{
                        false: colors.border,
                        true: colors.primary,
                      }}
                      thumbColor={colors.background}
                    />
                  </View>
                  
                  {action.requires_biometric && (
                    <View className="flex-row items-center gap-2 mb-3">
                      <Text className="text-xs text-muted">🔒 Requires biometric</Text>
                    </View>
                  )}
                  
                  {action.enabled && (
                    <Pressable
                      onPress={() => handleExecuteAction(action.id)}
                      disabled={loading}
                      style={({ pressed }) => [
                        {
                          backgroundColor: colors.primary,
                          opacity: pressed || loading ? 0.7 : 1,
                        },
                      ]}
                      className="rounded-lg py-2"
                    >
                      <Text
                        style={{ color: colors.background }}
                        className="text-center font-semibold text-sm"
                      >
                        {loading ? "Loading..." : "Try Now"}
                      </Text>
                    </Pressable>
                  )}
                </View>
                
                {stats && stats.usage_by_action[action.id] > 0 && (
                  <View
                    style={{ backgroundColor: colors.background }}
                    className="px-4 py-2 border-t border-border"
                  >
                    <Text className="text-xs text-muted">
                      Used {stats.usage_by_action[action.id]} times
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Info */}
          <View
            style={{ backgroundColor: colors.surface }}
            className="rounded-2xl p-4 border border-border"
          >
            <Text className="text-sm text-foreground leading-relaxed">
              <Text className="font-semibold">Tip:</Text> Quick actions provide instant access
              to common tasks. Biometric-protected actions require Face ID or Touch ID for
              added security. Enable the actions you use most frequently.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
