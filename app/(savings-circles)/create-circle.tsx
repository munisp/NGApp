import { ScrollView, Text, View, TouchableOpacity, TextInput, Alert } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useRouter } from "expo-router";

export default function CreateCircle() {
  const colors = useColors();
  const router = useRouter();
  const [circleName, setCircleName] = useState("");
  const [contributionAmount, setContributionAmount] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("monthly");
  const [totalMembers, setTotalMembers] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<"sequential" | "random" | "auction">("sequential");

  const handleSubmit = () => {
    if (!circleName || !contributionAmount || !totalMembers) {
      Alert.alert("Error", "Please fill all required fields");
      return;
    }
    Alert.alert("Success", "Circle created! Invite members to join.", [
      { text: "OK", onPress: () => router.back() }
    ]);
  };

  return (
    <ScreenContainer className="p-0">
      <View className="px-6 pt-4 pb-3" style={{ backgroundColor: colors.background }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary }}>← Back</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold mt-2" style={{ color: colors.foreground }}>Create Circle</Text>
      </View>

      <ScrollView className="flex-1 px-6">
        <View className="mb-4">
          <Text className="mb-2" style={{ color: colors.foreground }}>Circle Name *</Text>
          <TextInput
            value={circleName}
            onChangeText={setCircleName}
            placeholder="e.g., Family Savings"
            className="px-4 py-3 rounded-lg"
            style={{ backgroundColor: colors.surface, color: colors.foreground, borderWidth: 1, borderColor: colors.border }}
            placeholderTextColor={colors.muted}
          />
        </View>

        <View className="mb-4">
          <Text className="mb-2" style={{ color: colors.foreground }}>Contribution Amount *</Text>
          <TextInput
            value={contributionAmount}
            onChangeText={setContributionAmount}
            keyboardType="numeric"
            placeholder="10000"
            className="px-4 py-3 rounded-lg"
            style={{ backgroundColor: colors.surface, color: colors.foreground, borderWidth: 1, borderColor: colors.border }}
            placeholderTextColor={colors.muted}
          />
        </View>

        <View className="mb-4">
          <Text className="mb-2" style={{ color: colors.foreground }}>Frequency *</Text>
          <View className="flex-row gap-2">
            {(["daily", "weekly", "monthly"] as const).map((freq) => (
              <TouchableOpacity
                key={freq}
                onPress={() => setFrequency(freq)}
                className="flex-1 py-3 rounded-lg items-center"
                style={{ backgroundColor: frequency === freq ? colors.primary : colors.surface }}
              >
                <Text className="capitalize" style={{ color: frequency === freq ? "#FFF" : colors.foreground }}>
                  {freq}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="mb-4">
          <Text className="mb-2" style={{ color: colors.foreground }}>Total Members *</Text>
          <TextInput
            value={totalMembers}
            onChangeText={setTotalMembers}
            keyboardType="numeric"
            placeholder="10"
            className="px-4 py-3 rounded-lg"
            style={{ backgroundColor: colors.surface, color: colors.foreground, borderWidth: 1, borderColor: colors.border }}
            placeholderTextColor={colors.muted}
          />
        </View>

        <View className="mb-4">
          <Text className="mb-2" style={{ color: colors.foreground }}>Payout Method *</Text>
          <View className="gap-2">
            {(["sequential", "random", "auction"] as const).map((method) => (
              <TouchableOpacity
                key={method}
                onPress={() => setPayoutMethod(method)}
                className="p-4 rounded-lg flex-row items-center"
                style={{ backgroundColor: payoutMethod === method ? colors.primary + "20" : colors.surface, borderWidth: 2, borderColor: payoutMethod === method ? colors.primary : "transparent" }}
              >
                <View className="flex-1">
                  <Text className="font-semibold capitalize" style={{ color: colors.foreground }}>{method}</Text>
                  <Text className="text-xs mt-1" style={{ color: colors.muted }}>
                    {method === "sequential" && "Members receive payout in join order"}
                    {method === "random" && "Random selection each round"}
                    {method === "auction" && "Members bid for early payout"}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="h-32" />
      </ScrollView>

      <View className="px-6 py-4" style={{ backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
        <TouchableOpacity onPress={handleSubmit} className="py-4 rounded-full" style={{ backgroundColor: colors.primary }}>
          <Text className="text-center font-semibold" style={{ color: "#FFF" }}>Create Circle</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}
