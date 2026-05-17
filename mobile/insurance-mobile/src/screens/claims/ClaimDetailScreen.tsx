/**
 * Claim Detail Screen — Insurance Platform Mobile
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient, Claim, ClaimEvent } from '../services/api';

const COLORS = { primary: '#1E40AF', success: '#10B981', warning: '#F59E0B', danger: '#EF4444', background: '#F8FAFC', card: '#FFFFFF', text: '#1E293B', textSecondary: '#64748B', border: '#E2E8F0' };
const STATUS_COLORS: Record<string, string> = { Submitted: '#3B82F6', 'Under Review': COLORS.warning, Approved: COLORS.success, Rejected: COLORS.danger, Paid: COLORS.success };

export default function ClaimDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { claimId } = route.params ?? {};
  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);

  const loadClaim = useCallback(async () => {
    try {
      const data = await apiClient.getClaim(claimId);
      setClaim(data);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to load claim');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [claimId, navigation]);

  useEffect(() => { loadClaim(); }, [loadClaim]);

  if (loading) return <SafeAreaView style={styles.container}><View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View></SafeAreaView>;
  if (!claim) return null;

  const statusColor = STATUS_COLORS[claim.status] ?? COLORS.textSecondary;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}><Text style={[styles.statusText, { color: statusColor }]}>{claim.status}</Text></View>
          <Text style={styles.claimNumber}>{claim.claimNumber}</Text>
          <Text style={styles.claimType}>{claim.type}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Claim Details</Text>
          <View style={styles.card}>
            {[
              ['Amount Claimed', `₦${Number(claim.amount).toLocaleString()}`],
              claim.settledAmount ? ['Settled Amount', `₦${Number(claim.settledAmount).toLocaleString()}`] : null,
              ['Filed On', new Date(claim.createdAt).toLocaleDateString()],
              claim.description ? ['Description', claim.description] : null,
            ].filter(Boolean).map(([label, value], i) => (
              <View key={i} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={styles.infoValue}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        {claim.events && claim.events.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Timeline</Text>
            {claim.events.map((event: ClaimEvent, i: number) => (
              <View key={i} style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>{event.status}</Text>
                  <Text style={styles.timelineNote}>{event.note}</Text>
                  <Text style={styles.timelineDate}>{new Date(event.createdAt).toLocaleString()}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {claim.documents && claim.documents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Documents ({claim.documents.length})</Text>
            {claim.documents.map((doc, i) => (
              <View key={i} style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                <Text style={{ fontSize: 24 }}>📎</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docName}>{doc.fileName}</Text>
                  <Text style={styles.docType}>{doc.documentType}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingBottom: 32 },
  header: { backgroundColor: COLORS.card, borderRadius: 16, padding: 20, marginBottom: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 10 },
  statusText: { fontSize: 12, fontWeight: '700' },
  claimNumber: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 4, fontFamily: 'monospace' },
  claimType: { fontSize: 14, color: COLORS.textSecondary },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  card: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1, gap: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { fontSize: 14, color: COLORS.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '500', color: COLORS.text, textAlign: 'right', flex: 1, marginLeft: 16 },
  timelineItem: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.primary, marginTop: 4 },
  timelineContent: { flex: 1, backgroundColor: COLORS.card, borderRadius: 10, padding: 12 },
  timelineTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  timelineNote: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  timelineDate: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4 },
  docName: { fontSize: 14, fontWeight: '500', color: COLORS.text },
  docType: { fontSize: 12, color: COLORS.textSecondary },
});
