import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Text, Switch, Card } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { pushNotificationService, NotificationSettings } from '../../services/PushNotifications';
import { spacing, typography, theme } from '../../utils/theme';
import { t } from '../../services/i18n';

export default function NotificationSettingsScreen({ navigation }: any) {
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true,
    policyReminders: true,
    paymentReminders: true,
    claimUpdates: true,
    promotions: false,
    securityAlerts: true,
  });
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [savedSettings, permission] = await Promise.all([
        pushNotificationService.getSettings(),
        pushNotificationService.checkPermissions(),
      ]);
      setSettings(savedSettings);
      setHasPermission(permission);
    } catch (error) {
      console.error('Error loading notification settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: keyof NotificationSettings, value: boolean) => {
    if (key === 'enabled' && value && !hasPermission) {
      const granted = await pushNotificationService.requestPermissions();
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'Please enable notifications in your device settings to receive updates.',
          [{ text: 'OK' }]
        );
        return;
      }
      setHasPermission(true);
    }

    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await pushNotificationService.updateSettings({ [key]: value });
  };

  const renderSettingItem = (
    key: keyof NotificationSettings,
    title: string,
    description: string,
    icon: string
  ) => (
    <View style={styles.settingItem}>
      <View style={styles.settingIcon}>
        <Icon name={icon} size={24} color={theme.colors.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <Switch
        value={settings[key]}
        onValueChange={(value) => handleToggle(key, value)}
        disabled={key !== 'enabled' && !settings.enabled}
        color={theme.colors.primary}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.notifications')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            {renderSettingItem(
              'enabled',
              'Push Notifications',
              'Receive notifications on your device',
              'bell'
            )}
          </Card.Content>
        </Card>

        <Text style={styles.sectionTitle}>Notification Types</Text>
        <Card style={[styles.card, !settings.enabled && styles.cardDisabled]}>
          <Card.Content>
            {renderSettingItem(
              'policyReminders',
              'Policy Reminders',
              'Renewal dates, expiry alerts, and policy updates',
              'shield-alert'
            )}
            <View style={styles.divider} />
            {renderSettingItem(
              'paymentReminders',
              'Payment Reminders',
              'Due dates, payment confirmations, and receipts',
              'cash-clock'
            )}
            <View style={styles.divider} />
            {renderSettingItem(
              'claimUpdates',
              'Claim Updates',
              'Status changes, approvals, and payouts',
              'file-document-edit'
            )}
            <View style={styles.divider} />
            {renderSettingItem(
              'securityAlerts',
              'Security Alerts',
              'Login attempts, password changes, and suspicious activity',
              'shield-lock'
            )}
            <View style={styles.divider} />
            {renderSettingItem(
              'promotions',
              'Promotions & Offers',
              'Special deals, discounts, and new products',
              'tag'
            )}
          </Card.Content>
        </Card>

        <Text style={styles.infoText}>
          You can also manage notification settings in your device's system settings.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
    color: theme.colors.text,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
  },
  card: {
    marginBottom: spacing.sm,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  settingContent: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingTitle: {
    ...typography.body,
    fontWeight: '600',
    color: theme.colors.text,
  },
  settingDescription: {
    ...typography.small,
    color: theme.colors.textSecondary,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: spacing.sm,
  },
  infoText: {
    ...typography.small,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
});
