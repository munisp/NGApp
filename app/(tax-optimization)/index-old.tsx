import { ScrollView, Text, View, Pressable, ActivityIndicator, Alert } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import axios from "axios";

interface TaxOptimizationReport {
  summary: {
    totalPotentialSavings: number;
    opportunitiesCount: number;
    priorityActions: number;
    insights: string[];
  };
  taxLossHarvesting: Array<{
    symbol: string;
    action: string;
    potentialSavings: number;
    currentLoss: number;
    recommendation: string;
    risk: string;
    timing: string;
  }>;
  withdrawalStrategies: Array<{
    accountName: string;
    action: string;
    amount: number;
    recommendation: string;
    priority: string;
  }>;
  deductionStrategies: Array<{
    category: string;
    strategy: string;
    recommendation: string;
    potentialSavings: number;
    implementation: string;
    priority: string;
  }>;
  taxCalendar: Array<{
    date: string;
    title: string;
    description: string;
    action: string;
    priority: string;
  }>;
}

export default function TaxOptimizationScreen() {
  const colors = useColors();
  const [report, setReport] = useState<TaxOptimizationReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<"overview" | "strategies" | "calendar">("overview");

  useEffect(() => {
    loadTaxOptimizationReport();
  }, []);

  const loadTaxOptimizationReport = async () => {
    setIsLoading(true);
    try {
      // Mock data for demonstration
      const mockInput = {
        portfolio: [
          { symbol: "AAPL", purchasePrice: 180, currentPrice: 185, quantity: 10 },
          { symbol: "TSLA", purchasePrice: 250, currentPrice: 240, quantity: 5 },
        ],
        accounts: [
          { id: "1", name: "401(k)", type: "401k", balance: 150000, annualIncome: 0 },
          { id: "2", name: "Traditional IRA", type: "traditional_ira", balance: 50000, annualIncome: 0 },
        ],
        expenses: [
          { category: "charity", amount: 5000 },
          { category: "medical", amount: 8000 },
        ],
        income: 75000,
        age: 35,
      };

      const response = await axios.post(
        "http://127.0.0.1:3000/api/trpc/taxOptimization.generateReport",
        mockInput
      );

      setReport(response.data.result.data);
    } catch (error) {
      console.error("Failed to load tax optimization report:", error);
      Alert.alert("Error", "Failed to generate tax optimization report");
    } finally {
      setIsLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "critical":
      case "high":
        return colors.error;
      case "medium":
        return colors.warning;
      default:
        return colors.success;
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "critical":
        return "🚨";
      case "high":
        return "⚠️";
      case "medium":
        return "💡";
      default:
        return "✅";
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-base text-muted mt-4">Analyzing tax optimization opportunities...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!report) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center">
          <Text className="text-4xl mb-4">📊</Text>
          <Text className="text-base text-muted text-center">
            No tax optimization report available
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View>
            <Text className="text-2xl font-bold text-foreground mb-2">Tax Optimization</Text>
            <Text className="text-sm text-muted">
              AI-powered strategies to minimize your tax burden
            </Text>
          </View>

          {/* Tabs */}
          <View className="flex-row gap-3">
            {[
              { id: "overview", label: "Overview", icon: "📊" },
              { id: "strategies", label: "Strategies", icon: "💡" },
              { id: "calendar", label: "Calendar", icon: "📅" },
            ].map((tab) => (
              <Pressable
                key={tab.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedTab(tab.id as any);
                }}
                style={({ pressed }) => [
                  {
                    backgroundColor:
                      selectedTab === tab.id ? colors.primary : colors.surface,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                className="flex-1 rounded-full px-4 py-3"
              >
                <Text
                  style={{
                    color: selectedTab === tab.id ? colors.background : colors.foreground,
                  }}
                  className="text-center font-semibold text-sm"
                >
                  {tab.icon} {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Overview Tab */}
          {selectedTab === "overview" && (
            <>
              {/* Summary Card */}
              <View
                style={{ backgroundColor: colors.primary + "20" }}
                className="rounded-2xl p-6"
              >
                <Text className="text-4xl font-bold text-foreground mb-2">
                  ${report.summary.totalPotentialSavings.toFixed(0)}
                </Text>
                <Text className="text-base text-muted mb-4">
                  Potential Tax Savings This Year
                </Text>

                <View className="flex-row gap-4">
                  <View className="flex-1">
                    <Text className="text-2xl font-bold text-foreground">
                      {report.summary.opportunitiesCount}
                    </Text>
                    <Text className="text-xs text-muted">Opportunities</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-2xl font-bold text-foreground">
                      {report.summary.priorityActions}
                    </Text>
                    <Text className="text-xs text-muted">Priority Actions</Text>
                  </View>
                </View>
              </View>

              {/* AI Insights */}
              <View>
                <Text className="text-lg font-bold text-foreground mb-4">
                  AI-Powered Insights
                </Text>

                {report.summary.insights.map((insight, index) => (
                  <View
                    key={index}
                    style={{ backgroundColor: colors.surface }}
                    className="rounded-2xl p-5 mb-3"
                  >
                    <View className="flex-row items-start gap-3">
                      <Text className="text-xl">💡</Text>
                      <Text className="flex-1 text-sm text-foreground leading-relaxed">
                        {insight}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Strategies Tab */}
          {selectedTab === "strategies" && (
            <>
              {/* Tax-Loss Harvesting */}
              {report.taxLossHarvesting.length > 0 && (
                <View>
                  <Text className="text-lg font-bold text-foreground mb-4">
                    Tax-Loss Harvesting
                  </Text>

                  {report.taxLossHarvesting.map((opportunity, index) => (
                    <View
                      key={index}
                      style={{ backgroundColor: colors.surface }}
                      className="rounded-2xl p-5 mb-4"
                    >
                      <View className="flex-row items-center justify-between mb-3">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-base font-bold text-foreground">
                            {opportunity.symbol}
                          </Text>
                          <View
                            style={{ backgroundColor: colors.error + "20" }}
                            className="rounded-full px-2 py-1"
                          >
                            <Text
                              style={{ color: colors.error }}
                              className="text-xs font-bold"
                            >
                              -{opportunity.currentLoss.toFixed(0)}
                            </Text>
                          </View>
                        </View>

                        <Text className="text-lg font-bold text-foreground">
                          ${opportunity.potentialSavings.toFixed(0)}
                        </Text>
                      </View>

                      <Text className="text-sm text-muted leading-relaxed mb-3">
                        {opportunity.recommendation}
                      </Text>

                      <View className="flex-row items-center gap-2">
                        <View
                          style={{ backgroundColor: colors.warning + "20" }}
                          className="rounded-full px-3 py-1"
                        >
                          <Text
                            style={{ color: colors.warning }}
                            className="text-xs font-bold uppercase"
                          >
                            {opportunity.risk} risk
                          </Text>
                        </View>
                        <View
                          style={{ backgroundColor: colors.primary + "20" }}
                          className="rounded-full px-3 py-1"
                        >
                          <Text
                            style={{ color: colors.primary }}
                            className="text-xs font-bold"
                          >
                            {opportunity.timing.replace("_", " ")}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Deduction Strategies */}
              {report.deductionStrategies.length > 0 && (
                <View>
                  <Text className="text-lg font-bold text-foreground mb-4">
                    Deduction Maximization
                  </Text>

                  {report.deductionStrategies.map((strategy, index) => (
                    <View
                      key={index}
                      style={{ backgroundColor: colors.surface }}
                      className="rounded-2xl p-5 mb-4"
                    >
                      <View className="flex-row items-center justify-between mb-3">
                        <View className="flex-1">
                          <Text className="text-base font-bold text-foreground mb-1">
                            {strategy.strategy.replace(/_/g, " ").toUpperCase()}
                          </Text>
                          <Text className="text-xs text-muted">
                            {strategy.category.replace(/_/g, " ")}
                          </Text>
                        </View>

                        <View className="items-end">
                          <Text className="text-lg font-bold text-foreground">
                            ${strategy.potentialSavings.toFixed(0)}
                          </Text>
                          <Text className="text-xs text-muted">savings</Text>
                        </View>
                      </View>

                      <Text className="text-sm text-foreground leading-relaxed mb-3">
                        {strategy.recommendation}
                      </Text>

                      <View
                        style={{ backgroundColor: colors.background }}
                        className="rounded-xl p-3 mb-3"
                      >
                        <Text className="text-xs text-muted mb-1">How to implement:</Text>
                        <Text className="text-sm text-foreground leading-relaxed">
                          {strategy.implementation}
                        </Text>
                      </View>

                      <View
                        style={{
                          backgroundColor: getPriorityColor(strategy.priority) + "20",
                        }}
                        className="rounded-full px-3 py-1 self-start"
                      >
                        <Text
                          style={{ color: getPriorityColor(strategy.priority) }}
                          className="text-xs font-bold uppercase"
                        >
                          {getPriorityIcon(strategy.priority)} {strategy.priority} priority
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Withdrawal Strategies */}
              {report.withdrawalStrategies.length > 0 && (
                <View>
                  <Text className="text-lg font-bold text-foreground mb-4">
                    Withdrawal Strategies
                  </Text>

                  {report.withdrawalStrategies.map((strategy, index) => (
                    <View
                      key={index}
                      style={{ backgroundColor: colors.surface }}
                      className="rounded-2xl p-5 mb-4"
                    >
                      <View className="flex-row items-center justify-between mb-3">
                        <Text className="text-base font-bold text-foreground">
                          {strategy.accountName}
                        </Text>
                        <View
                          style={{
                            backgroundColor: getPriorityColor(strategy.priority) + "20",
                          }}
                          className="rounded-full px-3 py-1"
                        >
                          <Text
                            style={{ color: getPriorityColor(strategy.priority) }}
                            className="text-xs font-bold uppercase"
                          >
                            {strategy.priority}
                          </Text>
                        </View>
                      </View>

                      <Text className="text-2xl font-bold text-foreground mb-3">
                        ${strategy.amount.toFixed(2)}
                      </Text>

                      <Text className="text-sm text-muted leading-relaxed">
                        {strategy.recommendation}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {/* Calendar Tab */}
          {selectedTab === "calendar" && (
            <View>
              <Text className="text-lg font-bold text-foreground mb-4">
                Tax Planning Calendar
              </Text>

              {report.taxCalendar.map((deadline, index) => {
                const deadlineDate = new Date(deadline.date);
                const isUpcoming = deadlineDate.getTime() > Date.now();

                return (
                  <View
                    key={index}
                    style={{
                      backgroundColor: isUpcoming ? colors.surface : colors.muted + "20",
                    }}
                    className="rounded-2xl p-5 mb-3"
                  >
                    <View className="flex-row items-start justify-between mb-3">
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2 mb-2">
                          <Text className="text-base font-bold text-foreground">
                            {deadline.title}
                          </Text>
                          {isUpcoming && (
                            <View
                              style={{
                                backgroundColor: getPriorityColor(deadline.priority) + "20",
                              }}
                              className="rounded-full px-2 py-1"
                            >
                              <Text
                                style={{ color: getPriorityColor(deadline.priority) }}
                                className="text-xs font-bold"
                              >
                                {getPriorityIcon(deadline.priority)}
                              </Text>
                            </View>
                          )}
                        </View>

                        <Text className="text-sm text-muted mb-2">
                          {deadline.description}
                        </Text>

                        <Text className="text-sm font-semibold text-foreground">
                          Action: {deadline.action}
                        </Text>
                      </View>

                      <View className="items-end">
                        <Text className="text-sm font-bold text-foreground">
                          {deadlineDate.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </Text>
                        <Text className="text-xs text-muted">
                          {deadlineDate.getFullYear()}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Refresh Button */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              loadTaxOptimizationReport();
            }}
            style={({ pressed }) => [
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            className="rounded-xl px-6 py-4"
          >
            <Text
              style={{ color: colors.background }}
              className="text-center font-bold text-base"
            >
              🔄 Refresh Analysis
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
