import { ScrollView, Text, View, Pressable, TextInput, Alert } from "react-native";
import { useState, useEffect } from "react";
import { LineChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  calculateFinancialHealthScore,
  getCurrentHealthScore,
  getHealthScoreHistory,
  getScoreTrend,
  getImprovementPlan,
  simulateScoreImprovement,
  type FinancialHealthScore,
  type FinancialData,
} from "@/utils/financial-health-score";

const screenWidth = Dimensions.get("window").width;

export default function HealthScoreScreen() {
  const colors = useColors();
  const [score, setScore] = useState<FinancialHealthScore | null>(null);
  const [history, setHistory] = useState<FinancialHealthScore[]>([]);
  const [trend, setTrend] = useState<any>(null);
  const [plan, setPlan] = useState<any[]>([]);
  const [showCalculator, setShowCalculator] = useState(false);
  
  // Financial data inputs
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [monthlyExpenses, setMonthlyExpenses] = useState("");
  const [totalSavings, setTotalSavings] = useState("");
  const [totalDebt, setTotalDebt] = useState("");
  const [monthlyDebtPayments, setMonthlyDebtPayments] = useState("");
  const [budgetedAmount, setBudgetedAmount] = useState("");
  const [actualSpending, setActualSpending] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [creditUsed, setCreditUsed] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [currentScore, scoreHistory, scoreTrend, improvementPlan] = await Promise.all([
      getCurrentHealthScore(),
      getHealthScoreHistory(),
      getScoreTrend(),
      getImprovementPlan(),
    ]);
    
    setScore(currentScore);
    setHistory(scoreHistory);
    setTrend(scoreTrend);
    setPlan(improvementPlan);
    
    if (!currentScore) {
      setShowCalculator(true);
    }
  };

  const handleCalculate = async () => {
    const income = parseFloat(monthlyIncome);
    const expenses = parseFloat(monthlyExpenses);
    const savings = parseFloat(totalSavings);
    const debt = parseFloat(totalDebt);
    const debtPayments = parseFloat(monthlyDebtPayments);
    const budgeted = parseFloat(budgetedAmount);
    const actual = parseFloat(actualSpending);
    const limit = parseFloat(creditLimit);
    const used = parseFloat(creditUsed);
    
    if (isNaN(income) || income <= 0) {
      Alert.alert("Error", "Please enter a valid monthly income");
      return;
    }
    
    const data: FinancialData = {
      monthly_income: income,
      monthly_expenses: isNaN(expenses) ? 0 : expenses,
      total_savings: isNaN(savings) ? 0 : savings,
      total_debt: isNaN(debt) ? 0 : debt,
      monthly_debt_payments: isNaN(debtPayments) ? 0 : debtPayments,
      budgeted_amount: isNaN(budgeted) ? income : budgeted,
      actual_spending: isNaN(actual) ? expenses : actual,
      credit_limit: isNaN(limit) ? 0 : limit,
      credit_used: isNaN(used) ? 0 : used,
    };
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const newScore = await calculateFinancialHealthScore(data);
      setScore(newScore);
      setShowCalculator(false);
      
      await loadData();
      
      Alert.alert(
        "Score Calculated",
        `Your financial health score is ${newScore.overall_score}/100 (${newScore.grade})`
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to calculate score");
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return colors.success;
    if (score >= 70) return "#10B981";
    if (score >= 50) return colors.warning;
    if (score >= 30) return "#F59E0B";
    return colors.error;
  };

  const getGradeEmoji = (grade: string) => {
    switch (grade) {
      case "Excellent": return "🏆";
      case "Good": return "👍";
      case "Fair": return "😐";
      case "Needs Improvement": return "⚠️";
      case "Critical": return "🚨";
      default: return "📊";
    }
  };

  if (showCalculator || !score) {
    return (
      <ScreenContainer className="p-6">
        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="gap-6">
            <View className="gap-2">
              <Text className="text-2xl font-bold text-foreground">
                Calculate Your Financial Health Score
              </Text>
              <Text className="text-sm text-muted">
                Enter your financial information to get a comprehensive health score
              </Text>
            </View>

            <View className="gap-4">
              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">
                  Monthly Income *
                </Text>
                <TextInput
                  value={monthlyIncome}
                  onChangeText={setMonthlyIncome}
                  placeholder="5000"
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

              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">
                  Monthly Expenses
                </Text>
                <TextInput
                  value={monthlyExpenses}
                  onChangeText={setMonthlyExpenses}
                  placeholder="3000"
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

              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">
                  Total Savings
                </Text>
                <TextInput
                  value={totalSavings}
                  onChangeText={setTotalSavings}
                  placeholder="10000"
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

              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">
                  Total Debt
                </Text>
                <TextInput
                  value={totalDebt}
                  onChangeText={setTotalDebt}
                  placeholder="5000"
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

              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">
                  Monthly Debt Payments
                </Text>
                <TextInput
                  value={monthlyDebtPayments}
                  onChangeText={setMonthlyDebtPayments}
                  placeholder="500"
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

              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">
                  Monthly Budget
                </Text>
                <TextInput
                  value={budgetedAmount}
                  onChangeText={setBudgetedAmount}
                  placeholder="4000"
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

              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">
                  Actual Monthly Spending
                </Text>
                <TextInput
                  value={actualSpending}
                  onChangeText={setActualSpending}
                  placeholder="3500"
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

              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">
                  Credit Limit
                </Text>
                <TextInput
                  value={creditLimit}
                  onChangeText={setCreditLimit}
                  placeholder="10000"
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

              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">
                  Credit Used
                </Text>
                <TextInput
                  value={creditUsed}
                  onChangeText={setCreditUsed}
                  placeholder="2000"
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
            </View>

            <Pressable
              onPress={handleCalculate}
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
                Calculate Score
              </Text>
            </Pressable>

            {score && (
              <Pressable onPress={() => setShowCalculator(false)}>
                <Text className="text-center text-muted">Cancel</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          <View className="flex-row items-center justify-between">
            <View className="gap-1">
              <Text className="text-2xl font-bold text-foreground">Financial Health</Text>
              <Text className="text-sm text-muted">Your comprehensive score</Text>
            </View>
            <Pressable
              onPress={() => setShowCalculator(true)}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              className="px-4 py-2 rounded-full border"
            >
              <Text className="text-sm font-semibold text-foreground">Recalculate</Text>
            </Pressable>
          </View>

          {/* Overall Score */}
          <View
            style={{ backgroundColor: colors.surface }}
            className="rounded-3xl p-6 border border-border items-center"
          >
            <Text className="text-6xl mb-2">{getGradeEmoji(score.grade)}</Text>
            <Text
              style={{ color: getScoreColor(score.overall_score) }}
              className="text-5xl font-bold mb-2"
            >
              {score.overall_score}
            </Text>
            <Text className="text-lg font-semibold text-foreground mb-1">
              {score.grade}
            </Text>
            {trend && (
              <Text className="text-sm text-muted">
                {trend.trend === "improving" && "📈 "}
                {trend.trend === "declining" && "📉 "}
                {trend.change > 0 && "+"}
                {trend.change} {trend.period}
              </Text>
            )}
          </View>

          {/* Score Breakdown */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Score Breakdown</Text>
            
            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-foreground">Savings Rate</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {score.breakdown.savings_score}/20
                </Text>
              </View>
              <View className="h-2 bg-surface rounded-full overflow-hidden">
                <View
                  style={{
                    width: `${(score.breakdown.savings_score / 20) * 100}%`,
                    backgroundColor: getScoreColor((score.breakdown.savings_score / 20) * 100),
                  }}
                  className="h-full"
                />
              </View>
              <Text className="text-xs text-muted">
                {score.metrics.savings_rate.toFixed(1)}% of income saved
              </Text>
            </View>

            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-foreground">Debt Management</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {score.breakdown.debt_score}/25
                </Text>
              </View>
              <View className="h-2 bg-surface rounded-full overflow-hidden">
                <View
                  style={{
                    width: `${(score.breakdown.debt_score / 25) * 100}%`,
                    backgroundColor: getScoreColor((score.breakdown.debt_score / 25) * 100),
                  }}
                  className="h-full"
                />
              </View>
              <Text className="text-xs text-muted">
                {score.metrics.debt_to_income_ratio.toFixed(1)}% debt-to-income ratio
              </Text>
            </View>

            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-foreground">Emergency Fund</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {score.breakdown.emergency_fund_score}/25
                </Text>
              </View>
              <View className="h-2 bg-surface rounded-full overflow-hidden">
                <View
                  style={{
                    width: `${(score.breakdown.emergency_fund_score / 25) * 100}%`,
                    backgroundColor: getScoreColor((score.breakdown.emergency_fund_score / 25) * 100),
                  }}
                  className="h-full"
                />
              </View>
              <Text className="text-xs text-muted">
                {score.metrics.emergency_fund_months.toFixed(1)} months of expenses
              </Text>
            </View>

            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-foreground">Budget Adherence</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {score.breakdown.budget_score}/15
                </Text>
              </View>
              <View className="h-2 bg-surface rounded-full overflow-hidden">
                <View
                  style={{
                    width: `${(score.breakdown.budget_score / 15) * 100}%`,
                    backgroundColor: getScoreColor((score.breakdown.budget_score / 15) * 100),
                  }}
                  className="h-full"
                />
              </View>
              <Text className="text-xs text-muted">
                {score.metrics.budget_adherence.toFixed(1)}% adherence
              </Text>
            </View>

            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-foreground">Credit Utilization</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {score.breakdown.credit_score}/15
                </Text>
              </View>
              <View className="h-2 bg-surface rounded-full overflow-hidden">
                <View
                  style={{
                    width: `${(score.breakdown.credit_score / 15) * 100}%`,
                    backgroundColor: getScoreColor((score.breakdown.credit_score / 15) * 100),
                  }}
                  className="h-full"
                />
              </View>
              <Text className="text-xs text-muted">
                {score.metrics.credit_utilization.toFixed(1)}% utilization
              </Text>
            </View>
          </View>

          {/* Score History */}
          {history.length > 1 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">Score History</Text>
              <View style={{ backgroundColor: colors.surface }} className="rounded-2xl p-4 border border-border">
                <LineChart
                  data={{
                    labels: history.map((_, i) => `${i + 1}`),
                    datasets: [{ data: history.map((h) => h.overall_score) }],
                  }}
                  width={screenWidth - 80}
                  height={200}
                  chartConfig={{
                    backgroundColor: colors.surface,
                    backgroundGradientFrom: colors.surface,
                    backgroundGradientTo: colors.surface,
                    decimalPlaces: 0,
                    color: (opacity = 1) => colors.primary,
                    labelColor: (opacity = 1) => colors.muted,
                    style: { borderRadius: 16 },
                    propsForDots: {
                      r: "4",
                      strokeWidth: "2",
                      stroke: colors.primary,
                    },
                  }}
                  bezier
                  style={{ marginLeft: -16 }}
                />
              </View>
            </View>
          )}

          {/* Insights */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Key Insights</Text>
            {score.insights.map((insight, index) => (
              <View
                key={index}
                style={{ backgroundColor: colors.surface }}
                className="rounded-xl p-4 border border-border"
              >
                <Text className="text-sm text-foreground leading-relaxed">{insight}</Text>
              </View>
            ))}
          </View>

          {/* Recommendations */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">
              Top Recommendations
            </Text>
            {score.recommendations.map((rec, index) => (
              <View
                key={index}
                style={{ backgroundColor: colors.surface }}
                className="rounded-xl p-4 border border-border"
              >
                <Text className="text-sm text-foreground leading-relaxed">{rec}</Text>
              </View>
            ))}
          </View>

          {/* Improvement Plan */}
          {plan.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">
                Improvement Plan
              </Text>
              {plan.map((item, index) => (
                <View
                  key={index}
                  style={{ backgroundColor: colors.surface }}
                  className="rounded-xl p-4 border border-border gap-2"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-base font-semibold text-foreground">
                      {item.area}
                    </Text>
                    <View
                      style={{
                        backgroundColor:
                          item.priority === "high"
                            ? colors.error + "20"
                            : item.priority === "medium"
                            ? colors.warning + "20"
                            : colors.success + "20",
                      }}
                      className="px-2 py-1 rounded-full"
                    >
                      <Text
                        style={{
                          color:
                            item.priority === "high"
                              ? colors.error
                              : item.priority === "medium"
                              ? colors.warning
                              : colors.success,
                        }}
                        className="text-xs font-semibold uppercase"
                      >
                        {item.priority}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-sm text-muted">
                    Current: {item.current_score} → Target: {item.target_score}
                  </Text>
                  <View className="gap-1 mt-2">
                    {item.actions.map((action: string, i: number) => (
                      <Text key={i} className="text-sm text-foreground">
                        • {action}
                      </Text>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
