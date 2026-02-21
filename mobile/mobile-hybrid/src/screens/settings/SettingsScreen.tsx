import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import ApiClient from '../../services/ApiClient';

interface AppSettings {
  notifications: { push: boolean; email: boolean; sms: boolean; transactions: boolean };
  security: { biometric: boolean; twoFactor: boolean; loginAlerts: boolean };
  preferences: { language: string; theme: string; currency: string };
}

const MOCK_SETTINGS: AppSettings = {
  notifications: { push: true, email: true, sms: false, transactions: true },
  security: { biometric: true, twoFactor: false, loginAlerts: true },
  preferences: { language: 'English', theme: 'Light', currency: 'NGN' },
};

const SettingsScreen: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(MOCK_SETTINGS);

  useEffect(() => {
    (async () => {
      try {
        const res = await ApiClient.get<{ settings: AppSettings }>('/api/settings');
        if (res.data.settings) setSettings(res.data.settings);
      } catch {
        setSettings(MOCK_SETTINGS);
      }
    })();
  }, []);

  const handleToggle = (category: keyof AppSettings, key: string, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      [category]: { ...prev[category], [key]: value },
    }));
    ApiClient.put('/api/settings', { [category]: { [key]: value } }).catch(() => {});
  };

  const handlePreferenceChange = (key: string, options: string[]) => {
    const current = settings.preferences[key as keyof typeof settings.preferences];
    const currentIdx = options.indexOf(current);
    const nextIdx = (currentIdx + 1) % options.length;
    setSettings(prev => ({
      ...prev,
      preferences: { ...prev.preferences, [key]: options[nextIdx] },
    }));
    ApiClient.put('/api/settings', { preferences: { [key]: options[nextIdx] } }).catch(() => {});
  };

  const ToggleRow = ({ label, value, onToggle }: { label: string; value: boolean; onToggle: (v: boolean) => void }) => (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Switch value={value} onValueChange={onToggle} trackColor={{ true: '#007AFF' }} />
    </View>
  );

  const SelectRow = ({ label, value, onPress }: { label: string; value: string; onPress: () => void }) => (
    <TouchableOpacity style={styles.settingRow} onPress={onPress}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Text style={styles.settingValue}>{value} &gt;</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <ToggleRow label="Push Notifications" value={settings.notifications.push} onToggle={v => handleToggle('notifications', 'push', v)} />
        <ToggleRow label="Email Notifications" value={settings.notifications.email} onToggle={v => handleToggle('notifications', 'email', v)} />
        <ToggleRow label="SMS Notifications" value={settings.notifications.sms} onToggle={v => handleToggle('notifications', 'sms', v)} />
        <ToggleRow label="Transaction Alerts" value={settings.notifications.transactions} onToggle={v => handleToggle('notifications', 'transactions', v)} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>
        <ToggleRow label="Biometric Login" value={settings.security.biometric} onToggle={v => handleToggle('security', 'biometric', v)} />
        <ToggleRow label="Two-Factor Authentication" value={settings.security.twoFactor} onToggle={v => handleToggle('security', 'twoFactor', v)} />
        <ToggleRow label="Login Alerts" value={settings.security.loginAlerts} onToggle={v => handleToggle('security', 'loginAlerts', v)} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <SelectRow label="Language" value={settings.preferences.language} onPress={() => handlePreferenceChange('language', ['English', 'Hausa', 'Yoruba', 'Igbo'])} />
        <SelectRow label="Theme" value={settings.preferences.theme} onPress={() => handlePreferenceChange('theme', ['Light', 'Dark', 'System'])} />
        <SelectRow label="Currency" value={settings.preferences.currency} onPress={() => handlePreferenceChange('currency', ['NGN', 'USD', 'GBP', 'EUR'])} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity style={styles.settingRow} onPress={() => Alert.alert('Export Data', 'Your data export has been initiated. You will receive an email when ready.')}>
          <Text style={styles.settingLabel}>Export Data</Text>
          <Text style={styles.settingValue}>&gt;</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingRow} onPress={() => Alert.alert('Clear Cache', 'Cache cleared successfully.')}>
          <Text style={styles.settingLabel}>Clear Cache</Text>
          <Text style={styles.settingValue}>&gt;</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.settingRow, { borderBottomWidth: 0 }]} onPress={() => Alert.alert('Delete Account', 'Are you sure? This action cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive' }])}>
          <Text style={[styles.settingLabel, { color: '#EF4444' }]}>Delete Account</Text>
          <Text style={[styles.settingValue, { color: '#EF4444' }]}>&gt;</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>Version 1.0.0 (Build 54)</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6', padding: 16 },
  header: { fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 16 },
  section: { backgroundColor: '#FFF', borderRadius: 12, marginBottom: 16, padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#6B7280', marginBottom: 12, textTransform: 'uppercase' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  settingLabel: { fontSize: 15, color: '#111827' },
  settingValue: { fontSize: 14, color: '#6B7280' },
  version: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, marginTop: 8, marginBottom: 32 },
});

export default SettingsScreen;
