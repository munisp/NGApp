import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useRouter } from "expo-router";

export default function BillSplittingDashboard() {
  const colors = useColors();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"groups" | "balances">("groups");

  const groups = [
    { group_id: "GRP-001", group_name: "Roommates", member_count: 4, expense_count: 12, balance: -5000 },
    { group_id: "GRP-002", group_name: "Office Lunch", member_count: 8, expense_count: 25, balance: 3500 },
  ];

  const balances = {
    total_owed_to_me: 8500,
    total_i_owe: 5000,
    net_balance: 3500,
  };

  return (
    <ScreenContainer className="p-6">
      <Text className="text-2xl font-bold mb-4" style={{ color: colors.foreground }}>Bill Splitting</Text>
      
      <View className="flex-row gap-2 mb-4">
        {(["groups", "balances"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            className="flex-1 py-3 rounded-lg items-center"
            style={{ backgroundColor: activeTab === tab ? colors.primary : colors.surface }}
          >
            <Text className="font-semibold capitalize" style={{ color: activeTab === tab ? "#FFF" : colors.foreground }}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView>
        {activeTab === "groups" && (
          <>
            {groups.map((group) => (
              <TouchableOpacity
                key={group.group_id}
                onPress={() => router.push(`/(bill-splitting)/group-details?id=${group.group_id}`)}
                className="p-4 rounded-xl mb-3"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-lg font-bold" style={{ color: colors.foreground }}>{group.group_name}</Text>
                <View className="flex-row justify-between mt-2">
                  <Text style={{ color: colors.muted }}>{group.member_count} members</Text>
                  <Text style={{ color: colors.muted }}>{group.expense_count} expenses</Text>
                  <Text className="font-bold" style={{ color: group.balance >= 0 ? "#22C55E" : "#EF4444" }}>
                    {group.balance >= 0 ? "+" : ""}₦{Math.abs(group.balance).toLocaleString()}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => router.push("/(bill-splitting)/create-group")}
              className="py-4 rounded-full mt-4"
              style={{ backgroundColor: colors.primary }}
            >
              <Text className="text-center font-semibold" style={{ color: "#FFF" }}>Create Group</Text>
            </TouchableOpacity>
          </>
        )}

        {activeTab === "balances" && (
          <>
            <View className="p-4 rounded-xl mb-3" style={{ backgroundColor: colors.surface }}>
              <Text className="text-sm mb-2" style={{ color: colors.muted }}>You are owed</Text>
              <Text className="text-3xl font-bold" style={{ color: "#22C55E" }}>₦{balances.total_owed_to_me.toLocaleString()}</Text>
            </View>
            <View className="p-4 rounded-xl mb-3" style={{ backgroundColor: colors.surface }}>
              <Text className="text-sm mb-2" style={{ color: colors.muted }}>You owe</Text>
              <Text className="text-3xl font-bold" style={{ color: "#EF4444" }}>₦{balances.total_i_owe.toLocaleString()}</Text>
            </View>
            <View className="p-4 rounded-xl" style={{ backgroundColor: colors.primary + "10" }}>
              <Text className="text-sm mb-2" style={{ color: colors.muted }}>Net Balance</Text>
              <Text className="text-3xl font-bold" style={{ color: colors.primary }}>
                {balances.net_balance >= 0 ? "+" : ""}₦{Math.abs(balances.net_balance).toLocaleString()}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
