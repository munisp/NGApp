import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useRouter } from "expo-router";

export default function Members() {
  const colors = useColors();
  const router = useRouter();

  const members = [
    { user_id: "USER001", full_name: "John Doe", role: "admin", has_received_payout: true },
    { user_id: "USER002", full_name: "You", role: "member", has_received_payout: false },
    { user_id: "USER003", full_name: "Jane Smith", role: "member", has_received_payout: false },
  ];

  return (
    <ScreenContainer className="p-0">
      <View className="px-6 pt-4 pb-3" style={{ backgroundColor: colors.background }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary }}>← Back</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold mt-2" style={{ color: colors.foreground }}>Members</Text>
      </View>

      <ScrollView className="flex-1 px-6">
        {members.map((member) => (
          <View key={member.user_id} className="p-4 rounded-xl mb-2" style={{ backgroundColor: colors.surface }}>
            <View className="flex-row justify-between items-center">
              <View>
                <Text className="font-semibold" style={{ color: colors.foreground }}>{member.full_name}</Text>
                <Text className="text-xs mt-1" style={{ color: colors.muted }}>{member.role}</Text>
              </View>
              {member.has_received_payout && (
                <View className="px-3 py-1 rounded-full" style={{ backgroundColor: "#22C55E20" }}>
                  <Text className="text-xs font-semibold" style={{ color: "#22C55E" }}>Paid Out</Text>
                </View>
              )}
            </View>
          </View>
        ))}
        <TouchableOpacity className="py-4 rounded-full mt-4" style={{ backgroundColor: colors.primary }}>
          <Text className="text-center font-semibold" style={{ color: "#FFF" }}>Invite Member</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
