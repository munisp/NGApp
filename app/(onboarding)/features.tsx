import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import * as Haptics from "expo-haptics";

export default function FeaturesScreen() {
  const router = useRouter();

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(onboarding)/complete");
  };

  const features = [
    { icon: "🎓", name: "School Fees", desc: "Pay school fees in installments" },
    { icon: "📱", name: "Airtime Loans", desc: "Use airtime as collateral" },
    { icon: "🌾", name: "Farm Insurance", desc: "Protect your crops" },
    { icon: "🤝", name: "P2P Lending", desc: "Borrow from community" },
    { icon: "💰", name: "Bill Splitting", desc: "Share expenses easily" },
    { icon: "💎", name: "Savings Circles", desc: "Save with friends" },
  ];

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">
              Explore Our Features
            </Text>
            <Text className="text-base text-muted">
              20 financial services designed for Africans
            </Text>
          </View>

          {/* Features Grid */}
          <View className="gap-4">
            {features.map((feature, index) => (
              <View
                key={index}
                className="bg-surface border border-border rounded-xl p-4 flex-row items-center gap-4"
              >
                <View className="w-16 h-16 bg-primary/20 rounded-full items-center justify-center">
                  <Text className="text-3xl">{feature.icon}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-foreground">{feature.name}</Text>
                  <Text className="text-sm text-muted">{feature.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* More Features Note */}
          <View className="bg-primary/10 border border-primary/30 rounded-xl p-4">
            <Text className="text-primary font-semibold text-center">
              + 14 more features available
            </Text>
          </View>

          {/* CTA Buttons */}
          <View className="gap-3 mt-4">
            <TouchableOpacity
              onPress={handleContinue}
              className="w-full bg-primary rounded-full py-4 px-8 items-center active:opacity-80"
            >
              <Text className="text-background text-lg font-bold">Continue</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/(tabs)")}
              className="w-full border border-primary rounded-full py-4 px-8 items-center active:opacity-70"
            >
              <Text className="text-primary text-base font-semibold">Skip for Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
