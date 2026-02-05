import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useRouter } from "expo-router";

export default function CircleDetails() {
  const colors = useColors();
  const router = useRouter();
  
  const circle = {
    circle_name: "Family Savings",
    contribution_amount: 10000,
    frequency: "monthly",
    current_members: 8,
    total_members: 10,
    status: "active",
    next_payout: "John Doe",
    total_collected: 80000,
  };

  return (
    <ScreenContainer className="p-0">
      <View className="px-6 pt-4 pb-3" style={{ backgroundColor: colors.background }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary }}>← Back</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold mt-2" style={{ color: colors.foreground }}>{circle.circle_name}</Text>
      </View>

      <ScrollView className="flex-1 px-6">
        <View className="p-4 rounded-xl mb-4" style={{ backgroundColor: colors.surface }}>
          <Text className="text-sm mb-2" style={{ color: colors.muted }}>Total Collected</Text>
          <Text className="text-3xl font-bold" style={{ color: colors.foreground }}>₦{circle.total_collected.toLocaleString()}</Text>
          <View className="flex-row justify-between mt-3">
            <Text style={{ color: colors.muted }}>{circle.current_members}/{circle.total_members} members</Text>
            <Text style={{ color: colors.muted }}>{circle.frequency}</Text>
          </View>
        </View>

        <TouchableOpacity className="py-4 rounded-full mb-2" style={{ backgroundColor: colors.primary }}>
          <Text className="text-center font-semibold" style={{ color: "#FFF" }}>Make Contribution</Text>
        </TouchableOpacity>
        
        <TouchableOpacity className="py-4 rounded-full" style={{ backgroundColor: colors.surface }}>
          <Text className="text-center font-semibold" style={{ color: colors.foreground }}>View Members</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
