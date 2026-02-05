import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useRouter } from "expo-router";

export default function PayoutSchedule() {
  const colors = useColors();
  const router = useRouter();

  const schedule = [
    { round: 1, member: "John Doe", status: "completed", amount: 80000 },
    { round: 2, member: "You", status: "upcoming", amount: 80000 },
    { round: 3, member: "Jane Smith", status: "pending", amount: 80000 },
  ];

  return (
    <ScreenContainer className="p-0">
      <View className="px-6 pt-4 pb-3" style={{ backgroundColor: colors.background }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary }}>← Back</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold mt-2" style={{ color: colors.foreground }}>Payout Schedule</Text>
      </View>

      <ScrollView className="flex-1 px-6">
        {schedule.map((item) => (
          <View key={item.round} className="p-4 rounded-xl mb-3" style={{ backgroundColor: colors.surface }}>
            <View className="flex-row justify-between items-center">
              <View>
                <Text className="font-semibold" style={{ color: colors.foreground }}>Round {item.round}</Text>
                <Text className="text-sm mt-1" style={{ color: colors.muted }}>{item.member}</Text>
              </View>
              <View className="items-end">
                <Text className="font-bold" style={{ color: colors.foreground }}>₦{item.amount.toLocaleString()}</Text>
                <View className="px-2 py-1 rounded mt-1" style={{ backgroundColor: item.status === "completed" ? "#22C55E20" : "#EF444420" }}>
                  <Text className="text-xs capitalize" style={{ color: item.status === "completed" ? "#22C55E" : "#EF4444" }}>
                    {item.status}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}
