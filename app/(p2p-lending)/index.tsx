import { ScrollView, Text, View, TouchableOpacity, TextInput } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useRouter } from "expo-router";

export default function P2PLendingMarketplace() {
  const colors = useColors();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"browse" | "my-loans" | "my-investments">("browse");

  return (
    <ScreenContainer className="p-6">
      <Text className="text-2xl font-bold mb-4" style={{ color: colors.foreground }}>
        P2P Lending
      </Text>
      
      <View className="flex-row gap-2 mb-4">
        {(["browse", "my-loans", "my-investments"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            className="flex-1 py-3 rounded-lg items-center"
            style={{ backgroundColor: activeTab === tab ? colors.primary : colors.surface }}
          >
            <Text
              className="font-semibold text-xs"
              style={{ color: activeTab === tab ? "#FFFFFF" : colors.foreground }}
            >
              {tab.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView>
        <Text style={{ color: colors.muted }}>
          {activeTab === "browse" && "Browse available loans"}
          {activeTab === "my-loans" && "Your active loans"}
          {activeTab === "my-investments" && "Your investments"}
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}
