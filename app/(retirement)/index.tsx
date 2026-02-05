import { ScrollView, Text, View, TouchableOpacity, TextInput, Modal, Platform, Dimensions } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useEffect } from "react";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";
import { LineChart } from "react-native-chart-kit";
import {
  RetirementAccount,
  RetirementGoal,
  RetirementProjection,
  WithdrawalStrategy,
  loadRetirementAccounts,
  saveRetirementAccount,
  deleteRetirementAccount,
  loadRetirementGoal,
  saveRetirementGoal,
  calculateTotalBalance,
  calculateAnnualContribution,
  projectRetirement,
  calculateWithdrawalStrategy,
  getAccountTypeLabel,
  getAccountTypeIcon,
  calculateRMD,
} from "@/utils/retirement-planning";

export default function RetirementPlanningScreen() {
  const colors = useColors();
  const [accounts, setAccounts] = useState<RetirementAccount[]>([]);
  const [goal, setGoal] = useState<RetirementGoal | null>(null);
  const [projection, setProjection] = useState<RetirementProjection | null>(null);
  const [withdrawalStrategy, setWithdrawalStrategy] = useState<WithdrawalStrategy | null>(null);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [accountForm, setAccountForm] = useState<Partial<RetirementAccount>>({
    type: "401k",
    contributionFrequency: "monthly",
    returnRate: 7,
  });

  const [goalForm, setGoalForm] = useState<Partial<RetirementGoal>>({
    inflationRate: 3,
    lifeExpectancy: 85,
    desiredIncomeReplacement: 80,
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const loadedAccounts = await loadRetirementAccounts();
      setAccounts(loadedAccounts);

      const loadedGoal = await loadRetirementGoal();
      setGoal(loadedGoal);

      if (loadedGoal && loadedAccounts.length > 0) {
        const proj = projectRetirement(loadedAccounts, loadedGoal);
        setProjection(proj);

        const strategy = calculateWithdrawalStrategy(proj.totalSavings, loadedGoal);
        setWithdrawalStrategy(strategy);
      }
    } catch (error) {
      console.error("Failed to load retirement data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddAccount() {
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const newAccount: RetirementAccount = {
        id: Date.now().toString(),
        type: accountForm.type || "401k",
        name: accountForm.name || "",
        balance: accountForm.balance || 0,
        contributionAmount: accountForm.contributionAmount || 0,
        contributionFrequency: accountForm.contributionFrequency || "monthly",
        employerMatch: accountForm.employerMatch || 0,
        employerMatchLimit: accountForm.employerMatchLimit || 0,
        returnRate: accountForm.returnRate || 7,
        date: Date.now(),
      };

      await saveRetirementAccount(newAccount);
      await loadData();
      setShowAddAccountModal(false);
      resetAccountForm();
    } catch (error) {
      console.error("Failed to add account:", error);
    }
  }

  async function handleSaveGoal() {
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const newGoal: RetirementGoal = {
        currentAge: goalForm.currentAge || 30,
        retirementAge: goalForm.retirementAge || 65,
        currentIncome: goalForm.currentIncome || 50000,
        desiredIncomeReplacement: goalForm.desiredIncomeReplacement || 80,
        inflationRate: goalForm.inflationRate || 3,
        lifeExpectancy: goalForm.lifeExpectancy || 85,
      };

      await saveRetirementGoal(newGoal);
      await loadData();
      setShowGoalModal(false);
    } catch (error) {
      console.error("Failed to save goal:", error);
    }
  }

  async function handleDeleteAccount(accountId: string) {
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      await deleteRetirementAccount(accountId);
      await loadData();
    } catch (error) {
      console.error("Failed to delete account:", error);
    }
  }

  function resetAccountForm() {
    setAccountForm({
      type: "401k",
      contributionFrequency: "monthly",
      returnRate: 7,
    });
  }

  if (loading) {
    return (
      <ScreenContainer className="p-6 items-center justify-center">
        <Text className="text-lg text-foreground">Loading retirement plan...</Text>
      </ScreenContainer>
    );
  }

  const totalBalance = calculateTotalBalance(accounts);
  const screenWidth = Dimensions.get("window").width;

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Retirement Planning</Text>
            <Text className="text-sm text-muted">Plan your financial future</Text>
          </View>

          {/* Total Balance Card */}
          <View className="bg-primary rounded-2xl p-6">
            <Text className="text-sm text-white opacity-80 mb-2">Total Retirement Savings</Text>
            <Text className="text-4xl font-bold text-white mb-2">
              ${totalBalance.toLocaleString()}
            </Text>
            {projection && (
              <View className="gap-1">
                <Text className="text-sm text-white opacity-90">
                  Projected at retirement: ${projection.totalSavings.toLocaleString()}
                </Text>
                <Text className="text-sm text-white opacity-90">
                  Monthly income: ${projection.monthlyIncome.toLocaleString()}
                </Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => setShowAddAccountModal(true)}
              className="flex-1 bg-success rounded-xl p-4 items-center"
              style={{ opacity: 0.9 }}
            >
              <Text className="text-white font-semibold">Add Account</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (goal) {
                  setGoalForm(goal);
                }
                setShowGoalModal(true);
              }}
              className="flex-1 bg-primary rounded-xl p-4 items-center"
              style={{ opacity: 0.9 }}
            >
              <Text className="text-white font-semibold">
                {goal ? "Update" : "Set"} Goal
              </Text>
            </TouchableOpacity>
          </View>

          {/* Projection Chart */}
          {projection && projection.projectedBalance.length > 0 && (
            <View className="bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-lg font-semibold text-foreground mb-4">
                Retirement Projection
              </Text>
              <LineChart
                data={{
                  labels: projection.projectedBalance
                    .filter((_, i) => i % 5 === 0)
                    .map((p) => p.age.toString()),
                  datasets: [
                    {
                      data: projection.projectedBalance
                        .filter((_, i) => i % 5 === 0)
                        .map((p) => p.balance),
                      color: (opacity = 1) => colors.primary,
                      strokeWidth: 2,
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
                    r: "4",
                    strokeWidth: "2",
                    stroke: colors.primary,
                  },
                }}
                bezier
                style={{
                  marginVertical: 8,
                  borderRadius: 16,
                }}
                yAxisLabel="$"
                yAxisSuffix=""
              />

              {projection.shortfall > 0 && (
                <View className="bg-warning rounded-xl p-4 mt-4" style={{ opacity: 0.2 }}>
                  <Text className="text-sm font-semibold text-foreground mb-2">
                    ⚠️ Savings Shortfall
                  </Text>
                  <Text className="text-sm text-foreground">
                    You may fall short by ${projection.shortfall.toLocaleString()} annually.
                    Consider increasing monthly contributions to $
                    {projection.recommendedMonthlyContribution.toLocaleString()}.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Withdrawal Strategy */}
          {withdrawalStrategy && goal && (
            <View className="bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-lg font-semibold text-foreground mb-4">
                Withdrawal Strategy
              </Text>

              <View className="gap-3">
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-muted">Strategy</Text>
                  <Text className="text-sm font-medium text-foreground">4% Rule</Text>
                </View>

                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-muted">Monthly Withdrawal</Text>
                  <Text className="text-lg font-bold text-foreground">
                    ${withdrawalStrategy.monthlyAmount.toLocaleString()}
                  </Text>
                </View>

                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-muted">Sustainability</Text>
                  <Text
                    className="text-sm font-semibold"
                    style={{
                      color:
                        withdrawalStrategy.sustainability === "excellent"
                          ? colors.success
                          : withdrawalStrategy.sustainability === "good"
                          ? colors.primary
                          : withdrawalStrategy.sustainability === "fair"
                          ? colors.warning
                          : colors.error,
                    }}
                  >
                    {withdrawalStrategy.sustainability.toUpperCase()}
                  </Text>
                </View>

                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-muted">Years Until Depletion</Text>
                  <Text className="text-sm font-medium text-foreground">
                    {withdrawalStrategy.yearsUntilDepletion.toFixed(0)} years
                  </Text>
                </View>

                <View className="bg-background rounded-xl p-3 mt-2">
                  <Text className="text-xs text-muted">{withdrawalStrategy.taxImplications}</Text>
                </View>

                {goal.currentAge >= 72 && (
                  <View className="bg-warning rounded-xl p-3 mt-2" style={{ opacity: 0.2 }}>
                    <Text className="text-xs font-semibold text-foreground mb-1">
                      Required Minimum Distribution (RMD)
                    </Text>
                    <Text className="text-xs text-foreground">
                      At age {goal.currentAge}, your RMD is approximately $
                      {calculateRMD(totalBalance, goal.currentAge).toLocaleString()} annually.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Accounts List */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Retirement Accounts</Text>
            {accounts.length === 0 ? (
              <View className="bg-surface rounded-2xl p-6 items-center border border-border">
                <Text className="text-muted text-center">No retirement accounts yet</Text>
              </View>
            ) : (
              accounts.map((account) => {
                const annualContribution = calculateAnnualContribution(account);
                return (
                  <View
                    key={account.id}
                    className="bg-surface rounded-2xl p-4 border border-border"
                  >
                    <View className="flex-row items-start justify-between mb-3">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-2xl">{getAccountTypeIcon(account.type)}</Text>
                        <View>
                          <Text className="text-base font-semibold text-foreground">
                            {account.name}
                          </Text>
                          <Text className="text-xs text-muted">
                            {getAccountTypeLabel(account.type)}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-lg font-bold text-success">
                        ${account.balance.toLocaleString()}
                      </Text>
                    </View>

                    <View className="gap-1">
                      <View className="flex-row justify-between">
                        <Text className="text-sm text-muted">Annual Contribution</Text>
                        <Text className="text-sm font-medium text-foreground">
                          ${annualContribution.toLocaleString()}
                        </Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-sm text-muted">Expected Return</Text>
                        <Text className="text-sm font-medium text-foreground">
                          {account.returnRate}%
                        </Text>
                      </View>
                      {account.employerMatch > 0 && (
                        <View className="flex-row justify-between">
                          <Text className="text-sm text-muted">Employer Match</Text>
                          <Text className="text-sm font-medium text-success">
                            {account.employerMatch}% (up to ${account.employerMatchLimit})
                          </Text>
                        </View>
                      )}
                    </View>

                    <TouchableOpacity
                      onPress={() => handleDeleteAccount(account.id)}
                      className="bg-error rounded-lg p-2 items-center mt-3"
                      style={{ opacity: 0.8 }}
                    >
                      <Text className="text-white text-xs font-medium">Delete</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>

          {/* Retirement Goal */}
          {goal && (
            <View className="bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-lg font-semibold text-foreground mb-3">Retirement Goal</Text>
              <View className="gap-2">
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted">Current Age</Text>
                  <Text className="text-sm font-medium text-foreground">{goal.currentAge}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted">Retirement Age</Text>
                  <Text className="text-sm font-medium text-foreground">{goal.retirementAge}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted">Current Income</Text>
                  <Text className="text-sm font-medium text-foreground">
                    ${goal.currentIncome.toLocaleString()}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted">Desired Income Replacement</Text>
                  <Text className="text-sm font-medium text-foreground">
                    {goal.desiredIncomeReplacement}%
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted">Life Expectancy</Text>
                  <Text className="text-sm font-medium text-foreground">
                    {goal.lifeExpectancy} years
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Account Modal */}
      <Modal visible={showAddAccountModal} animationType="slide" transparent>
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View className="bg-background rounded-t-3xl p-6" style={{ maxHeight: "80%" }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-4">
                <Text className="text-2xl font-bold text-foreground">Add Retirement Account</Text>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Account Name</Text>
                  <TextInput
                    value={accountForm.name}
                    onChangeText={(text) => setAccountForm({ ...accountForm, name: text })}
                    placeholder="My 401(k)"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Account Type</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {(["401k", "ira_traditional", "ira_roth"] as const).map((type) => (
                      <TouchableOpacity
                        key={type}
                        onPress={() => setAccountForm({ ...accountForm, type })}
                        className="px-4 py-2 rounded-full border"
                        style={{
                          backgroundColor:
                            accountForm.type === type ? colors.primary : colors.surface,
                          borderColor: accountForm.type === type ? colors.primary : colors.border,
                        }}
                      >
                        <Text
                          className="text-sm font-medium"
                          style={{
                            color: accountForm.type === type ? "#FFFFFF" : colors.foreground,
                          }}
                        >
                          {getAccountTypeLabel(type)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Current Balance ($)</Text>
                  <TextInput
                    value={accountForm.balance?.toString()}
                    onChangeText={(text) =>
                      setAccountForm({ ...accountForm, balance: parseFloat(text) || 0 })
                    }
                    placeholder="50000"
                    keyboardType="numeric"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">
                    Contribution Amount ($)
                  </Text>
                  <TextInput
                    value={accountForm.contributionAmount?.toString()}
                    onChangeText={(text) =>
                      setAccountForm({ ...accountForm, contributionAmount: parseFloat(text) || 0 })
                    }
                    placeholder="500"
                    keyboardType="numeric"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Employer Match (%)</Text>
                  <TextInput
                    value={accountForm.employerMatch?.toString()}
                    onChangeText={(text) =>
                      setAccountForm({ ...accountForm, employerMatch: parseFloat(text) || 0 })
                    }
                    placeholder="50"
                    keyboardType="numeric"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Match Limit ($)</Text>
                  <TextInput
                    value={accountForm.employerMatchLimit?.toString()}
                    onChangeText={(text) =>
                      setAccountForm({ ...accountForm, employerMatchLimit: parseFloat(text) || 0 })
                    }
                    placeholder="3000"
                    keyboardType="numeric"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="flex-row gap-3 mt-4">
                  <TouchableOpacity
                    onPress={() => {
                      setShowAddAccountModal(false);
                      resetAccountForm();
                    }}
                    className="flex-1 bg-surface rounded-xl p-4 items-center border border-border"
                  >
                    <Text className="text-foreground font-semibold">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleAddAccount}
                    className="flex-1 bg-success rounded-xl p-4 items-center"
                  >
                    <Text className="text-white font-semibold">Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Goal Modal */}
      <Modal visible={showGoalModal} animationType="slide" transparent>
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View className="bg-background rounded-t-3xl p-6" style={{ maxHeight: "80%" }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-4">
                <Text className="text-2xl font-bold text-foreground">Set Retirement Goal</Text>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Current Age</Text>
                  <TextInput
                    value={goalForm.currentAge?.toString()}
                    onChangeText={(text) =>
                      setGoalForm({ ...goalForm, currentAge: parseInt(text) || 0 })
                    }
                    placeholder="30"
                    keyboardType="numeric"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Retirement Age</Text>
                  <TextInput
                    value={goalForm.retirementAge?.toString()}
                    onChangeText={(text) =>
                      setGoalForm({ ...goalForm, retirementAge: parseInt(text) || 0 })
                    }
                    placeholder="65"
                    keyboardType="numeric"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Current Income ($)</Text>
                  <TextInput
                    value={goalForm.currentIncome?.toString()}
                    onChangeText={(text) =>
                      setGoalForm({ ...goalForm, currentIncome: parseFloat(text) || 0 })
                    }
                    placeholder="50000"
                    keyboardType="numeric"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">
                    Desired Income Replacement (%)
                  </Text>
                  <TextInput
                    value={goalForm.desiredIncomeReplacement?.toString()}
                    onChangeText={(text) =>
                      setGoalForm({ ...goalForm, desiredIncomeReplacement: parseInt(text) || 0 })
                    }
                    placeholder="80"
                    keyboardType="numeric"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="flex-row gap-3 mt-4">
                  <TouchableOpacity
                    onPress={() => setShowGoalModal(false)}
                    className="flex-1 bg-surface rounded-xl p-4 items-center border border-border"
                  >
                    <Text className="text-foreground font-semibold">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSaveGoal}
                    className="flex-1 bg-primary rounded-xl p-4 items-center"
                  >
                    <Text className="text-white font-semibold">Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
