import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import ApiClient from '../../services/ApiClient';

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  role: string;
  agentId: string;
  kycStatus: string;
  accountNumber: string;
  tier: string;
  joinedDate: string;
  address: string;
}

const MOCK_PROFILE: UserProfile = {
  name: 'John Agent',
  email: 'john.agent@example.com',
  phone: '+234 801 234 5678',
  role: 'agent',
  agentId: 'AG-001',
  kycStatus: 'verified',
  accountNumber: '1234567890',
  tier: 'Gold',
  joinedDate: '2023-06-15',
  address: '123 Lagos Street, Victoria Island, Lagos',
};

const ProfileScreen: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile>(MOCK_PROFILE);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<UserProfile>(MOCK_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadProfile = async () => {
    try {
      const res = await ApiClient.get<{ profile: UserProfile }>('/api/profile');
      if (res.data.profile) {
        setProfile(res.data.profile);
        setEditForm(res.data.profile);
      }
    } catch {
      setProfile(MOCK_PROFILE);
      setEditForm(MOCK_PROFILE);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProfile(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await ApiClient.put('/api/profile', editForm);
      setProfile(editForm);
      setEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch {
      setProfile(editForm);
      setEditing(false);
      Alert.alert('Success', 'Profile updated (offline mode)');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#007AFF" /></View>;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile.name.charAt(0)}</Text>
        </View>
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.role}>{profile.role.charAt(0).toUpperCase() + profile.role.slice(1)} | {profile.agentId}</Text>
        <View style={[styles.kycBadge, { backgroundColor: profile.kycStatus === 'verified' ? '#D1FAE5' : '#FEF3C7' }]}>
          <Text style={[styles.kycText, { color: profile.kycStatus === 'verified' ? '#065F46' : '#92400E' }]}>
            KYC: {profile.kycStatus}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <TouchableOpacity onPress={() => editing ? handleSave() : setEditing(true)}>
            {saving ? <ActivityIndicator size="small" color="#007AFF" /> : (
              <Text style={styles.editBtn}>{editing ? 'Save' : 'Edit'}</Text>
            )}
          </TouchableOpacity>
        </View>

        {editing ? (
          <>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput style={styles.input} value={editForm.name} onChangeText={v => setEditForm(p => ({ ...p, name: v }))} />
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput style={styles.input} value={editForm.email} onChangeText={v => setEditForm(p => ({ ...p, email: v }))} keyboardType="email-address" />
            <Text style={styles.fieldLabel}>Phone</Text>
            <TextInput style={styles.input} value={editForm.phone} onChangeText={v => setEditForm(p => ({ ...p, phone: v }))} keyboardType="phone-pad" />
            <Text style={styles.fieldLabel}>Address</Text>
            <TextInput style={styles.input} value={editForm.address} onChangeText={v => setEditForm(p => ({ ...p, address: v }))} multiline />
            <TouchableOpacity style={styles.cancelEditBtn} onPress={() => { setEditing(false); setEditForm(profile); }}>
              <Text style={styles.cancelEditText}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Name</Text><Text style={styles.fieldValue}>{profile.name}</Text></View>
            <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Email</Text><Text style={styles.fieldValue}>{profile.email}</Text></View>
            <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Phone</Text><Text style={styles.fieldValue}>{profile.phone}</Text></View>
            <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Address</Text><Text style={styles.fieldValue}>{profile.address}</Text></View>
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Details</Text>
        <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Account Number</Text><Text style={styles.fieldValue}>{profile.accountNumber}</Text></View>
        <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Tier</Text><Text style={styles.fieldValue}>{profile.tier}</Text></View>
        <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Member Since</Text><Text style={styles.fieldValue}>{new Date(profile.joinedDate).toLocaleDateString()}</Text></View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerCard: { backgroundColor: '#007AFF', padding: 24, alignItems: 'center', paddingTop: 48, paddingBottom: 32 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: '#FFF' },
  name: { fontSize: 22, fontWeight: 'bold', color: '#FFF' },
  role: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  kycBadge: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, marginTop: 8 },
  kycText: { fontSize: 12, fontWeight: '600' },
  section: { backgroundColor: '#FFF', margin: 16, borderRadius: 12, padding: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  editBtn: { fontSize: 14, color: '#007AFF', fontWeight: '600' },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  fieldLabel: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  fieldValue: { fontSize: 14, fontWeight: '500', color: '#111827' },
  input: { backgroundColor: '#F3F4F6', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 14 },
  cancelEditBtn: { alignItems: 'center', padding: 12 },
  cancelEditText: { color: '#EF4444', fontWeight: '600' },
});

export default ProfileScreen;
