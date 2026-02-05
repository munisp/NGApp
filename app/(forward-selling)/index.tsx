import { View, Text, ScrollView } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
export default function PreHarvestScreen() {
  return (
    <ScreenContainer className="p-6">
      <ScrollView>
        <Text className="text-2xl font-bold text-foreground mb-4">Pre-Harvest</Text>
        <View className="bg-surface p-4 rounded-lg">
          <Text className="text-muted">Feature 15 implementation</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
