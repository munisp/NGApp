/**
 * Policies Screen — Insurance Platform Mobile
 * Full CRUD: list, view, renew, cancel policies
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

function PolicyCard({ policy, onPress, onRenew }: { policy: Policy; onPress: () => void; onRenew: () => void }) {
  const statusColor = policy.status === 'Active' ? COLORS.success : policy.status === 'Expired' ? COLORS.danger : COLORS.warning;
  const isExpiringSoon = policy.expiryDate && new Date(policy.expiryDate).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.policyName} numberOfLines={1}>{policy.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{policy.status}</Text>
          </View>
        </View>
        <Text style={styles.policyNumber}>{policy.policyNumber}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Type</Text>
          <Text style={styles.metaValue}>{policy.type}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Premium</Text>
          <Text style={styles.metaValue}>₦{Number(policy.premium).toLocaleString()}/yr</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Expires</Text>
          <Text style={[styles.metaValue, isExpiringSoon && { color: COLORS.warning }]}>
            {policy.expiryDate ? new Date(policy.expiryDate).toLocaleDateString() : '—'}
            {isExpiringSoon ? ' ⚠️' : ''}
          </Text>
        </View>
      </View>
      {(policy.status === 'Active' || policy.status === 'Expired') && (
        <TouchableOpacity style={styles.renewBtn} onPress={onRenew}>
          <Text style={styles.renewBtnText}>🔄 Renew Policy</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

export default function PoliciesScreen() {
  const navigation = useNavigation<any>();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Active' | 'Expired' | 'Pending'>('All');
  const [renewingId, setRenewingId] = useState<string | null>(null);

  const loadPolicies = useCallback(async () => {
    try {
      const data = await apiClient.getPolicies();
      setPolicies(data);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to load policies');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadPolicies(); }, [loadPolicies]);

  const handleRenew = useCallback(async (policy: Policy) => {
    Alert.alert(
      'Renew Policy',
      `Renew "${policy.name}" for another year?\nPremium: ₦${Number(policy.premium).toLocaleString()}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Renew',
          onPress: async () => {
            setRenewingId(policy.id);
            try {
              await apiClient.renewPolicy(policy.id, { paymentMethod: 'card' });
              Alert.alert('Success', 'Policy renewed successfully!');
              loadPolicies();
            } catch (e: any) {
              Alert.alert('Error', e.message ?? 'Renewal failed');
            } finally {
              setRenewingId(null);
            }
          },
        },
      ]
    );
  }, [loadPolicies]);

  const filtered = policies.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.policyNumber.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'All' || p.status === filter;
    return matchSearch && matchFilter;
  });

  const FILTERS: Array<'All' | 'Active' | 'Expired' | 'Pending'> = ['All', 'Active', 'Expired', 'Pending'];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading policies...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Policies</Text>
        <Text style={styles.subtitle}>{policies.length} total policies</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search policies..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterBtnText, filter === f && styles.filterBtnTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <PolicyCard
            policy={item}
            onPress={() => navigation.navigate('PolicyDetail', { policyId: item.id })}
            onRenew={() => handleRenew(item)}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPolicies(); }} colors={[COLORS.primary]} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.emptyTitle}>No policies found</Text>
            <Text style={styles.emptySubtitle}>
              {search ? 'Try a different search term' : 'You have no policies yet'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: COLORS.textSecondary, fontSize: 14 },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  searchContainer: { paddingHorizontal: 16, marginBottom: 8 },
  searchInput: { backgroundColor: COLORS.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  filterBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterBtnText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  filterBtnTextActive: { color: '#FFFFFF' },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  card: { backgroundColor: COLORS.card, borderRadius: 12, marginBottom: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardHeader: { marginBottom: 12 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  policyName: { fontSize: 16, fontWeight: '600', color: COLORS.text, flex: 1, marginRight: 8 },
  policyNumber: { fontSize: 12, color: COLORS.textSecondary },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '600' },
  cardBody: { gap: 6 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaLabel: { fontSize: 13, color: COLORS.textSecondary },
  metaValue: { fontSize: 13, fontWeight: '500', color: COLORS.text },
  renewBtn: { marginTop: 12, backgroundColor: COLORS.primary + '15', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  renewBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
});
