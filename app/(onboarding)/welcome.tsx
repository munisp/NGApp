import { View, Text, TouchableOpacity, Image } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import * as Haptics from "expo-haptics";

export default function WelcomeScreen() {
  const router = useRouter();

  const handleGetStarted = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(onboarding)/features");
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="p-6 justify-center">
      <View className="items-center gap-8">
        {/* Logo/Icon */}
        <View className="w-32 h-32 bg-primary rounded-full items-center justify-center">
          <Text className="text-6xl">🌍</Text>
        </View>

        {/* Title */}
        <View className="items-center gap-2">
          <Text className="text-4xl font-bold text-foreground text-center">
            African Fintech
          </Text>
          <Text className="text-lg text-muted text-center">
            Complete Financial Services for Africa
          </Text>
        </View>

        {/* Features List */}
        <View className="gap-4 w-full">
          <View className="flex-row items-center gap-3">
            <View className="w-12 h-12 bg-primary/20 rounded-full items-center justify-center">
              <Text className="text-2xl">💰</Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-foreground">20 Financial Services</Text>
              <Text className="text-sm text-muted">Lending, savings, insurance & more</Text>
            </View>
          </View>

          <View className="flex-row items-center gap-3">
            <View className="w-12 h-12 bg-primary/20 rounded-full items-center justify-center">
              <Text className="text-2xl">🔒</Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-foreground">Secure & Trusted</Text>
              <Text className="text-sm text-muted">Bank-level security for your money</Text>
            </View>
          </View>

          <View className="flex-row items-center gap-3">
            <View className="w-12 h-12 bg-primary/20 rounded-full items-center justify-center">
              <Text className="text-2xl">⚡</Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-foreground">Fast & Easy</Text>
              <Text className="text-sm text-muted">Get loans in minutes, not days</Text>
            </View>
          </View>
        </View>

        {/* CTA Button */}
        <TouchableOpacity
          onPress={handleGetStarted}
          className="w-full bg-primary rounded-full py-4 px-8 items-center mt-8 active:opacity-80"
        >
          <Text className="text-background text-lg font-bold">Get Started</Text>
        </TouchableOpacity>

        {/* Login Link */}
        <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
          <Text className="text-muted">
            Already have an account?{" "}
            <Text className="text-primary font-semibold">Log In</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}
