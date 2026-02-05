import { View, Text, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScreenContainer } from '@/components/screen-container';

export default function SettingsScreen() {
  const [biometricEnabled, setBiometricEnabled] = useState(true);
  const [faceIdEnabled, setFaceIdEnabled] = useState(false);
  const [autoLock, setAutoLock] = useState(true);

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Settings' }} />

      <ScrollView className="flex-1">
        {/* Security Settings */}
        <Text className="text-lg font-bold text-foreground mb-3">Security</Text>
        <View className="bg-surface rounded-xl border border-border mb-6">
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <View className="flex-1">
              <Text className="text-foreground font-medium">Biometric Login</Text>
              <Text className="text-muted text-sm">Use fingerprint to login</Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={setBiometricEnabled}
              trackColor={{ false: '#E5E7EB', true: '#0a7ea4' }}
            />
          </View>

          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <View className="flex-1">
              <Text className="text-foreground font-medium">Face ID</Text>
              <Text className="text-muted text-sm">Use face recognition</Text>
            </View>
            <Switch
              value={faceIdEnabled}
              onValueChange={setFaceIdEnabled}
              trackColor={{ false: '#E5E7EB', true: '#0a7ea4' }}
            />
          </View>

          <View className="flex-row items-center justify-between p-4">
            <View className="flex-1">
              <Text className="text-foreground font-medium">Auto Lock</Text>
              <Text className="text-muted text-sm">Lock app when inactive</Text>
            </View>
            <Switch
              value={autoLock}
              onValueChange={setAutoLock}
              trackColor={{ false: '#E5E7EB', true: '#0a7ea4' }}
            />
          </View>
        </View>

        {/* App Settings */}
        <Text className="text-lg font-bold text-foreground mb-3">App Settings</Text>
        <View className="bg-surface rounded-xl border border-border mb-6">
          <TouchableOpacity
            className="flex-row items-center justify-between p-4 border-b border-border"
            style={{ opacity: 1 }}
          >
            <View className="flex-1">
              <Text className="text-foreground font-medium">Language</Text>
              <Text className="text-muted text-sm">English</Text>
            </View>
            <Text className="text-muted">›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center justify-between p-4 border-b border-border"
            style={{ opacity: 1 }}
          >
            <View className="flex-1">
              <Text className="text-foreground font-medium">Currency</Text>
              <Text className="text-muted text-sm">USD</Text>
            </View>
            <Text className="text-muted">›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center justify-between p-4"
            style={{ opacity: 1 }}
          >
            <View className="flex-1">
              <Text className="text-foreground font-medium">Theme</Text>
              <Text className="text-muted text-sm">System Default</Text>
            </View>
            <Text className="text-muted">›</Text>
          </TouchableOpacity>
        </View>

        {/* Data & Privacy */}
        <Text className="text-lg font-bold text-foreground mb-3">Data & Privacy</Text>
        <View className="bg-surface rounded-xl border border-border mb-6">
          <TouchableOpacity
            className="flex-row items-center justify-between p-4 border-b border-border"
            style={{ opacity: 1 }}
          >
            <Text className="text-foreground font-medium">Privacy Policy</Text>
            <Text className="text-muted">›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center justify-between p-4 border-b border-border"
            style={{ opacity: 1 }}
          >
            <Text className="text-foreground font-medium">Terms of Service</Text>
            <Text className="text-muted">›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center justify-between p-4"
            style={{ opacity: 1 }}
          >
            <Text className="text-foreground font-medium">Data Usage</Text>
            <Text className="text-muted">›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
