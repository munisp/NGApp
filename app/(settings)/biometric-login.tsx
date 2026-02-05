import { View, Text, TouchableOpacity, ScrollView, Switch, Alert } from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import {
  checkBiometricCapabilities,
  getBiometricTypeName,
  isBiometricLoginEnabled,
  setupBiometricLogin,
  disableBiometricLogin,
  getQuickLoginSession,
  formatSessionRemainingTime,
  type BiometricCapabilities,
  type QuickLoginSession,
} from "@/utils/biometric-login";

export default function BiometricLoginSettingsScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const [capabilities, setCapabilities] = useState<BiometricCapabilities | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [session, setSession] = useState<QuickLoginSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
    const interval = setInterval(loadSession, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    const caps = await checkBiometricCapabilities();
    const enabled = await isBiometricLoginEnabled();
    const sess = await getQuickLoginSession();
    
    setCapabilities(caps);
    setIsEnabled(enabled);
    setSession(sess);
    setIsLoading(false);
  };

  const loadSession = async () => {
    if (isEnabled) {
      const sess = await getQuickLoginSession();
      setSession(sess);
    }
  };

  const handleToggle = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (value) {
      // Enable biometric login
      if (!user) {
        Alert.alert("Error", "You must be logged in to enable biometric login");
        return;
      }

      const result = await setupBiometricLogin(String(user.id));
      
      if (result.success) {
        setIsEnabled(true);
        await loadSession();
        Alert.alert(
          "Success",
          "Biometric login has been enabled. You can now unlock the app with your biometric."
        );
      } else {
        Alert.alert("Error", result.error || "Failed to enable biometric login");
      }
    } else {
      // Disable biometric login
      Alert.alert(
        "Disable Biometric Login",
        "Are you sure you want to disable biometric login? You'll need to enter your PIN to access the app.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Disable",
            style: "destructive",
            onPress: async () => {
              await disableBiometricLogin();
              setIsEnabled(false);
              setSession(null);
              Alert.alert("Disabled", "Biometric login has been disabled");
            },
          },
        ]
      );
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer className="p-6 items-center justify-center">
        <Text className="text-lg text-muted">Loading...</Text>
      </ScreenContainer>
    );
  }

  if (!capabilities?.isAvailable) {
    return (
      <ScreenContainer className="p-6">
        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="gap-6">
            <Text className="text-2xl font-bold text-foreground">Biometric Login</Text>
            
            <View
              className="rounded-xl p-6 items-center"
              style={{ backgroundColor: colors.surface }}
            >
              <Text className="text-6xl mb-4">🔒</Text>
              <Text className="text-lg font-semibold text-foreground text-center mb-2">
                Not Available
              </Text>
              <Text className="text-base text-muted text-center">
                {!capabilities?.hasHardware
                  ? "Your device doesn't support biometric authentication."
                  : "No biometric credentials are enrolled on your device. Please set up Face ID or fingerprint in your device settings."}
              </Text>
            </View>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  const biometricType = capabilities.supportedTypes[0]
    ? getBiometricTypeName(capabilities.supportedTypes[0])
    : "Biometric";

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View>
            <Text className="text-2xl font-bold text-foreground">Biometric Login</Text>
            <Text className="text-base text-muted mt-2">
              Use {biometricType} to quickly unlock the app
            </Text>
          </View>

          {/* Main Toggle */}
          <View
            className="rounded-xl p-4 border"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-4">
                <Text className="text-lg font-semibold text-foreground mb-1">
                  Enable {biometricType}
                </Text>
                <Text className="text-sm text-muted">
                  Unlock the app instantly with your biometric
                </Text>
              </View>
              <Switch
                value={isEnabled}
                onValueChange={handleToggle}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={isEnabled ? "#FFFFFF" : "#F4F3F4"}
              />
            </View>
          </View>

          {/* Session Info */}
          {isEnabled && session && (
            <View
              className="rounded-xl p-4"
              style={{ backgroundColor: colors.primary + "10" }}
            >
              <Text className="text-sm font-medium text-foreground mb-2">
                Active Session
              </Text>
              <Text className="text-sm text-muted">
                Your quick login session will expire in{" "}
                <Text className="font-semibold" style={{ color: colors.primary }}>
                  {formatSessionRemainingTime(session)}
                </Text>
              </Text>
              <Text className="text-xs text-muted mt-2">
                The session automatically extends when you use biometric login.
              </Text>
            </View>
          )}

          {/* Features */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Features</Text>
            
            {[
              {
                icon: "⚡",
                title: "Instant Access",
                description: "Skip PIN entry and unlock the app in seconds",
              },
              {
                icon: "🔒",
                title: "Secure",
                description: "Your biometric data never leaves your device",
              },
              {
                icon: "⏱️",
                title: "Session Management",
                description: "Stay logged in for 15 minutes after authentication",
              },
              {
                icon: "🔄",
                title: "Fallback Option",
                description: "Use PIN if biometric authentication fails",
              },
            ].map((feature, index) => (
              <View
                key={index}
                className="rounded-xl p-4 border"
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                }}
              >
                <View className="flex-row items-start gap-3">
                  <Text className="text-2xl">{feature.icon}</Text>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-foreground mb-1">
                      {feature.title}
                    </Text>
                    <Text className="text-sm text-muted">{feature.description}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Security Note */}
          <View
            className="rounded-xl p-4"
            style={{ backgroundColor: colors.surface }}
          >
            <Text className="text-sm text-muted leading-relaxed">
              <Text className="font-semibold">Security Note:</Text> Biometric login
              provides quick access to your account. For sensitive operations like
              large transfers or changing security settings, you'll still need to
              authenticate with your PIN or biometric.
            </Text>
          </View>

          {/* Bottom Spacing */}
          <View className="h-8" />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
