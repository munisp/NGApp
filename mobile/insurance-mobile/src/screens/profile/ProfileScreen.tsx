/**
 * Profile Screen — Insurance Platform Mobile
 * Full CRUD: view/edit profile, notification preferences, logout
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../services/api';

const COLORS = { primary: '#1E40AF', success: '#10B981', danger: '#EF4444', background: '#F8FAFC', card: '#FFFFFF', text: '#1E293B', textSecondary: '#64748B', border: '#E2E8F0' };

export default function ProfileScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [notifPrefs, setNotifPrefs] = useState({ email: true, sms: true, push: true, whatsapp: false });

  const loadProfile = useCallback(async () => {
    try {
      const data = await apiClient.getUserProfile();
      setProfile(data);
      setFirstName(data.firstName ?? '');
      setLastName(data.lastName ?? '');
      setPhone(data.phone ?? '');
      const prefs = await apiClient.getNotificationPreferences();
      setNotifPrefs(prefs);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.updateNotificationPreferences(notifPrefs);
      Alert.alert('Success', 'Profile updated successfully');
      setEditing(false);
      loadProfile();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { await apiClient.logout(); } },
    ]);
  };

  if (loading) return <SafeAreaView style={styles.container}><View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{(firstName[0] ?? 'U').toUpperCase()}{(lastName[0] ?? '').toUpperCase()}</Text></View>
            <Text style={styles.profileName}>{firstName} {lastName}</Text>
            <Text style={styles.profileEmail}>{profile?.email ?? ''}</Text>
          </View>

          {/* Personal Info */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Personal Information</Text>
              <TouchableOpacity onPress={() => setEditing(!editing)}>
                <Text style={styles.editBtn}>{editing ? 'Cancel' : '✏️ Edit'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.card}>
              {editing ? (
                <>
                  <View style={styles.inputGroup}><Text style={styles.inputLabel}>First Name</Text><TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholderTextColor={COLORS.textSecondary} /></View>
                  <View style={styles.inputGroup}><Text style={styles.inputLabel}>Last Name</Text><TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholderTextColor={COLORS.textSecondary} /></View>
                  <View style={styles.inputGroup}><Text style={styles.inputLabel}>Phone</Text><TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor={COLORS.textSecondary} /></View>
                </>
              ) : (
                <>
                  {[['First Name', firstName], ['Last Name', lastName], ['Email', profile?.email ?? '—'], ['Phone', phone || '—']].map(([label, value], i) => (
                    <View key={i} style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>
                  ))}
                </>
              )}
            </View>
          </View>

          {/* Notification Preferences */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            <View style={styles.card}>
              {[
                { key: 'email', label: 'Email Notifications' },
                { key: 'sms', label: 'SMS Notifications' },
                { key: 'push', label: 'Push Notifications' },
                { key: 'whatsapp', label: 'WhatsApp Messages' },
              ].map(({ key, label }) => (
                <View key={key} style={styles.switchRow}>
                  <Text style={styles.switchLabel}>{label}</Text>
                  <Switch
                    value={(notifPrefs as any)[key]}
                    onValueChange={v => setNotifPrefs(prev => ({ ...prev, [key]: v }))}
                    trackColor={{ false: COLORS.border, true: COLORS.primary + '80' }}
                    thumbColor={(notifPrefs as any)[key] ? COLORS.primary : '#f4f3f4'}
                  />
                </View>
              ))}
            </View>
          </View>

          {editing && (
            <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          )}

          {/* Logout */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutBtnText}>🚪 Logout</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingBottom: 32 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { color: '#FFFFFF', fontSize: 28, fontWeight: '700' },
  profileName: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  profileEmail: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  section: { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  editBtn: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  card: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1, gap: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { fontSize: 14, color: COLORS.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '500', color: COLORS.text },
  inputGroup: { gap: 4 },
  inputLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  input: { backgroundColor: COLORS.background, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontSize: 14, color: COLORS.text },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  logoutBtn: { backgroundColor: COLORS.danger + '15', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.danger + '30' },
  logoutBtnText: { color: COLORS.danger, fontSize: 15, fontWeight: '700' },
});
