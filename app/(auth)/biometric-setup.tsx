import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenContainer } from '@/components/screen-container';

const BIOMETRIC_ENABLED_KEY = 'biometricEnabled';

export default function BiometricSetupScreen() {
  const router = useRouter();
  const [isEnrolling, setIsEnrolling] = useState(false);

  const handleEnableBiometric = async () => {
    try {
      setIsEnrolling(true);

      // Check if device supports biometrics
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        Alert.alert(
          'Not Supported',
          'Your device does not support biometric authentication.'
        );
        return;
      }

      // Check if biometrics are enrolled
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) {
        Alert.alert(
          'No Biometrics Found',
          'Please set up Face ID or Touch ID in your device settings first.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => {
              // On iOS, this would open Settings app
              // For now, just show a message
              Alert.alert('Please go to Settings > Face ID & Passcode');
            }},
          ]
        );
        return;
      }

      // Test biometric authentication
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify your identity',
        fallbackLabel: 'Use passcode',
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        // Save biometric preference
        await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
        
        Alert.alert(
          'Success!',
          'Biometric authentication has been enabled for your account.',
          [
            {
              text: 'Continue',
              onPress: () => router.replace('/(tabs)'),
            },
          ]
        );
      } else {
        Alert.alert(
          'Authentication Failed',
          'Please try again or skip this step.'
        );
      }
    } catch (error) {
      console.error('Biometric setup error:', error);
      Alert.alert(
        'Error',
        'Failed to set up biometric authentication. Please try again later.'
      );
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'false');
    router.replace('/(tabs)');
  };

  return (
    <ScreenContainer className="p-6 justify-center">
      <View className="items-center mb-8">
        <Text className="text-6xl mb-6">🔐</Text>
        <Text className="text-3xl font-bold text-foreground text-center mb-4">
          Secure Your Account
        </Text>
        <Text className="text-lg text-muted text-center leading-relaxed">
          Enable biometric authentication for quick and secure access to your account.
        </Text>
      </View>

      <View className="bg-surface rounded-2xl p-6 mb-6 border border-border">
        <View className="flex-row items-start mb-4">
          <Text className="text-2xl mr-3">✓</Text>
          <View className="flex-1">
            <Text className="text-foreground font-semibold mb-1">Fast Login</Text>
            <Text className="text-muted text-sm">
              Access your account instantly with Face ID or Touch ID
            </Text>
          </View>
        </View>

        <View className="flex-row items-start mb-4">
          <Text className="text-2xl mr-3">✓</Text>
          <View className="flex-1">
            <Text className="text-foreground font-semibold mb-1">Enhanced Security</Text>
            <Text className="text-muted text-sm">
              Your biometric data never leaves your device
            </Text>
          </View>
        </View>

        <View className="flex-row items-start">
          <Text className="text-2xl mr-3">✓</Text>
          <View className="flex-1">
            <Text className="text-foreground font-semibold mb-1">Payment Protection</Text>
            <Text className="text-muted text-sm">
              Confirm transactions with your fingerprint or face
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        onPress={handleEnableBiometric}
        disabled={isEnrolling}
        className="bg-primary rounded-xl p-4 mb-3"
        style={{ opacity: isEnrolling ? 0.6 : 1 }}
      >
        <Text className="text-white text-center font-semibold text-lg">
          {isEnrolling ? 'Setting Up...' : 'Enable Biometric Authentication'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleSkip}
        disabled={isEnrolling}
        className="bg-surface border border-border rounded-xl p-4"
        style={{ opacity: isEnrolling ? 0.6 : 1 }}
      >
        <Text className="text-foreground text-center font-semibold text-lg">
          Skip for Now
        </Text>
      </TouchableOpacity>

      <Text className="text-muted text-center text-sm mt-6">
        You can enable this feature later in Settings
      </Text>
    </ScreenContainer>
  );
}
