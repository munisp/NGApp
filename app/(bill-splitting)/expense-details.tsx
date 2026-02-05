import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useRouter } from "expo-router";

export default function ExpenseDetails() {
  const colors = useColors();
  const router = useRouter();

  const expense = {
    expense_id: "EXP-001",
    title: "Dinner at Restaurant",
    total_amount: 12000,
    paid_by: "John Doe",
    category: "Food",
    expense_date: "2024-01-20",
    is_settled: false,
    splits: [
      { user_id: "USER001", full_name: "John Doe", split_amount: 4000, is_paid: true },
      { user_id: "USER002", full_name: "Jane Smith", split_amount: 4000, is_paid: false },
      { user_id: "USER003", full_name: "Bob Johnson", split_amount: 4000, is_paid: false },
    ],
  };

  return (
    <ScreenContainer className="p-0">
      <View className="px-6 pt-4 pb-3" style={{ backgroundColor: colors.background }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary }}>← Back</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold mt-2" style={{ color: colors.foreground }}>{expense.title}</Text>
      </View>

      <ScrollView className="flex-1 px-6">
        <View className="p-4 rounded-xl mb-4" style={{ backgroundColor: colors.surface }}>
          <Text className="text-sm mb-2" style={{ color: colors.muted }}>Total Amount</Text>
          <Text className="text-3xl font-bold" style={{ color: colors.foreground }}>₦{expense.total_amount.toLocaleString()}</Text>
          <View className="flex-row justify-between mt-3">
            <Text style={{ color: colors.muted }}>Paid by: {expense.paid_by}</Text>
            <Text style={{ color: colors.muted }}>{expense.expense_date}</Text>
          </View>
        </View>

        <Text className="text-base font-semibold mb-3" style={{ color: colors.foreground }}>Split Details</Text>
        {expense.splits.map((split) => (
          <View key={split.user_id} className="p-4 rounded-xl mb-2" style={{ backgroundColor: colors.surface }}>
            <View className="flex-row justify-between items-center">
              <View>
                <Text className="font-semibold" style={{ color: colors.foreground }}>{split.full_name}</Text>
                <Text className="text-sm mt-1" style={{ color: colors.muted }}>₦{split.split_amount.toLocaleString()}</Text>
              </View>
              <View className="px-3 py-1 rounded-full" style={{ backgroundColor: split.is_paid ? "#22C55E20" : "#EF444420" }}>
                <Text className="text-xs font-semibold" style={{ color: split.is_paid ? "#22C55E" : "#EF4444" }}>
                  {split.is_paid ? "Paid" : "Pending"}
                </Text>
              </View>
            </View>
          </View>
        ))}

        <View className="h-32" />
      </ScrollView>

      {!expense.is_settled && (
        <View className="px-6 py-4" style={{ backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
          <TouchableOpacity className="py-4 rounded-full mb-2" style={{ backgroundColor: colors.primary }}>
            <Text className="text-center font-semibold" style={{ color: "#FFF" }}>Mark as Settled</Text>
          </TouchableOpacity>
          <TouchableOpacity className="py-4 rounded-full" style={{ backgroundColor: colors.surface }}>
            <Text className="text-center font-semibold" style={{ color: colors.foreground }}>Send Reminder</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScreenContainer>
  );
}
