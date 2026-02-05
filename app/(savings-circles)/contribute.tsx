import { ScrollView, Text, View, TouchableOpacity, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useRouter } from "expo-router";

export default function Contribute() {
  const colors = useColors();
  const router = useRouter();

  const handlePayment = () => {
    Alert.alert("Success", "Contribution recorded!", [{ text: "OK", onPress: () => router.back() }]);
  };

  return (
    <ScreenContainer className="p-0">
      <View className="px-6 pt-4 pb-3" style={{ backgroundColor: colors.background }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary }}>← Back</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold mt-2" style={{ color: colors.foreground }}>Make Contribution</Text>
      </View>

      <ScrollView className="flex-1 px-6">
        <View className="p-4 rounded-xl mb-4" style={{ backgroundColor: colors.surface }}>
          <Text className="text-sm mb-2" style={{ color: colors.muted }}>Amount Due</Text>
          <Text className="text-3xl font-bold" style={{ color: colors.foreground }}>₦10,000</Text>
        </View>

        <Text className="text-base font-semibold mb-3" style={{ color: colors.foreground }}>Payment Method</Text>
        {["Card", "Bank Transfer", "Wallet"].map((method) => (
          <TouchableOpacity
            key={method}
            onPress={handlePayment}
            className="p-4 rounded-xl mb-2"
            style={{ backgroundColor: colors.surface }}
          >
            <Text className="font-semibold" style={{ color: colors.foreground }}>{method}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}
