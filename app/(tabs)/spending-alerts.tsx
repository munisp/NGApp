import { useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Switch,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { trpc } from '@/lib/trpc';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { DEMO } from '@/lib/demo-data';

/**
 * Spending Alerts Screen
 * 
 * Manage spending alert notifications:
 * - View recent alerts
 * - Configure alert settings
 * - Customize thresholds per category
 * - Enable/disable push notifications
 */

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function SpendingAlertsScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

    // Fetch alerts and settings
    const { data: _alerts, isLoading, isError: alertsError, refetch } = trpc.spendingAlerts.getAlerts.useQuery({
      includeRead: false,
      includeDismissed: false,
    });

    const { data: _settings, isError: settingsError, refetch: refetchSettings } = trpc.spendingAlerts.getSettings.useQuery();
    const alerts = alertsError ? DEMO.spendingAlerts : _alerts;
    const settings = settingsError ? DEMO.spendingAlertSettings : _settings;

  // Mutations
  const markAsReadMutation = trpc.spendingAlerts.markAsRead.useMutation();
  const dismissAlertMutation = trpc.spendingAlerts.dismissAlert.useMutation();
  const updateSettingsMutation = trpc.spendingAlerts.updateSettings.useMutation();

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchSettings()]);
    setRefreshing(false);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleMarkAsRead = async (alertId: string) => {
    try {
      await markAsReadMutation.mutateAsync({ alertId });
      await refetch();
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to mark alert as read');
    }
  };

  const handleDismiss = async (alertId: string) => {
    try {
      await dismissAlertMutation.mutateAsync({ alertId });
      await refetch();
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to dismiss alert');
    }
  };

  const handleToggleSetting = async (key: string, value: boolean) => {
    if (!settings) return;
    
    try {
      await updateSettingsMutation.mutateAsync({
        [key]: value,
      });
      await refetchSettings();
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update settings');
    }
  };

  const handleUpdateThreshold = async (threshold: string) => {
    if (!settings) return;
    
    try {
      await updateSettingsMutation.mutateAsync({
        largeTransactionThreshold: parseFloat(threshold),
      });
      await refetchSettings();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update threshold');
    }
  };

  const requestNotificationPermissions = async () => {
    if (Platform.OS === 'web') return;
    
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      Alert.alert('Permission Required', 'Please enable notifications in your device settings');
      return false;
    }
    
    return true;
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'duplicate_charge':
        return '⚠️';
      case 'large_transaction':
        return '💸';
      case 'merchant_change':
        return '🏪';
      case 'unusual_category':
        return '🔍';
      case 'spending_spike':
        return '📈';
      default:
        return '🔔';
    }
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return colors.error;
      case 'medium':
        return colors.warning;
      case 'low':
        return colors.primary;
      default:
        return colors.muted;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

    if (isLoading && !alertsError) {
      return (
        <ScreenContainer className="items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="mt-4 text-muted">Loading alerts...</Text>
        </ScreenContainer>
      );
    }

  return (
    <ScreenContainer>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <View>
            <Text className="text-3xl font-bold text-foreground">Spending Alerts</Text>
            <Text className="text-base text-muted mt-1">
              {alerts && alerts.length > 0 ? `${alerts.length} unread alerts` : 'No new alerts'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              setShowSettings(!showSettings);
            }}
            activeOpacity={0.7}
            className="p-3 rounded-full"
            style={{ backgroundColor: colors.surface }}
          >
            <IconSymbol name="gear" size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Settings Panel */}
        {showSettings && settings && (
          <View className="bg-surface rounded-3xl p-5 mb-6 border border-border">
            <Text className="text-xl font-bold text-foreground mb-4">Alert Settings</Text>

            {/* Push Notifications */}
            <View className="mb-4">
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">Push Notifications</Text>
                  <Text className="text-sm text-muted mt-1">
                    Receive alerts on your device
                  </Text>
                </View>
                <Switch
                  value={settings.pushNotificationsEnabled}
                  onValueChange={async (value) => {
                    if (value) {
                      const granted = await requestNotificationPermissions();
                      if (!granted) return;
                    }
                    handleToggleSetting('pushNotificationsEnabled', value);
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>
            </View>

            <View className="h-px bg-border mb-4" />

            {/* Alert Types */}
            <Text className="text-base font-semibold text-foreground mb-3">Alert Types</Text>

            {/* Duplicate Charge */}
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-1">
                <Text className="text-sm font-medium text-foreground">Duplicate Charges</Text>
                <Text className="text-xs text-muted mt-1">
                  Alert when similar charges appear
                </Text>
              </View>
              <Switch
                value={settings.duplicateChargeEnabled}
                onValueChange={(value) => handleToggleSetting('duplicateChargeEnabled', value)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.background}
              />
            </View>

            {/* Large Transaction */}
            <View className="mb-3">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground">Large Transactions</Text>
                  <Text className="text-xs text-muted mt-1">
                    Alert for transactions above threshold
                  </Text>
                </View>
                <Switch
                  value={settings.largeTransactionEnabled}
                  onValueChange={(value) => handleToggleSetting('largeTransactionEnabled', value)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>
              {settings.largeTransactionEnabled && (
                <View className="flex-row items-center gap-2 mt-2">
                  <Text className="text-xs text-muted">Threshold: ₦</Text>
                  <TextInput
                    value={settings.largeTransactionThreshold}
                    onChangeText={(text) => {
                      // Update locally first for immediate feedback
                      if (/^\d*$/.test(text)) {
                        handleUpdateThreshold(text);
                      }
                    }}
                    keyboardType="numeric"
                    placeholder="500"
                    placeholderTextColor={colors.muted}
                    className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-foreground text-sm"
                  />
                </View>
              )}
            </View>

            {/* Merchant Change */}
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-1">
                <Text className="text-sm font-medium text-foreground">Merchant Changes</Text>
                <Text className="text-xs text-muted mt-1">
                  Alert for unusual merchant activity
                </Text>
              </View>
              <Switch
                value={settings.merchantChangeEnabled}
                onValueChange={(value) => handleToggleSetting('merchantChangeEnabled', value)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.background}
              />
            </View>

            {/* Unusual Category */}
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-1">
                <Text className="text-sm font-medium text-foreground">Unusual Categories</Text>
                <Text className="text-xs text-muted mt-1">
                  Alert for spending in new categories
                </Text>
              </View>
              <Switch
                value={settings.unusualCategoryEnabled}
                onValueChange={(value) => handleToggleSetting('unusualCategoryEnabled', value)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.background}
              />
            </View>

            {/* Spending Spike */}
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-sm font-medium text-foreground">Spending Spikes</Text>
                <Text className="text-xs text-muted mt-1">
                  Alert for sudden spending increases
                </Text>
              </View>
              <Switch
                value={settings.spendingSpikeEnabled}
                onValueChange={(value) => handleToggleSetting('spendingSpikeEnabled', value)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.background}
              />
            </View>
          </View>
        )}

        {/* Alerts List */}
        {alerts && alerts.length > 0 ? (
          <View className="gap-3">
            {alerts.map((alert: any) => (
              <View
                key={alert.id}
                className="bg-surface rounded-2xl p-4 border"
                style={{ borderColor: getAlertColor(alert.severity) }}
              >
                <View className="flex-row items-start gap-3">
                  <Text className="text-3xl">{getAlertIcon(alert.alertType)}</Text>
                  <View className="flex-1">
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-base font-bold text-foreground flex-1">
                        {alert.title}
                      </Text>
                      <Text className="text-xs text-muted ml-2">
                        {formatDate(alert.createdAt)}
                      </Text>
                    </View>
                    <Text className="text-sm text-muted leading-relaxed mb-3">
                      {alert.message}
                    </Text>
                    {alert.actionUrl && (
                      <Text className="text-xs font-medium mb-3" style={{ color: colors.primary }}>
                        {alert.actionUrl}
                      </Text>
                    )}
                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        onPress={() => handleMarkAsRead(alert.id)}
                        activeOpacity={0.7}
                        className="flex-1 py-2 rounded-xl items-center"
                        style={{ backgroundColor: colors.primary + '20' }}
                      >
                        <Text className="text-xs font-semibold" style={{ color: colors.primary }}>
                          Mark as Read
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDismiss(alert.id)}
                        activeOpacity={0.7}
                        className="flex-1 py-2 rounded-xl items-center"
                        style={{ backgroundColor: colors.error + '20' }}
                      >
                        <Text className="text-xs font-semibold" style={{ color: colors.error }}>
                          Dismiss
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className="items-center py-12">
            <Text className="text-6xl mb-4">✅</Text>
            <Text className="text-xl font-bold text-foreground mb-2">All Caught Up!</Text>
            <Text className="text-sm text-muted text-center mb-6">
              No new spending alerts. We'll notify you of any unusual activity.
            </Text>
            <TouchableOpacity
              onPress={() => setShowSettings(true)}
              activeOpacity={0.7}
              className="px-6 py-3 rounded-full"
              style={{ backgroundColor: colors.primary }}
            >
              <Text className="text-sm font-semibold text-background">
                Configure Alerts
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
