import { View, Text, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import { notificationService } from '@/lib/api/services-mock';

export default function NotificationPreferencesScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    email: true,
    sms: true,
    push: true,
  });

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const data = await notificationService.getPreferences();
      setPreferences(data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: keyof typeof preferences, value: boolean) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);

    try {
      setSaving(true);
      await notificationService.updatePreferences(newPreferences);
    } catch (error: any) {
      // Revert on error
      setPreferences(preferences);
      Alert.alert('Error', error.message || 'Failed to update preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ title: 'Notifications' }} />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0a7ea4" />
          <Text className="text-muted mt-4">Loading preferences...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Notifications' }} />

      <ScrollView className="flex-1">
        <Text className="text-muted mb-6">
          Choose how you want to receive notifications about your account activity
        </Text>

        {/* Email Notifications */}
        <View className="bg-surface rounded-xl border border-border mb-4">
          <View className="flex-row items-center justify-between p-4">
            <View className="flex-1">
              <View className="flex-row items-center mb-1">
                <Text className="text-2xl mr-2">📧</Text>
                <Text className="text-foreground font-semibold text-lg">Email</Text>
              </View>
              <Text className="text-muted text-sm">Receive notifications via email</Text>
            </View>
            <Switch
              value={preferences.email}
              onValueChange={(value) => updatePreference('email', value)}
              disabled={saving}
              trackColor={{ false: '#E5E7EB', true: '#0a7ea4' }}
            />
          </View>
        </View>

        {/* SMS Notifications */}
        <View className="bg-surface rounded-xl border border-border mb-4">
          <View className="flex-row items-center justify-between p-4">
            <View className="flex-1">
              <View className="flex-row items-center mb-1">
                <Text className="text-2xl mr-2">💬</Text>
                <Text className="text-foreground font-semibold text-lg">SMS</Text>
              </View>
              <Text className="text-muted text-sm">Receive notifications via SMS</Text>
            </View>
            <Switch
              value={preferences.sms}
              onValueChange={(value) => updatePreference('sms', value)}
              disabled={saving}
              trackColor={{ false: '#E5E7EB', true: '#0a7ea4' }}
            />
          </View>
        </View>

        {/* Push Notifications */}
        <View className="bg-surface rounded-xl border border-border mb-4">
          <View className="flex-row items-center justify-between p-4">
            <View className="flex-1">
              <View className="flex-row items-center mb-1">
                <Text className="text-2xl mr-2">🔔</Text>
                <Text className="text-foreground font-semibold text-lg">Push Notifications</Text>
              </View>
              <Text className="text-muted text-sm">Receive push notifications on your device</Text>
            </View>
            <Switch
              value={preferences.push}
              onValueChange={(value) => updatePreference('push', value)}
              disabled={saving}
              trackColor={{ false: '#E5E7EB', true: '#0a7ea4' }}
            />
          </View>
        </View>

        {/* Notification Types */}
        <Text className="text-lg font-bold text-foreground mt-6 mb-3">Notification Types</Text>
        <View className="bg-surface rounded-xl border border-border mb-6">
          <View className="p-4 border-b border-border">
            <Text className="text-foreground font-medium mb-1">Transaction Alerts</Text>
            <Text className="text-muted text-sm">Get notified about all transactions</Text>
          </View>
          <View className="p-4 border-b border-border">
            <Text className="text-foreground font-medium mb-1">Security Alerts</Text>
            <Text className="text-muted text-sm">Important security updates and warnings</Text>
          </View>
          <View className="p-4 border-b border-border">
            <Text className="text-foreground font-medium mb-1">Account Updates</Text>
            <Text className="text-muted text-sm">Changes to your account status</Text>
          </View>
          <View className="p-4">
            <Text className="text-foreground font-medium mb-1">Promotional</Text>
            <Text className="text-muted text-sm">Special offers and updates</Text>
          </View>
        </View>

        {saving && (
          <View className="bg-primary/10 rounded-xl p-4 flex-row items-center justify-center">
            <ActivityIndicator size="small" color="#0a7ea4" />
            <Text className="text-primary ml-2">Saving preferences...</Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
