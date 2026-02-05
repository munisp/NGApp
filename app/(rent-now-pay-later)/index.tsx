import { View, Text, ScrollView } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
export default function MarketStallsScreen() {
  return (
    <ScreenContainer className="p-6">
      <ScrollView>
        <Text className="text-2xl font-bold text-foreground mb-4">Market Stalls</Text>
        <View className="bg-surface p-4 rounded-lg">
          <Text className="text-muted">Feature 10 implementation</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
