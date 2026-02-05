import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
export default function LandTokenizationScreen() {
  return (
    <ScreenContainer className="p-6">
      <ScrollView>
        <Text className="text-2xl font-bold text-foreground mb-4">Land Registry</Text>
        <View className="bg-surface p-4 rounded-lg mb-4">
          <Text className="text-lg font-semibold">My Land Parcels: 3</Text>
          <Text className="text-muted">Total: 5.2 hectares</Text>
        </View>
        <TouchableOpacity className="bg-primary p-4 rounded-lg">
          <Text className="text-background text-center font-semibold">Register Land</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
