import { ScrollView, Text, View, Pressable, Alert } from "react-native";
import { useState, useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { requireBiometricForView } from "@/utils/biometric-reauth";

export default function AccountNumberScreen() {
  const colors = useColors();
  const params = useLocalSearchParams();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accountNumber, setAccountNumber] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  useEffect(() => {
    authenticateUser();
  }, []);

  const authenticateUser = async () => {
    const authenticated = await requireBiometricForView("account numbers");
    
    if (authenticated) {
      setIsAuthenticated(true);
      // Load account details (mock data)
      setAccountNumber(params.accountNumber as string || "****1234");
      setRoutingNumber("021000021");
      setAccountName(params.accountName as string || "Checking Account");
    } else {
      Alert.alert(
        "Authentication Required",
        "You must authenticate to view account numbers",
        [
          {
            text: "Go Back",
            onPress: () => router.back(),
          },
          {
            text: "Try Again",
            onPress: () => authenticateUser(),
          },
        ]
      );
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Copied", `${label} copied to clipboard`);
  };

  if (!isAuthenticated) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center">
          <Text className="text-6xl mb-4">🔒</Text>
          <Text className="text-lg font-semibold text-foreground mb-2">
            Authentication Required
          </Text>
          <Text className="text-sm text-muted text-center px-8">
            Authenticating to view sensitive account information...
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-2xl font-bold text-foreground">
                Account Details
              </Text>
              <Text className="text-sm text-muted">{accountName}</Text>
            </View>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text className="text-primary font-semibold">Done</Text>
            </Pressable>
          </View>

          {/* Security Notice */}
          <View
            style={{ backgroundColor: colors.warning + "20" }}
            className="p-4 rounded-2xl border border-warning"
          >
            <View className="flex-row items-start gap-3">
              <Text className="text-2xl">⚠️</Text>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground mb-1">
                  Sensitive Information
                </Text>
                <Text className="text-xs text-muted">
                  Keep your account numbers secure. Never share them via email
                  or unsecured channels.
                </Text>
              </View>
            </View>
          </View>

          {/* Account Number */}
          <View
            style={{ backgroundColor: colors.surface }}
            className="p-4 rounded-2xl border border-border"
          >
            <Text className="text-sm text-muted mb-2">Account Number</Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-foreground tracking-wider">
                {accountNumber}
              </Text>
              <Pressable
                onPress={() => copyToClipboard(accountNumber, "Account number")}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                className="px-4 py-2 rounded-full"
              >
                <Text className="text-background font-semibold text-sm">
                  Copy
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Routing Number */}
          <View
            style={{ backgroundColor: colors.surface }}
            className="p-4 rounded-2xl border border-border"
          >
            <Text className="text-sm text-muted mb-2">Routing Number</Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-foreground tracking-wider">
                {routingNumber}
              </Text>
              <Pressable
                onPress={() => copyToClipboard(routingNumber, "Routing number")}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                className="px-4 py-2 rounded-full"
              >
                <Text className="text-background font-semibold text-sm">
                  Copy
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Account Type */}
          <View
            style={{ backgroundColor: colors.surface }}
            className="p-4 rounded-2xl border border-border"
          >
            <Text className="text-sm text-muted mb-2">Account Type</Text>
            <Text className="text-lg font-semibold text-foreground">
              Checking
            </Text>
          </View>

          {/* Bank Information */}
          <View
            style={{ backgroundColor: colors.surface }}
            className="p-4 rounded-2xl border border-border"
          >
            <Text className="text-sm text-muted mb-2">Bank Name</Text>
            <Text className="text-lg font-semibold text-foreground mb-3">
              African Fintech Bank
            </Text>
            <Text className="text-sm text-muted mb-2">SWIFT Code</Text>
            <Text className="text-lg font-semibold text-foreground">
              AFBKUS33
            </Text>
          </View>

          {/* Actions */}
          <View className="gap-3">
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Alert.alert(
                  "Share Account Details",
                  "How would you like to share your account details?",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Generate PDF",
                      onPress: () => Alert.alert("Feature Coming Soon"),
                    },
                  ]
                );
              }}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              className="py-4 rounded-2xl"
            >
              <Text className="text-center text-background font-semibold text-base">
                Share Account Details
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.surface,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              className="py-4 rounded-2xl border border-border"
            >
              <Text className="text-center text-foreground font-semibold text-base">
                Close
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
