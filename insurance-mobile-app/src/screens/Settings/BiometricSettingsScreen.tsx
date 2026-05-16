import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Text, Switch, Card } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BiometricAuthService, BiometricCapabilities } from '../../services/BiometricAuth';
import { spacing, typography, theme } from '../../utils/theme';
import { t } from '../../services/i18n';

export default function BiometricSettingsScreen({ navigation }: any) {
  const [capabilities, setCapabilities] = useState<BiometricCapabilities | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBiometricStatus();
  }, []);

  const loadBiometricStatus = async () => {
    try {
      const [caps, enabled] = await Promise.all([
        BiometricAuthService.checkCapabilities(),
        BiometricAuthService.isBiometricEnabled(),
      ]);
      setCapabilities(caps);
      setBiometricEnabled(enabled);
    } catch (error) {
      console.error('Error loading biometric status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBiometric = async (value: boolean) => {
    if (value) {
      if (!capabilities?.isAvailable) {
        Alert.alert(
          'Not Available',
          'Biometric authentication is not available on this device.',
          [{ text: 'OK' }]
        );
        return;
      }

      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        Alert.alert(
          'Error',
          'Please sign in first to enable biometric login.',
          [{ text: 'OK' }]
        );
        return;
      }

      const success = await BiometricAuthService.enableBiometric(token);
      if (success) {
        setBiometricEnabled(true);
        Alert.alert(
          'Success',
          `${BiometricAuthService.getBiometricTypeName(capabilities.biometricType)} login has been enabled.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Failed',
          'Could not enable biometric login. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } else {
      Alert.alert(
        'Disable Biometric Login',
        'Are you sure you want to disable biometric login?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              const success = await BiometricAuthService.disableBiometric();
              if (success) {
                setBiometricEnabled(false);
              }
            },
          },
        ]
      );
    }
  };

  const getBiometricIcon = () => {
    if (!capabilities) return 'fingerprint';
    switch (capabilities.biometricType) {
      case 'facial':
        return 'face-recognition';
      case 'iris':
        return 'eye';
      default:
        return 'fingerprint';
    }
  };

  const getBiometricName = () => {
    if (!capabilities) return 'Biometric';
    return BiometricAuthService.getBiometricTypeName(capabilities.biometricType);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.biometric')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.iconContainer}>
          <View style={styles.biometricIcon}>
            <Icon name={getBiometricIcon()} size={64} color={theme.colors.primary} />
          </View>
          <Text style={styles.biometricName}>{getBiometricName()}</Text>
          <Text style={styles.biometricStatus}>
            {capabilities?.isAvailable
              ? biometricEnabled
                ? 'Enabled'
                : 'Available'
              : 'Not Available'}
          </Text>
        </View>

        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Enable {getBiometricName()} Login</Text>
                <Text style={styles.settingDescription}>
                  Use {getBiometricName()} to quickly sign in to your account
                </Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={handleToggleBiometric}
                disabled={!capabilities?.isAvailable || loading}
                color={theme.colors.primary}
              />
            </View>
          </Card.Content>
        </Card>

        {capabilities?.isAvailable && (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.infoTitle}>How it works</Text>
              <View style={styles.infoItem}>
                <Icon name="numeric-1-circle" size={24} color={theme.colors.primary} />
                <Text style={styles.infoText}>
                  Your {getBiometricName()} is stored securely on your device
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Icon name="numeric-2-circle" size={24} color={theme.colors.primary} />
                <Text style={styles.infoText}>
                  When you sign in, your device verifies your identity
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Icon name="numeric-3-circle" size={24} color={theme.colors.primary} />
                <Text style={styles.infoText}>
                  Your credentials are never sent to our servers
                </Text>
              </View>
            </Card.Content>
          </Card>
        )}

        {!capabilities?.isAvailable && (
          <Card style={[styles.card, styles.warningCard]}>
            <Card.Content>
              <View style={styles.warningContent}>
                <Icon name="alert-circle" size={24} color={theme.colors.warning} />
                <View style={styles.warningText}>
                  <Text style={styles.warningTitle}>Biometric Not Available</Text>
                  <Text style={styles.warningDescription}>
                    Your device doesn't support biometric authentication or it hasn't been set up.
                    Please check your device settings.
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        )}

        <Text style={styles.securityNote}>
          <Icon name="shield-check" size={14} color={theme.colors.success} /> Your biometric data
          never leaves your device and is protected by your device's secure enclave.
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
  iconContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  biometricIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  biometricName: {
    ...typography.h2,
    color: theme.colors.text,
  },
  biometricStatus: {
    ...typography.body,
    color: theme.colors.textSecondary,
    marginTop: spacing.xs,
  },
  card: {
    marginBottom: spacing.md,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
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
  infoTitle: {
    ...typography.body,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: spacing.md,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  infoText: {
    ...typography.body,
    color: theme.colors.text,
    flex: 1,
    marginLeft: spacing.md,
  },
  warningCard: {
    backgroundColor: theme.colors.warning + '10',
  },
  warningContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  warningText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  warningTitle: {
    ...typography.body,
    fontWeight: '600',
    color: theme.colors.warning,
  },
  warningDescription: {
    ...typography.small,
    color: theme.colors.textSecondary,
    marginTop: spacing.xs,
  },
  securityNote: {
    ...typography.small,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
});
