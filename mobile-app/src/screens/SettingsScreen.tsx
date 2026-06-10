import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Switch, ScrollView, StyleSheet, Alert } from 'react-native';

export default function SettingsScreen() {
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.sectionTitle}>Security</Text>
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Biometric Login</Text>
        <Switch value={biometricEnabled} onValueChange={setBiometricEnabled} />
      </View>
      <TouchableOpacity style={styles.settingRow} onPress={() => Alert.alert('2FA', 'Navigate to 2FA settings')}>
        <Text style={styles.settingLabel}>Two-Factor Authentication</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.settingRow} onPress={() => Alert.alert('Devices', 'Navigate to trusted devices')}>
        <Text style={styles.settingLabel}>Trusted Devices</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Notifications</Text>
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Push Notifications</Text>
        <Switch value={pushEnabled} onValueChange={setPushEnabled} />
      </View>

      <Text style={styles.sectionTitle}>Appearance</Text>
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Dark Mode</Text>
        <Switch value={darkMode} onValueChange={setDarkMode} />
      </View>

      <Text style={styles.sectionTitle}>About</Text>
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Version</Text>
        <Text style={styles.settingValue}>1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#6b7280', paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8, textTransform: 'uppercase' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  settingLabel: { fontSize: 16 },
  settingValue: { fontSize: 16, color: '#6b7280' },
  chevron: { fontSize: 24, color: '#9ca3af' },
});
