/**
 * Claims Screen — Insurance Platform Mobile
 * Full CRUD: list, filter, view, submit claims
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient, Claim } from '../services/api';

const COLORS = {
  primary: '#1E40AF',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  background: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1E293B',
  textSecondary: '#64748B',
  border: '#E2E8F0',
};

const STATUS_COLORS: Record<string, string> = {
  Submitted: COLORS.info,
  'Under Review': COLORS.warning,
  Approved: COLORS.success,
  Rejected: COLORS.danger,
  Paid: COLORS.success,
  Closed: COLORS.textSecondary,
};

function ClaimCard({ claim, onPress }: { claim: Claim; onPress: () => void }) {
  const statusColor = STATUS_COLORS[claim.status] ?? COLORS.textSecondary;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <Text style={styles.claimNumber}>{claim.claimNumber}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{claim.status}</Text>
        </View>
      </View>
      <Text style={styles.claimType}>{claim.type}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Amount Claimed</Text>
        <Text style={styles.metaValue}>₦{Number(claim.amount).toLocaleString()}</Text>
      </View>
      {claim.settledAmount && (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Settled Amount</Text>
          <Text style={[styles.metaValue, { color: COLORS.success }]}>₦{Number(claim.settledAmount).toLocaleString()}</Text>
        </View>
      )}
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Filed On</Text>
        <Text style={styles.metaValue}>{new Date(claim.createdAt).toLocaleDateString()}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function ClaimsScreen() {
  const navigation = useNavigation<any>();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const loadClaims = useCallback(async () => {
    try {
      const data = await apiClient.getClaims();
      setClaims(data);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to load claims');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadClaims(); }, [loadClaims]);

  const filtered = claims.filter(c => {
    const matchSearch = !search || c.claimNumber.toLowerCase().includes(search.toLowerCase()) || c.type.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const STATUSES = ['All', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Paid'];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Claims</Text>
        <TouchableOpacity style={styles.newClaimBtn} onPress={() => navigation.navigate('SubmitClaim', {})}>
          <Text style={styles.newClaimBtnText}>+ New Claim</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search claims..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      <FlatList
        horizontal
        data={STATUSES}
        keyExtractor={s => s}
        renderItem={({ item: s }) => (
          <TouchableOpacity
            style={[styles.filterBtn, statusFilter === s && styles.filterBtnActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.filterBtnText, statusFilter === s && styles.filterBtnTextActive]}>{s}</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.filterRow}
        showsHorizontalScrollIndicator={false}
      />

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ClaimCard
            claim={item}
            onPress={() => navigation.navigate('ClaimDetail', { claimId: item.id })}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadClaims(); }} colors={[COLORS.primary]} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No claims found</Text>
            <Text style={styles.emptySubtitle}>File your first claim to get started</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('SubmitClaim', {})}>
              <Text style={styles.emptyBtnText}>File a Claim</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  newClaimBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  newClaimBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  searchContainer: { paddingHorizontal: 16, marginBottom: 8 },
  searchInput: { backgroundColor: COLORS.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  filterRow: { paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  filterBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterBtnText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  filterBtnTextActive: { color: '#FFFFFF' },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  card: { backgroundColor: COLORS.card, borderRadius: 12, marginBottom: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, gap: 6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  claimNumber: { fontSize: 14, fontWeight: '700', color: COLORS.text, fontFamily: 'monospace' },
  claimType: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '600' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaLabel: { fontSize: 13, color: COLORS.textSecondary },
  metaValue: { fontSize: 13, fontWeight: '500', color: COLORS.text },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 20 },
  emptyBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
});
