import { View, Text, ScrollView, TouchableOpacity, Switch, TextInput, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useEffect } from "react";
import {
  getRoundUpRules,
  getRoundUpStats,
  analyzeCashFlowImpact,
  updateRoundUpRule,
  createRoundUpRule,
  deleteRoundUpRule,
  type RoundUpRule,
  type RoundUpStats,
} from "@/utils/savings-roundup";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export default function SavingsRoundUpScreen() {
  const [rules, setRules] = useState<RoundUpRule[]>([]);
  const [stats, setStats] = useState<RoundUpStats | null>(null);
  const [cashFlowAnalysis, setCashFlowAnalysis] = useState<{
    safe: boolean;
    impact_percentage: number;
    recommendation: string;
  } | null>(null);
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleType, setNewRuleType] = useState<RoundUpRule["type"]>("fixed");
  const [newRuleAmount, setNewRuleAmount] = useState("");
  const [newRulePercentage, setNewRulePercentage] = useState("");
  const [newRuleMaxDaily, setNewRuleMaxDaily] = useState("50");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const loadedRules = await getRoundUpRules();
      setRules(loadedRules);

      const loadedStats = await getRoundUpStats();
      setStats(loadedStats);

      const analysis = await analyzeCashFlowImpact();
      setCashFlowAnalysis(analysis);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleRule(ruleId: string, enabled: boolean) {
    await updateRoundUpRule(ruleId, { enabled });
    loadData();
    
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  async function handleCreateRule() {
    if (!newRuleName.trim()) {
      Alert.alert("Error", "Please enter a rule name");
      return;
    }

    const newRule: Omit<RoundUpRule, "id" | "created_at"> = {
      name: newRuleName,
      enabled: true,
      type: newRuleType,
      amount: newRuleType === "fixed" && newRuleAmount ? parseFloat(newRuleAmount) : undefined,
      percentage: newRuleType === "percentage" && newRulePercentage ? parseFloat(newRulePercentage) : undefined,
      min_transaction: 1,
      max_daily: parseFloat(newRuleMaxDaily),
    };

    await createRoundUpRule(newRule);
    
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    Alert.alert("Success", "Round-up rule created successfully");
    setShowAddRule(false);
    setNewRuleName("");
    setNewRuleAmount("");
    setNewRulePercentage("");
    setNewRuleMaxDaily("50");
    loadData();
  }

  async function handleDeleteRule(ruleId: string) {
    Alert.alert(
      "Delete Rule",
      "Are you sure you want to delete this round-up rule?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteRoundUpRule(ruleId);
            loadData();
            
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <ScreenContainer className="p-6 justify-center items-center">
        <Text className="text-foreground text-lg">Loading round-up settings...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      <ScrollView className="flex-1 p-6">
        {/* Header */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground mb-2">Savings Round-Up</Text>
          <Text className="text-muted">Automatically save spare change from every purchase</Text>
        </View>

        {/* Stats */}
        {stats && (
          <View className="bg-primary p-6 rounded-2xl mb-6">
            <Text className="text-white text-sm mb-1">Total Saved</Text>
            <Text className="text-white text-4xl font-bold mb-4">${stats.total_saved.toFixed(2)}</Text>
            
            <View className="flex-row justify-between">
              <View>
                <Text className="text-white opacity-80 text-sm">Transactions</Text>
                <Text className="text-white text-lg font-semibold">{stats.transaction_count}</Text>
              </View>
              <View>
                <Text className="text-white opacity-80 text-sm">Avg Round-Up</Text>
                <Text className="text-white text-lg font-semibold">${stats.average_roundup.toFixed(2)}</Text>
              </View>
              <View>
                <Text className="text-white opacity-80 text-sm">Monthly Projection</Text>
                <Text className="text-white text-lg font-semibold">${stats.monthly_projection.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Cash Flow Analysis */}
        {cashFlowAnalysis && (
          <View className={`p-6 rounded-2xl mb-6 border ${cashFlowAnalysis.safe ? "bg-success/10 border-success" : "bg-warning/10 border-warning"}`}>
            <Text className="text-foreground font-semibold mb-2">Cash Flow Impact</Text>
            <Text className="text-foreground text-2xl font-bold mb-2">{cashFlowAnalysis.impact_percentage.toFixed(1)}%</Text>
            <Text className="text-muted">{cashFlowAnalysis.recommendation}</Text>
          </View>
        )}

        {/* Round-Up Rules */}
        <View className="mb-6">
          <Text className="text-foreground text-lg font-semibold mb-4">Round-Up Rules</Text>
          
          {rules.map((rule) => (
            <View key={rule.id} className="bg-surface p-6 rounded-2xl mb-4 border border-border">
              <View className="flex-row justify-between items-start mb-3">
                <View className="flex-1">
                  <Text className="text-foreground text-lg font-semibold mb-1">{rule.name}</Text>
                  <Text className="text-muted text-sm capitalize">{rule.type} Round-Up</Text>
                  {rule.amount && <Text className="text-muted text-sm">Amount: ${rule.amount}</Text>}
                  {rule.percentage && <Text className="text-muted text-sm">Percentage: {rule.percentage}%</Text>}
                  <Text className="text-muted text-sm">Max Daily: ${rule.max_daily}</Text>
                </View>
                <Switch
                  value={rule.enabled}
                  onValueChange={(enabled) => handleToggleRule(rule.id, enabled)}
                />
              </View>

              <TouchableOpacity
                className="bg-error px-4 py-2 rounded-lg self-start"
                onPress={() => handleDeleteRule(rule.id)}
              >
                <Text className="text-white font-medium">Delete Rule</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Add Rule Form */}
        {showAddRule ? (
          <View className="bg-surface p-6 rounded-2xl border border-border mb-6">
            <Text className="text-foreground text-lg font-semibold mb-4">Create New Rule</Text>

            <Text className="text-foreground font-medium mb-2">Rule Name</Text>
            <TextInput
              className="bg-background border border-border rounded-lg px-4 py-3 text-foreground mb-4"
              placeholder="My Round-Up Rule"
              placeholderTextColor="#9BA1A6"
              value={newRuleName}
              onChangeText={setNewRuleName}
            />

            <Text className="text-foreground font-medium mb-2">Rule Type</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {(["fixed", "percentage", "smart"] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  className={`px-4 py-2 rounded-lg ${newRuleType === type ? "bg-primary" : "bg-background border border-border"}`}
                  onPress={() => setNewRuleType(type)}
                >
                  <Text className={newRuleType === type ? "text-white font-medium" : "text-foreground"}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {newRuleType === "fixed" && (
              <>
                <Text className="text-foreground font-medium mb-2">Fixed Amount ($)</Text>
                <TextInput
                  className="bg-background border border-border rounded-lg px-4 py-3 text-foreground mb-4"
                  placeholder="1.00"
                  placeholderTextColor="#9BA1A6"
                  value={newRuleAmount}
                  onChangeText={setNewRuleAmount}
                  keyboardType="decimal-pad"
                />
              </>
            )}

            {newRuleType === "percentage" && (
              <>
                <Text className="text-foreground font-medium mb-2">Percentage (%)</Text>
                <TextInput
                  className="bg-background border border-border rounded-lg px-4 py-3 text-foreground mb-4"
                  placeholder="10"
                  placeholderTextColor="#9BA1A6"
                  value={newRulePercentage}
                  onChangeText={setNewRulePercentage}
                  keyboardType="decimal-pad"
                />
              </>
            )}

            <Text className="text-foreground font-medium mb-2">Max Daily Amount ($)</Text>
            <TextInput
              className="bg-background border border-border rounded-lg px-4 py-3 text-foreground mb-4"
              placeholder="50"
              placeholderTextColor="#9BA1A6"
              value={newRuleMaxDaily}
              onChangeText={setNewRuleMaxDaily}
              keyboardType="decimal-pad"
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 bg-background border border-border py-3 rounded-lg"
                onPress={() => {
                  setShowAddRule(false);
                  setNewRuleName("");
                  setNewRuleAmount("");
                  setNewRulePercentage("");
                }}
              >
                <Text className="text-foreground text-center font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-primary py-3 rounded-lg"
                onPress={handleCreateRule}
              >
                <Text className="text-white text-center font-medium">Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            className="bg-primary py-4 rounded-lg mb-6"
            onPress={() => setShowAddRule(true)}
          >
            <Text className="text-white text-center font-semibold text-lg">+ Create New Rule</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
