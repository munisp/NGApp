import { ScrollView, Text, View, TouchableOpacity, TextInput, Alert } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useRouter } from "expo-router";

export default function CreateExpense() {
  const colors = useColors();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [splitMethod, setSplitMethod] = useState<"equal" | "custom">("equal");

  const members = [
    { user_id: "USER001", full_name: "John Doe", split: 0 },
    { user_id: "USER002", full_name: "Jane Smith", split: 0 },
    { user_id: "USER003", full_name: "Bob Johnson", split: 0 },
  ];

  const handleSubmit = () => {
    if (!title || !amount) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }
    Alert.alert("Success", "Expense created!", [{ text: "OK", onPress: () => router.back() }]);
  };

  return (
    <ScreenContainer className="p-0">
      <View className="px-6 pt-4 pb-3" style={{ backgroundColor: colors.background }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary }}>← Back</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold mt-2" style={{ color: colors.foreground }}>Create Expense</Text>
      </View>

      <ScrollView className="flex-1 px-6">
        <View className="mb-4">
          <Text className="mb-2" style={{ color: colors.foreground }}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Dinner at restaurant"
            className="px-4 py-3 rounded-lg"
            style={{ backgroundColor: colors.surface, color: colors.foreground, borderWidth: 1, borderColor: colors.border }}
            placeholderTextColor={colors.muted}
          />
        </View>

        <View className="mb-4">
          <Text className="mb-2" style={{ color: colors.foreground }}>Amount</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="0"
            className="px-4 py-3 rounded-lg"
            style={{ backgroundColor: colors.surface, color: colors.foreground, borderWidth: 1, borderColor: colors.border }}
            placeholderTextColor={colors.muted}
          />
        </View>

        <View className="mb-4">
          <Text className="mb-2" style={{ color: colors.foreground }}>Split Method</Text>
          <View className="flex-row gap-2">
            {(["equal", "custom"] as const).map((method) => (
              <TouchableOpacity
                key={method}
                onPress={() => setSplitMethod(method)}
                className="flex-1 py-3 rounded-lg items-center"
                style={{ backgroundColor: splitMethod === method ? colors.primary : colors.surface }}
              >
                <Text className="capitalize" style={{ color: splitMethod === method ? "#FFF" : colors.foreground }}>
                  {method}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text className="text-base font-semibold mb-3" style={{ color: colors.foreground }}>Split Between</Text>
        {members.map((member) => (
          <View key={member.user_id} className="flex-row justify-between items-center p-4 rounded-xl mb-2" style={{ backgroundColor: colors.surface }}>
            <Text style={{ color: colors.foreground }}>{member.full_name}</Text>
            <Text className="font-bold" style={{ color: colors.primary }}>
              ₦{splitMethod === "equal" ? (parseFloat(amount) / members.length || 0).toFixed(0) : "0"}
            </Text>
          </View>
        ))}

        <View className="h-32" />
      </ScrollView>

      <View className="px-6 py-4" style={{ backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
        <TouchableOpacity onPress={handleSubmit} className="py-4 rounded-full" style={{ backgroundColor: colors.primary }}>
          <Text className="text-center font-semibold" style={{ color: "#FFF" }}>Create Expense</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}
