/**
 * Policy Detail Screen — Insurance Platform Mobile
 * Shows full policy details, beneficiaries, documents, and renewal CTA
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient, Policy } from '../services/api';

const COLORS = {
  primary: '#1E40AF',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  background: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1E293B',
  textSecondary: '#64748B',
  border: '#E2E8F0',
};

function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  );
}

export default function PolicyDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { policyId } = route.params ?? {};
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const [renewing, setRenewing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const loadPolicy = useCallback(async () => {
    try {
      const data = await apiClient.getPolicy(policyId);
      setPolicy(data);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to load policy');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [policyId, navigation]);

  useEffect(() => { loadPolicy(); }, [loadPolicy]);

  const handleRenew = async () => {
    if (!policy) return;
    Alert.alert('Renew Policy', `Renew for another year?\nPremium: ₦${Number(policy.premium).toLocaleString()}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm Renewal', onPress: async () => {
          setRenewing(true);
          try {
            await apiClient.renewPolicy(policy.id, { paymentMethod: 'card' });
            Alert.alert('Success', 'Policy renewed successfully!');
            loadPolicy();
          } catch (e: any) {
            Alert.alert('Error', e.message ?? 'Renewal failed');
          } finally {
            setRenewing(false);
          }
        }
      }
    ]);
  };

  const handleDownloadCertificate = async () => {
    if (!policy) return;
    setDownloading(true);
    try {
      const url = await apiClient.downloadPolicyCertificate(policy.id);
      Alert.alert('Certificate Ready', `Certificate available at:\n${url}`);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const handleFileClaim = () => {
    navigation.navigate('SubmitClaim', { policyId: policy?.id });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!policy) return null;

  const statusColor = policy.status === 'Active' ? COLORS.success : policy.status === 'Expired' ? COLORS.danger : COLORS.warning;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.policyHeader}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{policy.status}</Text>
          </View>
          <Text style={styles.policyName}>{policy.name}</Text>
          <Text style={styles.policyNumber}>{policy.policyNumber}</Text>
        </View>

        {/* Key Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Policy Details</Text>
          <View style={styles.card}>
            <InfoRow label="Type" value={policy.type} />
            <InfoRow label="Annual Premium" value={`₦${Number(policy.premium).toLocaleString()}`} />
            <InfoRow label="Start Date" value={policy.startDate ? new Date(policy.startDate).toLocaleDateString() : '—'} />
            <InfoRow label="Expiry Date" value={policy.expiryDate ? new Date(policy.expiryDate).toLocaleDateString() : '—'} valueColor={policy.status === 'Expired' ? COLORS.danger : undefined} />
            {policy.sumAssured && <InfoRow label="Sum Assured" value={`₦${Number(policy.sumAssured).toLocaleString()}`} />}
            {policy.deductible && <InfoRow label="Deductible" value={`₦${Number(policy.deductible).toLocaleString()}`} />}
          </View>
        </View>

        {/* Beneficiaries */}
        {policy.beneficiaries && policy.beneficiaries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Beneficiaries</Text>
            {policy.beneficiaries.map((b, i) => (
              <View key={i} style={styles.card}>
                <InfoRow label="Name" value={b.name} />
                <InfoRow label="Relationship" value={b.relationship} />
                <InfoRow label="Percentage" value={`${b.percentage}%`} />
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleFileClaim}>
              <Text style={styles.actionIcon}>📋</Text>
              <Text style={styles.actionLabel}>File Claim</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={handleDownloadCertificate} disabled={downloading}>
              <Text style={styles.actionIcon}>{downloading ? '⏳' : '📄'}</Text>
              <Text style={styles.actionLabel}>Certificate</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Renew CTA */}
        <TouchableOpacity
          style={[styles.renewBtn, renewing && styles.renewBtnDisabled]}
          onPress={handleRenew}
          disabled={renewing}
        >
          {renewing ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.renewBtnText}>🔄 Renew Policy</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingBottom: 32 },
  policyHeader: { backgroundColor: COLORS.card, borderRadius: 16, padding: 20, marginBottom: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 10 },
  statusText: { fontSize: 12, fontWeight: '700' },
  policyName: { fontSize: 20, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: 4 },
  policyNumber: { fontSize: 13, color: COLORS.textSecondary },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  card: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1, gap: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 14, color: COLORS.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '500', color: COLORS.text, textAlign: 'right', flex: 1, marginLeft: 16 },
  actionsGrid: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, backgroundColor: COLORS.card, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  actionIcon: { fontSize: 28, marginBottom: 6 },
  actionLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  renewBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  renewBtnDisabled: { opacity: 0.6 },
  renewBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
