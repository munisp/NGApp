import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
export default function CommunityFundScreen() {
  return (
    <ScreenContainer className="p-6">
      <ScrollView>
        <Text className="text-2xl font-bold text-foreground mb-4">Community Projects</Text>
        <View className="bg-surface p-4 rounded-lg mb-4">
          <Text className="text-lg font-semibold">School Renovation</Text>
          <Text className="text-muted">₦5M raised of ₦10M goal</Text>
        </View>
        <TouchableOpacity className="bg-primary p-4 rounded-lg">
          <Text className="text-background text-center font-semibold">Create Project</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
