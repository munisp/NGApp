import { ScrollView, Text, View, TouchableOpacity, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useRouter } from "expo-router";

export default function SocialVerification() {
  const colors = useColors();
  const router = useRouter();

  const profile = {
    credit_score: 650,
    facebook_connected: false,
    linkedin_connected: false,
    facebook_friends: 0,
    linkedin_connections: 0,
    potential_boost: 50,
  };

  const handleConnectFacebook = () => {
    Alert.alert("Connect Facebook", "This will redirect you to Facebook to authorize access.", [
      { text: "Cancel", style: "cancel" },
      { text: "Continue", onPress: () => Alert.alert("Success", "Facebook connected! Credit score +25") },
    ]);
  };

  const handleConnectLinkedIn = () => {
    Alert.alert("Connect LinkedIn", "This will redirect you to LinkedIn to authorize access.", [
      { text: "Cancel", style: "cancel" },
      { text: "Continue", onPress: () => Alert.alert("Success", "LinkedIn connected! Credit score +25") },
    ]);
  };

  return (
    <ScreenContainer className="p-0">
      <View className="px-6 pt-4 pb-3" style={{ backgroundColor: colors.background }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary }}>← Back</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold mt-2" style={{ color: colors.foreground }}>Social Verification</Text>
        <Text className="mt-1" style={{ color: colors.muted }}>Boost your credit score by connecting social accounts</Text>
      </View>

      <ScrollView className="flex-1 px-6">
        {/* Current Score */}
        <View className="p-4 rounded-xl mb-4" style={{ backgroundColor: colors.surface }}>
          <Text className="text-base font-semibold mb-3" style={{ color: colors.foreground }}>Current Credit Score</Text>
          <Text className="text-4xl font-bold mb-2" style={{ color: colors.primary }}>{profile.credit_score}</Text>
          <Text style={{ color: colors.muted }}>Potential boost: +{profile.potential_boost} points</Text>
        </View>

        {/* Facebook Connection */}
        <View className="p-4 rounded-xl mb-4" style={{ backgroundColor: colors.surface }}>
          <View className="flex-row items-center mb-3">
            <View className="w-12 h-12 rounded-full items-center justify-center mr-3" style={{ backgroundColor: "#1877F2" }}>
              <Text className="text-2xl">f</Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold" style={{ color: colors.foreground }}>Facebook</Text>
              <Text className="text-xs" style={{ color: colors.muted }}>
                {profile.facebook_connected ? `${profile.facebook_friends} friends` : "Not connected"}
              </Text>
            </View>
            {profile.facebook_connected && (
              <View className="px-3 py-1 rounded-full" style={{ backgroundColor: "#22C55E20" }}>
                <Text className="text-xs font-semibold" style={{ color: "#22C55E" }}>Connected</Text>
              </View>
            )}
          </View>

          {!profile.facebook_connected && (
            <>
              <Text className="text-sm mb-3" style={{ color: colors.foreground }}>
                Connect your Facebook account to verify your social network and boost your credit score by up to 25 points.
              </Text>
              <TouchableOpacity onPress={handleConnectFacebook} className="py-3 rounded-full" style={{ backgroundColor: "#1877F2" }}>
                <Text className="text-center font-semibold" style={{ color: "#FFF" }}>Connect Facebook</Text>
              </TouchableOpacity>
            </>
          )}

          {profile.facebook_connected && (
            <View>
              <View className="flex-row justify-between mb-2">
                <Text style={{ color: colors.muted }}>Friends Count</Text>
                <Text className="font-bold" style={{ color: colors.foreground }}>{profile.facebook_friends}</Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text style={{ color: colors.muted }}>Profile Age</Text>
                <Text className="font-bold" style={{ color: colors.foreground }}>5+ years</Text>
              </View>
              <View className="flex-row justify-between">
                <Text style={{ color: colors.muted }}>Credit Boost</Text>
                <Text className="font-bold" style={{ color: "#22C55E" }}>+25 points</Text>
              </View>
            </View>
          )}
        </View>

        {/* LinkedIn Connection */}
        <View className="p-4 rounded-xl mb-4" style={{ backgroundColor: colors.surface }}>
          <View className="flex-row items-center mb-3">
            <View className="w-12 h-12 rounded-full items-center justify-center mr-3" style={{ backgroundColor: "#0A66C2" }}>
              <Text className="text-2xl font-bold" style={{ color: "#FFF" }}>in</Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold" style={{ color: colors.foreground }}>LinkedIn</Text>
              <Text className="text-xs" style={{ color: colors.muted }}>
                {profile.linkedin_connected ? `${profile.linkedin_connections} connections` : "Not connected"}
              </Text>
            </View>
            {profile.linkedin_connected && (
              <View className="px-3 py-1 rounded-full" style={{ backgroundColor: "#22C55E20" }}>
                <Text className="text-xs font-semibold" style={{ color: "#22C55E" }}>Connected</Text>
              </View>
            )}
          </View>

          {!profile.linkedin_connected && (
            <>
              <Text className="text-sm mb-3" style={{ color: colors.foreground }}>
                Connect your LinkedIn account to verify your professional network and boost your credit score by up to 25 points.
              </Text>
              <TouchableOpacity onPress={handleConnectLinkedIn} className="py-3 rounded-full" style={{ backgroundColor: "#0A66C2" }}>
                <Text className="text-center font-semibold" style={{ color: "#FFF" }}>Connect LinkedIn</Text>
              </TouchableOpacity>
            </>
          )}

          {profile.linkedin_connected && (
            <View>
              <View className="flex-row justify-between mb-2">
                <Text style={{ color: colors.muted }}>Connections</Text>
                <Text className="font-bold" style={{ color: colors.foreground }}>{profile.linkedin_connections}</Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text style={{ color: colors.muted }}>Profile Completeness</Text>
                <Text className="font-bold" style={{ color: colors.foreground }}>95%</Text>
              </View>
              <View className="flex-row justify-between">
                <Text style={{ color: colors.muted }}>Credit Boost</Text>
                <Text className="font-bold" style={{ color: "#22C55E" }}>+25 points</Text>
              </View>
            </View>
          )}
        </View>

        {/* Benefits */}
        <View className="p-4 rounded-xl mb-4" style={{ backgroundColor: colors.primary + "10" }}>
          <Text className="text-base font-semibold mb-3" style={{ color: colors.foreground }}>Benefits of Social Verification</Text>
          <View className="flex-row mb-2">
            <Text style={{ color: colors.primary }}>✓ </Text>
            <Text className="flex-1" style={{ color: colors.foreground }}>Boost your credit score by up to 50 points</Text>
          </View>
          <View className="flex-row mb-2">
            <Text style={{ color: colors.primary }}>✓ </Text>
            <Text className="flex-1" style={{ color: colors.foreground }}>Access better interest rates on loans</Text>
          </View>
          <View className="flex-row mb-2">
            <Text style={{ color: colors.primary }}>✓ </Text>
            <Text className="flex-1" style={{ color: colors.foreground }}>Increase your loan approval chances</Text>
          </View>
          <View className="flex-row">
            <Text style={{ color: colors.primary }}>✓ </Text>
            <Text className="flex-1" style={{ color: colors.foreground }}>Build trust with lenders</Text>
          </View>
        </View>

        <View className="h-24" />
      </ScrollView>
    </ScreenContainer>
  );
}
