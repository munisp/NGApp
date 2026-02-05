import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useRouter } from "expo-router";

export default function LenderPortfolio() {
  const colors = useColors();
  const router = useRouter();

  const portfolio = {
    total_invested: 250000,
    total_returned: 85000,
    total_interest_earned: 15000,
    active_investments: 5,
    completed_investments: 3,
    defaulted_investments: 0,
    portfolio_value: 280000,
    roi_percentage: 12.0,
  };

  const investments = [
    { loan_id: "LOAN-001", borrower: "Adewale O.", amount: 50000, expected: 56250, received: 18750, progress: 33, status: "active" },
    { loan_id: "LOAN-002", borrower: "Chioma N.", amount: 40000, expected: 45000, received: 15000, progress: 33, status: "active" },
    { loan_id: "LOAN-003", borrower: "Ibrahim Y.", amount: 30000, expected: 33750, received: 33750, progress: 100, status: "completed" },
  ];

  return (
    <ScreenContainer className="p-0">
      <View className="px-6 pt-4 pb-3" style={{ backgroundColor: colors.background }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary }}>← Back</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold mt-2" style={{ color: colors.foreground }}>Lender Portfolio</Text>
      </View>

      <ScrollView className="flex-1 px-6">
        {/* Summary Cards */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 p-4 rounded-xl" style={{ backgroundColor: colors.surface }}>
            <Text className="text-xs mb-1" style={{ color: colors.muted }}>Total Invested</Text>
            <Text className="text-xl font-bold" style={{ color: colors.foreground }}>₦{portfolio.total_invested.toLocaleString()}</Text>
          </View>
          <View className="flex-1 p-4 rounded-xl" style={{ backgroundColor: colors.surface }}>
            <Text className="text-xs mb-1" style={{ color: colors.muted }}>Total Returns</Text>
            <Text className="text-xl font-bold" style={{ color: colors.primary }}>₦{portfolio.total_returned.toLocaleString()}</Text>
          </View>
        </View>

        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 p-4 rounded-xl" style={{ backgroundColor: colors.surface }}>
            <Text className="text-xs mb-1" style={{ color: colors.muted }}>Interest Earned</Text>
            <Text className="text-xl font-bold" style={{ color: "#22C55E" }}>₦{portfolio.total_interest_earned.toLocaleString()}</Text>
          </View>
          <View className="flex-1 p-4 rounded-xl" style={{ backgroundColor: colors.surface }}>
            <Text className="text-xs mb-1" style={{ color: colors.muted }}>ROI</Text>
            <Text className="text-xl font-bold" style={{ color: colors.primary }}>{portfolio.roi_percentage}%</Text>
          </View>
        </View>

        {/* Performance Metrics */}
        <View className="p-4 rounded-xl mb-4" style={{ backgroundColor: colors.surface }}>
          <Text className="text-base font-semibold mb-3" style={{ color: colors.foreground }}>Performance</Text>
          <View className="flex-row justify-between mb-2">
            <Text style={{ color: colors.muted }}>Active Investments</Text>
            <Text className="font-bold" style={{ color: colors.foreground }}>{portfolio.active_investments}</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text style={{ color: colors.muted }}>Completed</Text>
            <Text className="font-bold" style={{ color: colors.foreground }}>{portfolio.completed_investments}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text style={{ color: colors.muted }}>Defaults</Text>
            <Text className="font-bold" style={{ color: portfolio.defaulted_investments > 0 ? "#EF4444" : "#22C55E" }}>{portfolio.defaulted_investments}</Text>
          </View>
        </View>

        {/* Investments List */}
        <Text className="text-base font-semibold mb-3" style={{ color: colors.foreground }}>Your Investments</Text>

        {investments.map((inv) => (
          <TouchableOpacity
            key={inv.loan_id}
            onPress={() => router.push(`/(p2p-lending)/loan-details?id=${inv.loan_id}`)}
            className="p-4 rounded-xl mb-3"
            style={{ backgroundColor: colors.surface }}
          >
            <View className="flex-row justify-between items-start mb-3">
              <View>
                <Text className="text-base font-bold" style={{ color: colors.foreground }}>{inv.borrower}</Text>
                <Text className="text-xs mt-1" style={{ color: colors.muted }}>{inv.loan_id}</Text>
              </View>
              <View className="px-3 py-1 rounded-full" style={{ backgroundColor: inv.status === "completed" ? "#22C55E20" : colors.primary + "20" }}>
                <Text className="text-xs font-semibold capitalize" style={{ color: inv.status === "completed" ? "#22C55E" : colors.primary }}>{inv.status}</Text>
              </View>
            </View>

            <View className="flex-row justify-between mb-3">
              <View>
                <Text className="text-xs" style={{ color: colors.muted }}>Invested</Text>
                <Text className="text-base font-bold" style={{ color: colors.foreground }}>₦{inv.amount.toLocaleString()}</Text>
              </View>
              <View>
                <Text className="text-xs" style={{ color: colors.muted }}>Expected</Text>
                <Text className="text-base font-bold" style={{ color: colors.primary }}>₦{inv.expected.toLocaleString()}</Text>
              </View>
              <View>
                <Text className="text-xs" style={{ color: colors.muted }}>Received</Text>
                <Text className="text-base font-bold" style={{ color: colors.foreground }}>₦{inv.received.toLocaleString()}</Text>
              </View>
            </View>

            <View>
              <View className="flex-row justify-between mb-1">
                <Text className="text-xs" style={{ color: colors.muted }}>Return Progress</Text>
                <Text className="text-xs font-semibold" style={{ color: colors.foreground }}>{inv.progress}%</Text>
              </View>
              <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
                <View className="h-full rounded-full" style={{ width: `${inv.progress}%`, backgroundColor: colors.primary }} />
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <View className="h-24" />
      </ScrollView>
    </ScreenContainer>
  );
}
