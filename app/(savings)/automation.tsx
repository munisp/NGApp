import { ScrollView, Text, View, Pressable, Switch, TextInput, Alert } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  getSavingsRules,
  createSavingsRule,
  updateSavingsRule,
  deleteSavingsRule,
  toggleSavingsRule,
  createPresetRules,
  type SavingsRule,
  type RuleType,
} from "@/utils/savings-automation";

export default function SavingsAutomationScreen() {
  const colors = useColors();
  const [rules, setRules] = useState<SavingsRule[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleType, setNewRuleType] = useState<RuleType>("round_up");

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    const loadedRules = await getSavingsRules();
    setRules(loadedRules);
  };

  const handleToggleRule = async (ruleId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleSavingsRule(ruleId);
    await loadRules();
  };

  const handleDeleteRule = async (ruleId: string, ruleName: string) => {
    Alert.alert(
      "Delete Rule",
      `Are you sure you want to delete "${ruleName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteSavingsRule(ruleId);
            await loadRules();
          },
        },
      ]
    );
  };

  const handleCreatePresets = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await createPresetRules();
    await loadRules();
  };

  const getRuleIcon = (type: RuleType) => {
    switch (type) {
      case "round_up":
        return "⬆️";
      case "percentage":
        return "📊";
      case "fixed_amount":
        return "💵";
      case "custom":
        return "⚙️";
      default:
        return "💰";
    }
  };

  const getRuleDescription = (rule: SavingsRule) => {
    switch (rule.type) {
      case "round_up":
        return `Round up purchases ${rule.round_up_multiplier || 1}x`;
      case "percentage":
        return `Save ${rule.percentage}% of deposits`;
      case "fixed_amount":
        return `Save $${rule.fixed_amount} ${rule.trigger}`;
      case "custom":
        return rule.condition || "Custom rule";
      default:
        return "Savings rule";
    }
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">
              Savings Automation
            </Text>
            <Text className="text-sm text-muted">
              Set up rules to automatically save money
            </Text>
          </View>

          {/* Total Saved Card */}
          <View className="bg-surface rounded-2xl p-6 border border-border">
            <Text className="text-sm text-muted mb-2">Total Saved by Rules</Text>
            <Text className="text-3xl font-bold text-foreground mb-1">
              ${rules.reduce((sum, r) => sum + (r.total_saved || 0), 0).toFixed(2)}
            </Text>
            <Text className="text-sm text-muted">
              {rules.reduce((sum, r) => sum + (r.execution_count || 0), 0)} automatic transfers
            </Text>
          </View>

          {/* Active Rules */}
          {rules.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">
                Your Rules
              </Text>

              {rules.map((rule) => (
                <View
                  key={rule.id}
                  className="bg-surface rounded-2xl p-4 border border-border"
                >
                  <View className="flex-row items-start gap-3">
                    <View
                      style={{ backgroundColor: colors.primary + "20" }}
                      className="w-12 h-12 rounded-full items-center justify-center"
                    >
                      <Text className="text-2xl">{getRuleIcon(rule.type)}</Text>
                    </View>
                    
                    <View className="flex-1">
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-base font-semibold text-foreground">
                          {rule.name}
                        </Text>
                        <Switch
                          value={rule.enabled}
                          onValueChange={() => handleToggleRule(rule.id)}
                          trackColor={{ false: colors.border, true: colors.primary }}
                          thumbColor={colors.background}
                        />
                      </View>
                      
                      <Text className="text-sm text-muted mb-3">
                        {getRuleDescription(rule)}
                      </Text>
                      
                      {/* Stats */}
                      <View className="flex-row gap-4 mb-3">
                        <View>
                          <Text className="text-xs text-muted">Saved</Text>
                          <Text className="text-sm font-semibold text-foreground">
                            ${(rule.total_saved || 0).toFixed(2)}
                          </Text>
                        </View>
                        <View>
                          <Text className="text-xs text-muted">Executions</Text>
                          <Text className="text-sm font-semibold text-foreground">
                            {rule.execution_count || 0}
                          </Text>
                        </View>
                        {rule.last_executed && (
                          <View>
                            <Text className="text-xs text-muted">Last Run</Text>
                            <Text className="text-sm font-semibold text-foreground">
                              {new Date(rule.last_executed).toLocaleDateString()}
                            </Text>
                          </View>
                        )}
                      </View>
                      
                      {/* Limits */}
                      {(rule.max_per_transaction || rule.max_per_day || rule.max_per_month) && (
                        <View className="bg-background rounded-lg p-2 mb-3">
                          <Text className="text-xs text-muted">Limits:</Text>
                          <View className="flex-row flex-wrap gap-2 mt-1">
                            {rule.max_per_transaction && (
                              <Text className="text-xs text-foreground">
                                ${rule.max_per_transaction}/txn
                              </Text>
                            )}
                            {rule.max_per_day && (
                              <Text className="text-xs text-foreground">
                                ${rule.max_per_day}/day
                              </Text>
                            )}
                            {rule.max_per_month && (
                              <Text className="text-xs text-foreground">
                                ${rule.max_per_month}/month
                              </Text>
                            )}
                          </View>
                        </View>
                      )}
                      
                      {/* Delete Button */}
                      <Pressable
                        onPress={() => handleDeleteRule(rule.id, rule.name)}
                        style={({ pressed }) => [
                          {
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={{ color: colors.error }}
                          className="text-sm font-semibold"
                        >
                          Delete Rule
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Empty State */}
          {rules.length === 0 && (
            <View className="items-center justify-center py-12">
              <Text className="text-6xl mb-4">🎯</Text>
              <Text className="text-lg font-semibold text-foreground mb-2">
                No rules yet
              </Text>
              <Text className="text-sm text-muted text-center mb-6">
                Create your first savings rule to start automating your savings
              </Text>
              
              <Pressable
                onPress={handleCreatePresets}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                className="px-6 py-3 rounded-full"
              >
                <Text
                  style={{ color: colors.background }}
                  className="font-semibold"
                >
                  Create Preset Rules
                </Text>
              </Pressable>
            </View>
          )}

          {/* Add Presets Button */}
          {rules.length > 0 && (
            <Pressable
              onPress={handleCreatePresets}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.surface,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              className="rounded-2xl p-4 border border-border"
            >
              <View className="flex-row items-center gap-3">
                <Text className="text-2xl">✨</Text>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">
                    Add Preset Rules
                  </Text>
                  <Text className="text-sm text-muted">
                    Quick start with popular savings strategies
                  </Text>
                </View>
              </View>
            </Pressable>
          )}

          {/* Info Card */}
          <View className="bg-surface rounded-2xl p-4 border border-border">
            <View className="flex-row items-start gap-3">
              <Text className="text-2xl">💡</Text>
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground mb-1">
                  How It Works
                </Text>
                <Text className="text-sm text-muted leading-relaxed">
                  Savings rules automatically transfer money to your savings goals based on your spending and income. Enable rules to start saving effortlessly.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
