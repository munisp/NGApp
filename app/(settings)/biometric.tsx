import { View, Text, Switch, TouchableOpacity, Alert, ScrollView, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from 'expo-haptics';
import { biometricAuth, type BiometricCapabilities } from '@/lib/biometric-auth';

export default function BiometricSettingsScreen() {
  const router = useRouter();
  const colors = useColors();
  const [isLoading, setIsLoading] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [capabilities, setCapabilities] = useState<BiometricCapabilities>({
    isAvailable: false,
    supportedTypes: [],
    isEnrolled: false,
    securityLevel: 'none',
  });

  useEffect(() => {
    loadBiometricStatus();
  }, []);

  const loadBiometricStatus = async () => {
    try {
      setIsLoading(true);
      const caps = await biometricAuth.getCapabilities();
      const enabled = await biometricAuth.isBiometricEnabled();
      setCapabilities(caps);
      setBiometricEnabled(enabled);
    } catch (error) {
      console.error('Error loading biometric status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleBiometric = async (value: boolean) => {
    if (!capabilities.isAvailable || !capabilities.isEnrolled) {
      Alert.alert(
        'Biometric Not Available',
        'Please set up Face ID or Touch ID in your device settings first.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (value) {
      // Enabling biometric - test authentication first
      const result = await biometricAuth.testAuthentication();
      
      if (result.success) {
        await biometricAuth.enableBiometric();
        setBiometricEnabled(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Biometric Enabled',
          'You can now use biometric authentication to sign in and approve transactions.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Authentication Failed',
          result.error || 'Could not verify your biometric credentials.',
          [{ text: 'OK' }]
        );
      }
    } else {
      // Disabling biometric - confirm with user
      Alert.alert(
        'Disable Biometric',
        'Are you sure you want to disable biometric authentication?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              await biometricAuth.disableBiometric();
              setBiometricEnabled(false);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            },
          },
        ]
      );
    }
  };

  const handleTestBiometric = async () => {
    const result = await biometricAuth.testAuthentication();
    
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Success',
        'Biometric authentication test passed!',
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert(
        'Test Failed',
        result.error || 'Biometric authentication test failed.',
        [{ text: 'OK' }]
      );
    }
  };

  const getBiometricIcon = () => {
    if (capabilities.supportedTypes.includes('facial_recognition')) {
      return Platform.OS === 'ios' ? '👤' : '😊';
    }
    if (capabilities.supportedTypes.includes('fingerprint')) {
      return '👆';
    }
    return '🔒';
  };

  const getBiometricName = () => {
    if (capabilities.supportedTypes.includes('facial_recognition')) {
      return Platform.OS === 'ios' ? 'Face ID' : 'Face Recognition';
    }
    if (capabilities.supportedTypes.includes('fingerprint')) {
      return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
    }
    return 'Biometric';
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Biometric Authentication',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
        }}
      />
      <ScreenContainer>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View className="flex-1 p-6">
            {/* Biometric Icon */}
            <View className="items-center mb-8">
              <View className="w-24 h-24 rounded-full bg-primary/10 items-center justify-center mb-4">
                <Text className="text-6xl">{getBiometricIcon()}</Text>
              </View>
              <Text className="text-2xl font-bold text-foreground text-center">
                {getBiometricName()}
              </Text>
              <Text className="text-sm text-muted text-center mt-2">
                Secure your account with biometric authentication
              </Text>
            </View>

            {/* Status Card */}
            <View className="bg-surface rounded-2xl p-6 mb-6 border border-border">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-base font-semibold text-foreground">
                  Biometric Authentication
                </Text>
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleToggleBiometric}
                  disabled={!capabilities.isAvailable || !capabilities.isEnrolled || isLoading}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>

              {/* Status Messages */}
              {!capabilities.isAvailable && (
                <View className="flex-row items-start gap-2 p-3 bg-error/10 rounded-lg">
                  <Text className="text-error text-sm">⚠️</Text>
                  <Text className="text-error text-sm flex-1">
                    Biometric authentication is not available on this device.
                  </Text>
                </View>
              )}

              {capabilities.isAvailable && !capabilities.isEnrolled && (
                <View className="flex-row items-start gap-2 p-3 bg-warning/10 rounded-lg">
                  <Text className="text-warning text-sm">⚠️</Text>
                  <Text className="text-warning text-sm flex-1">
                    No biometric credentials are enrolled. Please set up {getBiometricName()} in your device settings.
                  </Text>
                </View>
              )}

              {capabilities.isAvailable && capabilities.isEnrolled && biometricEnabled && (
                <View className="flex-row items-start gap-2 p-3 bg-success/10 rounded-lg">
                  <Text className="text-success text-sm">✓</Text>
                  <Text className="text-success text-sm flex-1">
                    Biometric authentication is active and protecting your account.
                  </Text>
                </View>
              )}
            </View>

            {/* Device Capabilities */}
            <View className="bg-surface rounded-2xl p-6 mb-6 border border-border">
              <Text className="text-lg font-semibold text-foreground mb-4">
                Device Capabilities
              </Text>

              <View className="gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted">Hardware Available</Text>
                  <Text className="text-sm font-medium text-foreground">
                    {capabilities.isAvailable ? 'Yes' : 'No'}
                  </Text>
                </View>

                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted">Biometric Enrolled</Text>
                  <Text className="text-sm font-medium text-foreground">
                    {capabilities.isEnrolled ? 'Yes' : 'No'}
                  </Text>
                </View>

                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted">Security Level</Text>
                  <Text className="text-sm font-medium text-foreground capitalize">
                    {capabilities.securityLevel}
                  </Text>
                </View>

                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted">Supported Types</Text>
                  <Text className="text-sm font-medium text-foreground">
                    {capabilities.supportedTypes.length > 0
                      ? capabilities.supportedTypes.map(t => {
                          if (t === 'facial_recognition') return Platform.OS === 'ios' ? 'Face ID' : 'Face';
                          if (t === 'fingerprint') return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
                          return t;
                        }).join(', ')
                      : 'None'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Features */}
            <View className="bg-surface rounded-2xl p-6 mb-6 border border-border">
              <Text className="text-lg font-semibold text-foreground mb-4">
                What You Can Do
              </Text>

              <View className="gap-4">
                <View className="flex-row items-start gap-3">
                  <Text className="text-2xl">🔐</Text>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground">Quick Sign In</Text>
                    <Text className="text-xs text-muted mt-1">
                      Sign in to your account instantly without entering your password
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-start gap-3">
                  <Text className="text-2xl">💸</Text>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground">Transaction Approval</Text>
                    <Text className="text-xs text-muted mt-1">
                      Approve payments and transfers securely with biometric confirmation
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-start gap-3">
                  <Text className="text-2xl">🛡️</Text>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground">Enhanced Security</Text>
                    <Text className="text-xs text-muted mt-1">
                      Protect sensitive actions like changing settings or viewing documents
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Test Button */}
            {capabilities.isAvailable && capabilities.isEnrolled && (
              <TouchableOpacity
                onPress={handleTestBiometric}
                className="bg-primary/10 rounded-2xl p-4 mb-6 active:opacity-70"
              >
                <Text className="text-primary text-center font-semibold">
                  Test {getBiometricName()}
                </Text>
              </TouchableOpacity>
            )}

            {/* Security Notice */}
            <View className="bg-surface/50 rounded-2xl p-4 border border-border">
              <View className="flex-row items-start gap-2">
                <Text className="text-lg">ℹ️</Text>
                <View className="flex-1">
                  <Text className="text-xs text-muted leading-relaxed">
                    Your biometric data never leaves your device. We use your device's secure biometric authentication system to verify your identity.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </ScreenContainer>
    </>
  );
}
