import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
export default function DigitalIdentityScreen() {
  return (
    <ScreenContainer className="p-6">
      <ScrollView>
        <Text className="text-2xl font-bold text-foreground mb-4">Digital Identity</Text>
        <View className="bg-surface p-4 rounded-lg mb-4">
          <Text className="text-lg font-semibold">Account Tier: Gold</Text>
          <Text className="text-muted">Daily Limit: ₦1,000,000</Text>
        </View>
        <TouchableOpacity className="bg-primary p-4 rounded-lg">
          <Text className="text-background text-center font-semibold">Upgrade Tier</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
