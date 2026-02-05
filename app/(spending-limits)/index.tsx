import { ScrollView, Text, View, Pressable, TextInput, Alert, Modal } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  getSpendingLimits,
  createSpendingLimit,
  deleteSpendingLimit,
  getSpendingLimitStatistics,
  getRemainingBudget,
  getUsagePercentage,
  getTimeRemainingInPeriod,
  getPeriodDisplayName,
  type SpendingLimit,
} from "@/utils/spending-limits";

export default function SpendingLimitsScreen() {
  const colors = useColors();
  const [limits, setLimits] = useState<SpendingLimit[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Form state
  const [name, setName] = useState("");
  const [limitAmount, setLimitAmount] = useState("");
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("monthly");
  const [alertThreshold, setAlertThreshold] = useState("80");

  useEffect(() => {
    loadLimits();
  }, []);

  const loadLimits = async () => {
    const [allLimits, statistics] = await Promise.all([
      getSpendingLimits(),
      getSpendingLimitStatistics(),
    ]);
    
    setLimits(allLimits.filter((l) => l.is_active));
    setStats(statistics);
  };

  const handleCreateLimit = async () => {
    if (!name || !limitAmount) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    const amount = parseFloat(limitAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    const threshold = parseFloat(alertThreshold);
    if (isNaN(threshold) || threshold < 0 || threshold > 100) {
      Alert.alert("Error", "Alert threshold must be between 0 and 100");
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      await createSpendingLimit({
        name,
        limit_amount: amount,
        period,
        alert_threshold: threshold,
        is_active: true,
      });

      Alert.alert("Success", "Spending limit created!");
      
      // Reset form
      setName("");
      setLimitAmount("");
      setPeriod("monthly");
      setAlertThreshold("80");
      setShowCreateModal(false);
      
      await loadLimits();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to create limit");
    }
  };

  const handleDeleteLimit = async (limitId: string, limitName: string) => {
    Alert.alert(
      "Delete Limit",
      `Are you sure you want to delete "${limitName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteSpendingLimit(limitId);
            await loadLimits();
          },
        },
      ]
    );
  };

  const renderLimit = (limit: SpendingLimit) => {
    const usagePercentage = getUsagePercentage(limit);
    const remaining = getRemainingBudget(limit);
    const timeRemaining = getTimeRemainingInPeriod(limit);
    const isApproaching = usagePercentage >= limit.alert_threshold;
    const isExceeded = usagePercentage >= 100;

    return (
      <View
        key={limit.id}
        className="bg-surface rounded-2xl p-4 border border-border"
      >
        <View className="flex-row items-start justify-between mb-3">
          <View className="flex-1">
            <Text className="text-base font-semibold text-foreground mb-1">
              {limit.name}
            </Text>
            <Text className="text-sm text-muted">
              {getPeriodDisplayName(limit.period)} Limit
            </Text>
          </View>
          
          <View
            style={{
              backgroundColor: isExceeded
                ? colors.error + "20"
                : isApproaching
                ? colors.warning + "20"
                : colors.success + "20",
            }}
            className="px-3 py-1 rounded-full"
          >
            <Text
              style={{
                color: isExceeded ? colors.error : isApproaching ? colors.warning : colors.success,
              }}
              className="text-xs font-semibold"
            >
              {usagePercentage.toFixed(0)}%
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View className="mb-3">
          <View className="h-3 bg-background rounded-full overflow-hidden">
            <View
              style={{
                width: `${Math.min(100, usagePercentage)}%`,
                backgroundColor: isExceeded ? colors.error : isApproaching ? colors.warning : colors.primary,
              }}
              className="h-full rounded-full"
            />
          </View>
        </View>

        {/* Spending Info */}
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-xs text-muted mb-1">Spent</Text>
            <Text className="text-base font-bold text-foreground">
              ${limit.current_spending.toFixed(2)}
            </Text>
          </View>
          
          <View className="items-center">
            <Text className="text-xs text-muted mb-1">Remaining</Text>
            <Text
              style={{ color: isExceeded ? colors.error : colors.foreground }}
              className="text-base font-bold"
            >
              ${remaining.toFixed(2)}
            </Text>
          </View>
          
          <View className="items-end">
            <Text className="text-xs text-muted mb-1">Limit</Text>
            <Text className="text-base font-bold text-foreground">
              ${limit.limit_amount.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Period Info */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-xs text-muted">{timeRemaining}</Text>
          <Text className="text-xs text-muted">
            Alert at {limit.alert_threshold}%
          </Text>
        </View>

        {/* Status Message */}
        {isExceeded && (
          <View
            style={{ backgroundColor: colors.error + "10" }}
            className="p-3 rounded-xl mb-3"
          >
            <Text style={{ color: colors.error }} className="text-sm">
              ⚠️ You've exceeded this limit by ${(limit.current_spending - limit.limit_amount).toFixed(2)}
            </Text>
          </View>
        )}
        
        {isApproaching && !isExceeded && (
          <View
            style={{ backgroundColor: colors.warning + "10" }}
            className="p-3 rounded-xl mb-3"
          >
            <Text style={{ color: colors.warning }} className="text-sm">
              ⚠️ You're approaching your limit. ${remaining.toFixed(2)} remaining.
            </Text>
          </View>
        )}

        {/* Delete Button */}
        <Pressable
          onPress={() => handleDeleteLimit(limit.id, limit.name)}
          style={({ pressed }) => [
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          className="border rounded-xl py-2"
        >
          <Text className="text-center text-sm font-medium text-foreground">
            Delete Limit
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">
              Spending Limits
            </Text>
            <Text className="text-sm text-muted">
              Set limits and get real-time alerts
            </Text>
          </View>

          {/* Stats Cards */}
          {stats && (
            <View className="flex-row gap-3">
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Active Limits</Text>
                <Text className="text-xl font-bold text-foreground">
                  {stats.active}
                </Text>
              </View>
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Approaching</Text>
                <Text className="text-xl font-bold text-foreground">
                  {stats.approaching}
                </Text>
              </View>
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Exceeded</Text>
                <Text className="text-xl font-bold text-foreground">
                  {stats.exceeded}
                </Text>
              </View>
            </View>
          )}

          {/* Create Button */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowCreateModal(true);
            }}
            style={({ pressed }) => [
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            className="rounded-full py-4"
          >
            <Text
              style={{ color: colors.background }}
              className="text-center font-semibold text-base"
            >
              + Create Spending Limit
            </Text>
          </Pressable>

          {/* Active Limits */}
          {limits.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">
                Your Limits
              </Text>
              {limits.map(renderLimit)}
            </View>
          )}

          {/* Empty State */}
          {limits.length === 0 && (
            <View className="items-center justify-center py-12">
              <Text className="text-6xl mb-4">💰</Text>
              <Text className="text-lg font-semibold text-foreground mb-2">
                No spending limits yet
              </Text>
              <Text className="text-sm text-muted text-center">
                Create your first spending limit to track and control expenses
              </Text>
            </View>
          )}

          {/* Info Card */}
          <View
            style={{ backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }}
            className="rounded-2xl p-4 border"
          >
            <Text className="text-sm font-semibold text-foreground mb-2">
              💡 How Spending Limits Work
            </Text>
            <Text className="text-sm text-muted mb-1">
              • Set daily, weekly, or monthly spending caps
            </Text>
            <Text className="text-sm text-muted mb-1">
              • Get alerts when approaching your limit
            </Text>
            <Text className="text-sm text-muted">
              • Instant notifications when limits are exceeded
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Create Limit Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View
            style={{ backgroundColor: colors.background }}
            className="rounded-t-3xl p-6"
          >
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-foreground">
                Create Spending Limit
              </Text>
              <Pressable onPress={() => setShowCreateModal(false)}>
                <Text className="text-2xl text-muted">✕</Text>
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
              <View className="gap-4">
                {/* Name */}
                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Limit Name</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g., Monthly Budget"
                    style={{
                      backgroundColor: colors.surface,
                      color: colors.foreground,
                      borderColor: colors.border,
                    }}
                    className="border rounded-xl px-4 py-3 text-base"
                    placeholderTextColor={colors.muted}
                  />
                </View>

                {/* Amount */}
                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Limit Amount</Text>
                  <TextInput
                    value={limitAmount}
                    onChangeText={setLimitAmount}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    style={{
                      backgroundColor: colors.surface,
                      color: colors.foreground,
                      borderColor: colors.border,
                    }}
                    className="border rounded-xl px-4 py-3 text-base"
                    placeholderTextColor={colors.muted}
                  />
                </View>

                {/* Period */}
                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Period</Text>
                  <View className="flex-row gap-2">
                    {(["daily", "weekly", "monthly"] as const).map((p) => (
                      <Pressable
                        key={p}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setPeriod(p);
                        }}
                        style={({ pressed }) => [
                          {
                            backgroundColor: period === p ? colors.primary : colors.surface,
                            borderColor: colors.border,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                        className="flex-1 border rounded-xl py-3"
                      >
                        <Text
                          style={{
                            color: period === p ? colors.background : colors.foreground,
                          }}
                          className="text-center font-medium capitalize"
                        >
                          {p}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Alert Threshold */}
                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">
                    Alert Threshold (%)
                  </Text>
                  <TextInput
                    value={alertThreshold}
                    onChangeText={setAlertThreshold}
                    placeholder="80"
                    keyboardType="number-pad"
                    style={{
                      backgroundColor: colors.surface,
                      color: colors.foreground,
                      borderColor: colors.border,
                    }}
                    className="border rounded-xl px-4 py-3 text-base"
                    placeholderTextColor={colors.muted}
                  />
                  <Text className="text-xs text-muted">
                    You'll be notified when you reach this percentage of your limit
                  </Text>
                </View>

                {/* Create Button */}
                <Pressable
                  onPress={handleCreateLimit}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                  className="rounded-xl py-4 mt-2"
                >
                  <Text
                    style={{ color: colors.background }}
                    className="text-center font-semibold text-base"
                  >
                    Create Limit
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
