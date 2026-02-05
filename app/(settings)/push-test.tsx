import { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { trpc } from '@/lib/trpc';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export default function PushTestScreen() {
  const [title, setTitle] = useState('Test Notification');
  const [body, setBody] = useState('This is a test push notification from your fintech app!');
  const [sending, setSending] = useState(false);

  const sendTestMutation = trpc.pushTest.sendExpoPushNotification.useMutation();
  const { data: stats, refetch: refetchStats } = trpc.pushTest.getPushStats.useQuery();

  const handleSendTest = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Error', 'Please enter both title and body');
      return;
    }

    if (!stats?.hasToken) {
      Alert.alert(
        'No Push Token',
        'You need to register for push notifications first. Please restart the app to register.'
      );
      return;
    }

    setSending(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const result = await sendTestMutation.mutateAsync({
        title,
        body,
        sound: 'default',
        priority: 'high',
      });

      Alert.alert('Success', 'Test notification sent! Check your device.');
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send notification');
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 gap-6">
          {/* Header */}
          <View>
            <Text className="text-2xl font-bold text-foreground">Push Notification Test</Text>
            <Text className="text-sm text-muted mt-1">
              Send test push notifications to your device
            </Text>
          </View>

          {/* Stats Card */}
          <View className="bg-surface rounded-2xl p-4 border border-border">
            <Text className="text-base font-semibold text-foreground mb-3">
              Registration Status
            </Text>
            <View className="gap-2">
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">Push Token</Text>
                <Text className="text-sm font-medium text-foreground">
                  {stats?.hasToken ? '✓ Registered' : '✗ Not Registered'}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">Push Enabled</Text>
                <Text className="text-sm font-medium text-foreground">
                  {stats?.pushEnabled ? 'Yes' : 'No'}
                </Text>
              </View>
              {stats?.token && (
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted">Token</Text>
                  <Text className="text-xs font-mono text-foreground">{stats.token}</Text>
                </View>
              )}
              {stats?.registeredAt && (
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted">Registered</Text>
                  <Text className="text-sm font-medium text-foreground">
                    {new Date(stats.registeredAt).toLocaleDateString()}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={() => refetchStats()}
              className="mt-3 py-2 px-4 bg-primary/10 rounded-lg"
              activeOpacity={0.7}
            >
              <Text className="text-sm font-medium text-primary text-center">Refresh Status</Text>
            </TouchableOpacity>
          </View>

          {/* Test Form */}
          <View className="bg-surface rounded-2xl p-4 border border-border gap-4">
            <Text className="text-base font-semibold text-foreground">Test Notification</Text>

            <View>
              <Text className="text-sm font-medium text-foreground mb-2">Title</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Notification title"
                className="bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                placeholderTextColor="#9BA1A6"
                maxLength={100}
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-foreground mb-2">Body</Text>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Notification message"
                className="bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                placeholderTextColor="#9BA1A6"
                multiline
                numberOfLines={4}
                maxLength={200}
                style={{ minHeight: 100, textAlignVertical: 'top' }}
              />
            </View>

            <TouchableOpacity
              onPress={handleSendTest}
              disabled={sending || !stats?.hasToken}
              className="bg-primary rounded-lg py-3 px-6"
              activeOpacity={0.7}
              style={[(sending || !stats?.hasToken) && { opacity: 0.5 }]}
            >
              <Text className="text-background font-semibold text-center">
                {sending ? 'Sending...' : 'Send Test Notification'}
              </Text>
            </TouchableOpacity>

            {!stats?.hasToken && (
              <View className="bg-warning/10 rounded-lg p-3">
                <Text className="text-sm text-warning text-center">
                  ⚠️ Push token not registered. Restart the app to register.
                </Text>
              </View>
            )}
          </View>

          {/* Instructions */}
          <View className="bg-surface rounded-2xl p-4 border border-border">
            <Text className="text-base font-semibold text-foreground mb-2">
              Testing Instructions
            </Text>
            <View className="gap-2">
              <Text className="text-sm text-muted">
                1. Ensure you have granted notification permissions
              </Text>
              <Text className="text-sm text-muted">
                2. Verify your push token is registered above
              </Text>
              <Text className="text-sm text-muted">
                3. Enter a title and message for the test notification
              </Text>
              <Text className="text-sm text-muted">
                4. Tap "Send Test Notification" to receive it on this device
              </Text>
              <Text className="text-sm text-muted">
                5. The notification should appear in your notification tray
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
