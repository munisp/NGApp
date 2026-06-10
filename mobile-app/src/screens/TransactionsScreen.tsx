import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput,
  RefreshControl, ActivityIndicator,
} from 'react-native';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed' | 'reversed';
  sender: string;
  receiver: string;
  reference: string;
  date: string;
}

const SEED_TRANSACTIONS: Transaction[] = [
  { id: 'TXN001', type: 'NIP', amount: 250000, currency: 'NGN', status: 'completed', sender: 'GTBank', receiver: 'Access Bank', reference: 'NIP/2025/001234', date: '2025-05-02 14:30' },
  { id: 'TXN002', type: 'NEFT', amount: 1500000, currency: 'NGN', status: 'completed', sender: 'Zenith Bank', receiver: 'UBA', reference: 'NEFT/2025/005678', date: '2025-05-02 14:25' },
  { id: 'TXN003', type: 'Card', amount: 45000, currency: 'NGN', status: 'pending', sender: 'Merchant POS', receiver: 'First Bank', reference: 'CARD/2025/009012', date: '2025-05-02 14:20' },
  { id: 'TXN004', type: 'Remittance', amount: 2500, currency: 'USD', status: 'completed', sender: 'WorldRemit', receiver: 'Fidelity Bank', reference: 'RMT/2025/003456', date: '2025-05-02 14:15' },
  { id: 'TXN005', type: 'NIP', amount: 75000, currency: 'NGN', status: 'failed', sender: 'Stanbic IBTC', receiver: 'Sterling Bank', reference: 'NIP/2025/007890', date: '2025-05-02 14:10' },
  { id: 'TXN006', type: 'Government', amount: 180000, currency: 'NGN', status: 'completed', sender: 'FIRS', receiver: 'TSA', reference: 'GOV/2025/002345', date: '2025-05-02 14:05' },
  { id: 'TXN007', type: 'Trade', amount: 3500000, currency: 'NGN', status: 'completed', sender: 'Trade Corp', receiver: 'Wema Bank', reference: 'TRD/2025/006789', date: '2025-05-02 14:00' },
  { id: 'TXN008', type: 'NIP', amount: 120000, currency: 'NGN', status: 'reversed', sender: 'GTBank', receiver: 'Keystone Bank', reference: 'NIP/2025/001235', date: '2025-05-02 13:55' },
];

type FilterStatus = 'all' | 'completed' | 'pending' | 'failed';
const FILTERS: { label: string; value: FilterStatus }[] = [
  { label: 'All', value: 'all' },
  { label: 'Completed', value: 'completed' },
  { label: 'Pending', value: 'pending' },
  { label: 'Failed', value: 'failed' },
];

const STATUS_COLORS: Record<string, string> = {
  completed: '#10b981',
  pending: '#f59e0b',
  failed: '#ef4444',
  reversed: '#8b5cf6',
};

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>(SEED_TRANSACTIONS);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');

  const loadTransactions = useCallback(async () => {
    try {
      const res = await fetch('/api/trpc/transactions.list');
      const data = await res.json();
      if (data?.result?.data && Array.isArray(data.result.data)) {
        setTransactions(data.result.data);
      }
    } catch {
      // Graceful fallback to seed
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { setLoading(true); loadTransactions(); }, [loadTransactions]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTransactions();
  }, [loadTransactions]);

  const filtered = transactions.filter((tx) => {
    if (filter !== 'all' && tx.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return tx.reference.toLowerCase().includes(q) ||
        tx.sender.toLowerCase().includes(q) ||
        tx.receiver.toLowerCase().includes(q) ||
        tx.type.toLowerCase().includes(q);
    }
    return true;
  });

  const formatAmount = (tx: Transaction) =>
    tx.currency === 'USD' ? `$${tx.amount.toLocaleString()}` : `₦${tx.amount.toLocaleString()}`;

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <TouchableOpacity style={styles.txCard} activeOpacity={0.7}>
      <View style={styles.txTop}>
        <View style={styles.txTypeContainer}>
          <Text style={styles.txType}>{item.type}</Text>
          <Text style={styles.txRef}>{item.reference}</Text>
        </View>
        <Text style={styles.txAmount}>{formatAmount(item)}</Text>
      </View>
      <View style={styles.txBottom}>
        <Text style={styles.txParties}>{item.sender} → {item.receiver}</Text>
        <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[item.status] || '#6b7280') + '20' }]}>
          <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] || '#6b7280' }]}>
            {item.status}
          </Text>
        </View>
      </View>
      <Text style={styles.txDate}>{item.date}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Transactions</Text>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by reference, sender, or type..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#9ca3af"
        />
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterChip, filter === f.value && styles.filterChipActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[styles.filterText, filter === f.value && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderTransaction}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {search || filter !== 'all' ? 'No matching transactions' : 'No transactions yet'}
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { fontSize: 24, fontWeight: 'bold', color: '#111827', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  searchContainer: { paddingHorizontal: 16, marginBottom: 8 },
  searchInput: {
    backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, borderWidth: 1, borderColor: '#e5e7eb',
  },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12, gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb',
  },
  filterChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  filterText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  txCard: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  txTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  txTypeContainer: { flex: 1 },
  txType: { fontSize: 15, fontWeight: '600', color: '#111827' },
  txRef: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '700', color: '#111827' },
  txBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txParties: { fontSize: 13, color: '#6b7280', flex: 1 },
  statusBadge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  txDate: { fontSize: 11, color: '#9ca3af', marginTop: 6 },
  empty: { textAlign: 'center', padding: 32, color: '#9ca3af', fontSize: 14 },
});
