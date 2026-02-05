import { ScrollView, Text, View, Pressable, TextInput, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { LineChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  loadDebts,
  compareStrategies,
  calculateDebtFreeDate,
  calculateTotalDebt,
  calculateTotalMinimumPayment,
  getDebtTypeIcon,
  type Debt,
  type PayoffPlan,
} from "@/utils/debt-payoff";

const screenWidth = Dimensions.get("window").width;

export default function DebtPayoffScreen() {
  const colors = useColors();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [comparison, setComparison] = useState<{
    snowball: PayoffPlan;
    avalanche: PayoffPlan;
    comparison: {
      monthsDifference: number;
      interestSavings: number;
      recommendation: "snowball" | "avalanche";
      reason: string;
    };
  } | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<"snowball" | "avalanche" | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const loadedDebts = await loadDebts();
      setDebts(loadedDebts);

      const totalMinimum = calculateTotalMinimumPayment(loadedDebts);
      setMonthlyPayment((totalMinimum * 1.5).toFixed(0));
    } catch (error) {
      console.error("Failed to load debts:", error);
      setError("Failed to load debts");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCalculate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError("");

    const payment = parseFloat(monthlyPayment);
    if (isNaN(payment) || payment <= 0) {
      setError("Please enter a valid monthly payment");
      return;
    }

    const totalMinimum = calculateTotalMinimumPayment(debts);
    if (payment < totalMinimum) {
      setError(
        `Monthly payment must be at least $${totalMinimum.toFixed(0)} (total minimum payments)`
      );
      return;
    }

    try {
      const result = compareStrategies(debts, payment);
      setComparison(result);
      setSelectedStrategy(result.comparison.recommendation);
    } catch (error: any) {
      setError(error.message || "Failed to calculate payoff plan");
    }
  };

  const handleStrategySelect = (strategy: "snowball" | "avalanche") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedStrategy(strategy);
  };

  if (isLoading) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-base text-muted mt-4">Loading debts...</Text>
        </View>
      </ScreenContainer>
    );
  }

  const totalDebt = calculateTotalDebt(debts);
  const totalMinimumPayment = calculateTotalMinimumPayment(debts);
  const selectedPlan = selectedStrategy ? comparison?.[selectedStrategy] : null;
  const debtFreeDate = selectedPlan ? calculateDebtFreeDate(selectedPlan) : null;

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View>
            <Text className="text-2xl font-bold text-foreground mb-2">Debt Payoff Optimizer</Text>
            <Text className="text-sm text-muted">
              Find the fastest way to become debt-free
            </Text>
          </View>

          {/* Total Debt Card */}
          <View
            style={{ backgroundColor: colors.surface }}
            className="rounded-2xl p-6"
          >
            <Text className="text-sm text-muted mb-2">Total Debt</Text>
            <Text className="text-4xl font-bold text-foreground mb-4">
              ${totalDebt.toLocaleString()}
            </Text>

            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xs text-muted mb-1">Minimum Payment</Text>
                <Text className="text-lg font-bold text-foreground">
                  ${totalMinimumPayment.toFixed(0)}/mo
                </Text>
              </View>
              <View>
                <Text className="text-xs text-muted mb-1">Number of Debts</Text>
                <Text className="text-lg font-bold text-foreground">{debts.length}</Text>
              </View>
            </View>
          </View>

          {/* Debts List */}
          <View>
            <Text className="text-lg font-bold text-foreground mb-4">Your Debts</Text>

            {debts.map((debt) => (
              <View
                key={debt.id}
                style={{ backgroundColor: colors.surface }}
                className="rounded-2xl p-5 mb-3"
              >
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center gap-3">
                    <Text className="text-2xl">{getDebtTypeIcon(debt.type)}</Text>
                    <View>
                      <Text className="text-base font-bold text-foreground">{debt.name}</Text>
                      <Text className="text-xs text-muted">{debt.interestRate}% APR</Text>
                    </View>
                  </View>
                  <Text className="text-xl font-bold text-foreground">
                    ${debt.balance.toLocaleString()}
                  </Text>
                </View>

                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted">Minimum Payment</Text>
                  <Text className="text-sm font-bold text-foreground">
                    ${debt.minimumPayment}/mo
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Payment Input */}
          <View>
            <Text className="text-lg font-bold text-foreground mb-4">
              Monthly Payment Budget
            </Text>

            <View
              style={{ backgroundColor: colors.surface }}
              className="rounded-2xl p-5"
            >
              <Text className="text-sm text-muted mb-3">
                How much can you pay toward debt each month?
              </Text>

              <View className="flex-row items-center gap-3 mb-4">
                <Text className="text-2xl font-bold text-foreground">$</Text>
                <TextInput
                  value={monthlyPayment}
                  onChangeText={setMonthlyPayment}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                  style={{
                    color: colors.foreground,
                    backgroundColor: colors.background,
                  }}
                  className="flex-1 text-2xl font-bold px-4 py-3 rounded-xl"
                />
              </View>

              {error && (
                <View
                  style={{ backgroundColor: colors.error + "20" }}
                  className="rounded-xl p-3 mb-4"
                >
                  <Text style={{ color: colors.error }} className="text-sm">
                    {error}
                  </Text>
                </View>
              )}

              <Pressable
                onPress={handleCalculate}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                className="rounded-xl py-4 items-center"
              >
                <Text style={{ color: colors.background }} className="text-base font-bold">
                  Calculate Payoff Plan
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Comparison Results */}
          {comparison && (
            <>
              {/* Strategy Comparison */}
              <View>
                <Text className="text-lg font-bold text-foreground mb-4">
                  Strategy Comparison
                </Text>

                <View className="flex-row gap-3 mb-4">
                  <Pressable
                    onPress={() => handleStrategySelect("snowball")}
                    style={({ pressed }) => [
                      {
                        backgroundColor:
                          selectedStrategy === "snowball" ? colors.primary : colors.surface,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    className="flex-1 rounded-2xl p-5"
                  >
                    <View className="items-center">
                      <Text
                        style={{
                          color:
                            selectedStrategy === "snowball"
                              ? colors.background
                              : colors.foreground,
                        }}
                        className="text-base font-bold mb-2"
                      >
                        ❄️ Snowball
                      </Text>
                      <Text
                        style={{
                          color:
                            selectedStrategy === "snowball"
                              ? colors.background
                              : colors.muted,
                        }}
                        className="text-xs text-center mb-3"
                      >
                        Smallest balance first
                      </Text>
                      <Text
                        style={{
                          color:
                            selectedStrategy === "snowball"
                              ? colors.background
                              : colors.foreground,
                        }}
                        className="text-2xl font-bold mb-1"
                      >
                        {comparison.snowball.totalMonths}
                      </Text>
                      <Text
                        style={{
                          color:
                            selectedStrategy === "snowball"
                              ? colors.background
                              : colors.muted,
                        }}
                        className="text-xs"
                      >
                        months
                      </Text>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={() => handleStrategySelect("avalanche")}
                    style={({ pressed }) => [
                      {
                        backgroundColor:
                          selectedStrategy === "avalanche" ? colors.primary : colors.surface,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    className="flex-1 rounded-2xl p-5"
                  >
                    <View className="items-center">
                      <Text
                        style={{
                          color:
                            selectedStrategy === "avalanche"
                              ? colors.background
                              : colors.foreground,
                        }}
                        className="text-base font-bold mb-2"
                      >
                        🏔️ Avalanche
                      </Text>
                      <Text
                        style={{
                          color:
                            selectedStrategy === "avalanche"
                              ? colors.background
                              : colors.muted,
                        }}
                        className="text-xs text-center mb-3"
                      >
                        Highest rate first
                      </Text>
                      <Text
                        style={{
                          color:
                            selectedStrategy === "avalanche"
                              ? colors.background
                              : colors.foreground,
                        }}
                        className="text-2xl font-bold mb-1"
                      >
                        {comparison.avalanche.totalMonths}
                      </Text>
                      <Text
                        style={{
                          color:
                            selectedStrategy === "avalanche"
                              ? colors.background
                              : colors.muted,
                        }}
                        className="text-xs"
                      >
                        months
                      </Text>
                    </View>
                  </Pressable>
                </View>

                {/* Recommendation */}
                <View
                  style={{ backgroundColor: colors.primary + "20" }}
                  className="rounded-2xl p-5"
                >
                  <View className="flex-row items-center gap-2 mb-2">
                    <Text className="text-xl">💡</Text>
                    <Text style={{ color: colors.primary }} className="text-base font-bold">
                      Recommendation
                    </Text>
                  </View>
                  <Text className="text-sm text-foreground leading-relaxed">
                    {comparison.comparison.reason}
                  </Text>
                </View>
              </View>

              {/* Selected Plan Details */}
              {selectedPlan && debtFreeDate && (
                <>
                  {/* Debt-Free Timeline */}
                  <View
                    style={{ backgroundColor: colors.surface }}
                    className="rounded-2xl p-6"
                  >
                    <Text className="text-lg font-bold text-foreground mb-4">
                      Your Debt-Free Journey
                    </Text>

                    <View className="items-center mb-6">
                      <Text className="text-sm text-muted mb-2">Debt-Free Date</Text>
                      <Text className="text-3xl font-bold text-foreground mb-1">
                        {debtFreeDate.toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })}
                      </Text>
                      <Text className="text-sm text-muted">
                        {selectedPlan.totalMonths} months from now
                      </Text>
                    </View>

                    <View className="gap-3">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-sm text-muted">Total Amount Paid</Text>
                        <Text className="text-base font-bold text-foreground">
                          ${selectedPlan.totalAmountPaid.toLocaleString()}
                        </Text>
                      </View>

                      <View className="flex-row items-center justify-between">
                        <Text className="text-sm text-muted">Total Interest Paid</Text>
                        <Text className="text-base font-bold text-foreground">
                          ${selectedPlan.totalInterestPaid.toLocaleString()}
                        </Text>
                      </View>

                      <View className="flex-row items-center justify-between">
                        <Text className="text-sm text-muted">Interest Savings vs Minimum</Text>
                        <Text style={{ color: colors.success }} className="text-base font-bold">
                          Significant
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Balance Over Time Chart */}
                  <View>
                    <Text className="text-lg font-bold text-foreground mb-4">
                      Balance Over Time
                    </Text>

                    <View style={{ backgroundColor: colors.surface }} className="rounded-2xl p-4">
                      <LineChart
                        data={{
                          labels: selectedPlan.monthlyBreakdown
                            .filter((_, i) => i % Math.ceil(selectedPlan.monthlyBreakdown.length / 6) === 0)
                            .map((m) => `Mo ${m.month}`),
                          datasets: [
                            {
                              data: selectedPlan.monthlyBreakdown
                                .filter((_, i) => i % Math.ceil(selectedPlan.monthlyBreakdown.length / 6) === 0)
                                .map((m) => m.totalRemainingBalance),
                            },
                          ],
                        }}
                        width={screenWidth - 80}
                        height={220}
                        chartConfig={{
                          backgroundColor: colors.surface,
                          backgroundGradientFrom: colors.surface,
                          backgroundGradientTo: colors.surface,
                          decimalPlaces: 0,
                          color: (opacity = 1) => colors.primary,
                          labelColor: (opacity = 1) => colors.muted,
                          style: {
                            borderRadius: 16,
                          },
                          propsForDots: {
                            r: "6",
                            strokeWidth: "2",
                            stroke: colors.primary,
                          },
                        }}
                        bezier
                        style={{
                          marginVertical: 8,
                          borderRadius: 16,
                        }}
                      />
                    </View>
                  </View>

                  {/* Payoff Order */}
                  <View>
                    <Text className="text-lg font-bold text-foreground mb-4">
                      Payoff Order
                    </Text>

                    {selectedPlan.debtPayoffOrder.map((debtId, index) => {
                      const debt = debts.find((d) => d.id === debtId);
                      if (!debt) return null;

                      return (
                        <View
                          key={debtId}
                          style={{ backgroundColor: colors.surface }}
                          className="rounded-2xl p-5 mb-3"
                        >
                          <View className="flex-row items-center gap-3">
                            <View
                              style={{ backgroundColor: colors.primary }}
                              className="w-8 h-8 rounded-full items-center justify-center"
                            >
                              <Text style={{ color: colors.background }} className="font-bold">
                                {index + 1}
                              </Text>
                            </View>
                            <View className="flex-1">
                              <Text className="text-base font-bold text-foreground">
                                {debt.name}
                              </Text>
                              <Text className="text-xs text-muted">
                                ${debt.balance.toLocaleString()} at {debt.interestRate}% APR
                              </Text>
                            </View>
                            <Text className="text-xl">{getDebtTypeIcon(debt.type)}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
