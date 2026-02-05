import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useRouter } from "expo-router";

export default function GroupDetails() {
  const colors = useColors();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"members" | "expenses" | "balances">("members");

  const members = [
    { user_id: "USER001", full_name: "John Doe", role: "admin", balance: 5000 },
    { user_id: "USER002", full_name: "Jane Smith", role: "member", balance: -3000 },
    { user_id: "USER003", full_name: "Bob Johnson", role: "member", balance: -2000 },
  ];

  const expenses = [
    { expense_id: "EXP-001", title: "Dinner", amount: 12000, paid_by: "John", is_settled: false },
    { expense_id: "EXP-002", title: "Groceries", amount: 8000, paid_by: "Jane", is_settled: true },
  ];

  return (
    <ScreenContainer className="p-0">
      <View className="px-6 pt-4 pb-3" style={{ backgroundColor: colors.background }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary }}>← Back</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold mt-2" style={{ color: colors.foreground }}>Roommates</Text>
        <Text style={{ color: colors.muted }}>{members.length} members</Text>
      </View>

      <View className="px-6 mb-4">
        <View className="flex-row gap-2">
          {(["members", "expenses", "balances"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className="flex-1 py-2 rounded-lg items-center"
              style={{ backgroundColor: activeTab === tab ? colors.primary : colors.surface }}
            >
              <Text className="text-xs font-semibold capitalize" style={{ color: activeTab === tab ? "#FFF" : colors.foreground }}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView className="flex-1 px-6">
        {activeTab === "members" && (
          <>
            {members.map((member) => (
              <View key={member.user_id} className="flex-row justify-between items-center p-4 rounded-xl mb-2" style={{ backgroundColor: colors.surface }}>
                <View>
                  <Text className="font-semibold" style={{ color: colors.foreground }}>{member.full_name}</Text>
                  <Text className="text-xs mt-1" style={{ color: colors.muted }}>{member.role}</Text>
                </View>
                <Text className="font-bold" style={{ color: member.balance >= 0 ? "#22C55E" : "#EF4444" }}>
                  {member.balance >= 0 ? "+" : ""}₦{Math.abs(member.balance).toLocaleString()}
                </Text>
              </View>
            ))}
            <TouchableOpacity className="py-4 rounded-full mt-4" style={{ backgroundColor: colors.primary }}>
              <Text className="text-center font-semibold" style={{ color: "#FFF" }}>Add Member</Text>
            </TouchableOpacity>
          </>
        )}

        {activeTab === "expenses" && (
          <>
            {expenses.map((expense) => (
              <TouchableOpacity
                key={expense.expense_id}
                onPress={() => router.push("/(bill-splitting)/expense-details")}
                className="p-4 rounded-xl mb-2"
                style={{ backgroundColor: colors.surface }}
              >
                <View className="flex-row justify-between items-center">
                  <View>
                    <Text className="font-semibold" style={{ color: colors.foreground }}>{expense.title}</Text>
                    <Text className="text-sm mt-1" style={{ color: colors.muted }}>Paid by {expense.paid_by}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="font-bold" style={{ color: colors.foreground }}>₦{expense.amount.toLocaleString()}</Text>
                    <View className="px-2 py-1 rounded mt-1" style={{ backgroundColor: expense.is_settled ? "#22C55E20" : "#EF444420" }}>
                      <Text className="text-xs" style={{ color: expense.is_settled ? "#22C55E" : "#EF4444" }}>
                        {expense.is_settled ? "Settled" : "Pending"}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {activeTab === "balances" && (
          <>
            <View className="p-4 rounded-xl mb-3" style={{ backgroundColor: colors.surface }}>
              <Text className="text-sm mb-2" style={{ color: colors.muted }}>Simplified Settlements</Text>
              <Text className="text-base" style={{ color: colors.foreground }}>Jane pays John: ₦3,000</Text>
              <Text className="text-base mt-1" style={{ color: colors.foreground }}>Bob pays John: ₦2,000</Text>
            </View>
            <TouchableOpacity className="py-4 rounded-full" style={{ backgroundColor: colors.primary }}>
              <Text className="text-center font-semibold" style={{ color: "#FFF" }}>View Settlement Plan</Text>
            </TouchableOpacity>
          </>
        )}

        <View className="h-32" />
      </ScrollView>
    </ScreenContainer>
  );
}
