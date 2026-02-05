import { View, Text, ScrollView } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
export default function SolarATMsScreen() {
  return (
    <ScreenContainer className="p-6">
      <ScrollView>
        <Text className="text-2xl font-bold text-foreground mb-4">Solar ATMs</Text>
        <View className="bg-surface p-4 rounded-lg">
          <Text className="text-muted">Feature 16 implementation</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
