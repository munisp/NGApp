import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import * as Haptics from "expo-haptics";

export default function CompleteScreen() {
  const router = useRouter();

  const handleStart = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace("/(tabs)");
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="p-6 justify-center">
      <View className="items-center gap-8">
        {/* Success Icon */}
        <View className="w-32 h-32 bg-success/20 rounded-full items-center justify-center">
          <Text className="text-7xl">✅</Text>
        </View>

        {/* Title */}
        <View className="items-center gap-2">
          <Text className="text-3xl font-bold text-foreground text-center">
            You're All Set!
          </Text>
          <Text className="text-lg text-muted text-center">
            Start exploring African Fintech
          </Text>
        </View>

        {/* Benefits */}
        <View className="gap-4 w-full">
          <View className="flex-row items-center gap-3">
            <Text className="text-3xl">💸</Text>
            <Text className="text-base text-foreground flex-1">
              Access loans in minutes
            </Text>
          </View>

          <View className="flex-row items-center gap-3">
            <Text className="text-3xl">🏦</Text>
            <Text className="text-base text-foreground flex-1">
              Save and invest with community
            </Text>
          </View>

          <View className="flex-row items-center gap-3">
            <Text className="text-3xl">🛡️</Text>
            <Text className="text-base text-foreground flex-1">
              Protect your assets with insurance
            </Text>
          </View>
        </View>

        {/* CTA Button */}
        <TouchableOpacity
          onPress={handleStart}
          className="w-full bg-primary rounded-full py-4 px-8 items-center mt-8 active:opacity-80"
        >
          <Text className="text-background text-lg font-bold">Start Using App</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}
