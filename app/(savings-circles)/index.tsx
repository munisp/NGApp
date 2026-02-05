import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useRouter } from "expo-router";

export default function SavingsCirclesDashboard() {
  const colors = useColors();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"my-circles" | "discover">("my-circles");

  const myCircles = [
    { circle_id: "CIR-001", circle_name: "Family Savings", contribution_amount: 10000, frequency: "monthly", current_members: 8, total_members: 10, status: "active", next_payout: "John Doe" },
    { circle_id: "CIR-002", circle_name: "Office Ajo", contribution_amount: 5000, frequency: "weekly", current_members: 12, total_members: 12, status: "active", next_payout: "You" },
  ];

  const discoverCircles = [
    { circle_id: "CIR-003", circle_name: "Business Owners", contribution_amount: 50000, frequency: "monthly", current_members: 6, total_members: 10, status: "recruiting" },
    { circle_id: "CIR-004", circle_name: "Young Professionals", contribution_amount: 15000, frequency: "monthly", current_members: 8, total_members: 12, status: "recruiting" },
  ];

  return (
    <ScreenContainer className="p-6">
      <Text className="text-2xl font-bold mb-4" style={{ color: colors.foreground }}>Savings Circles</Text>
      
      <View className="flex-row gap-2 mb-4">
        {(["my-circles", "discover"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            className="flex-1 py-3 rounded-lg items-center"
            style={{ backgroundColor: activeTab === tab ? colors.primary : colors.surface }}
          >
            <Text className="font-semibold capitalize" style={{ color: activeTab === tab ? "#FFF" : colors.foreground }}>
              {tab.replace("-", " ")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView>
        {activeTab === "my-circles" && (
          <>
            {myCircles.map((circle) => (
              <TouchableOpacity
                key={circle.circle_id}
                onPress={() => router.push(`/(savings-circles)/circle-details?id=${circle.circle_id}`)}
                className="p-4 rounded-xl mb-3"
                style={{ backgroundColor: colors.surface }}
              >
                <View className="flex-row justify-between items-start mb-2">
                  <View className="flex-1">
                    <Text className="text-lg font-bold" style={{ color: colors.foreground }}>{circle.circle_name}</Text>
                    <Text className="text-sm mt-1" style={{ color: colors.muted }}>
                      ₦{circle.contribution_amount.toLocaleString()} · {circle.frequency}
                    </Text>
                  </View>
                  <View className="px-3 py-1 rounded-full" style={{ backgroundColor: colors.primary + "20" }}>
                    <Text className="text-xs font-semibold" style={{ color: colors.primary }}>{circle.status}</Text>
                  </View>
                </View>
                <View className="flex-row justify-between mt-2">
                  <Text style={{ color: colors.muted }}>{circle.current_members}/{circle.total_members} members</Text>
                  <Text style={{ color: colors.foreground }}>Next: {circle.next_payout}</Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => router.push("/(savings-circles)/create-circle")}
              className="py-4 rounded-full mt-4"
              style={{ backgroundColor: colors.primary }}
            >
              <Text className="text-center font-semibold" style={{ color: "#FFF" }}>Create Circle</Text>
            </TouchableOpacity>
          </>
        )}

        {activeTab === "discover" && (
          <>
            {discoverCircles.map((circle) => (
              <TouchableOpacity
                key={circle.circle_id}
                onPress={() => router.push(`/(savings-circles)/circle-details?id=${circle.circle_id}`)}
                className="p-4 rounded-xl mb-3"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-lg font-bold" style={{ color: colors.foreground }}>{circle.circle_name}</Text>
                <Text className="text-sm mt-1" style={{ color: colors.muted }}>
                  ₦{circle.contribution_amount.toLocaleString()} · {circle.frequency}
                </Text>
                <View className="flex-row justify-between items-center mt-2">
                  <Text style={{ color: colors.muted }}>{circle.current_members}/{circle.total_members} members</Text>
                  <TouchableOpacity className="px-4 py-2 rounded-full" style={{ backgroundColor: colors.primary }}>
                    <Text className="text-xs font-semibold" style={{ color: "#FFF" }}>Join</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
