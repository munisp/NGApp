import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

interface MetricData {
  label: string;
  value: string;
  change: string;
  positive: boolean;
}

interface RecentTransaction {
  id: string;
  type: string;
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  time: string;
}

const SEED_METRICS: MetricData[] = [
  { label: 'Total Volume', value: '₦2.4B', change: '+12.5%', positive: true },
  { label: 'Transactions', value: '54,231', change: '+8.3%', positive: true },
  { label: 'Success Rate', value: '99.7%', change: '+0.2%', positive: true },
  { label: 'Active Users', value: '1,247', change: '-2.1%', positive: false },
];

const SEED_TRANSACTIONS: RecentTransaction[] = [
  { id: '1', type: 'NIP Transfer', amount: 250000, status: 'completed', time: '2 min ago' },
  { id: '2', type: 'Card Payment', amount: 45000, status: 'completed', time: '5 min ago' },
  { id: '3', type: 'Outbound Remittance', amount: 1200000, status: 'pending', time: '8 min ago' },
  { id: '4', type: 'Government Payment', amount: 180000, status: 'completed', time: '12 min ago' },
  { id: '5', type: 'NIP Transfer', amount: 75000, status: 'failed', time: '15 min ago' },
  { id: '6', type: 'Trade Payment', amount: 3500000, status: 'completed', time: '20 min ago' },
];

const STATUS_COLORS: Record<string, string> = {
  completed: '#10b981',
  pending: '#f59e0b',
  failed: '#ef4444',
};

export default function DashboardScreen() {
  const [metrics, setMetrics] = useState<MetricData[]>(SEED_METRICS);
  const [transactions, setTransactions] = useState<RecentTransaction[]>(SEED_TRANSACTIONS);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/trpc/dashboard.getStats');
      const data = await res.json();
      if (data?.result?.data) {
        setMetrics(data.result.data.metrics ?? SEED_METRICS);
        setTransactions(data.result.data.recentTransactions ?? SEED_TRANSACTIONS);
      }
    } catch {
      // Graceful fallback to seed data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
    >
      <Text style={styles.header}>NOC Dashboard</Text>
      <Text style={styles.subHeader}>Real-time payment switch overview</Text>

      {/* Metrics Grid */}
      <View style={styles.metricsGrid}>
        {metrics.map((m) => (
          <View key={m.label} style={styles.metricCard}>
            <Text style={styles.metricLabel}>{m.label}</Text>
            <Text style={styles.metricValue}>{m.value}</Text>
            <Text style={[styles.metricChange, { color: m.positive ? '#10b981' : '#ef4444' }]}>
              {m.change}
            </Text>
          </View>
        ))}
      </View>

      {/* System Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>System Health</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
          <Text style={styles.statusLabel}>Payment Engine</Text>
          <Text style={[styles.statusValue, { color: '#10b981' }]}>Operational</Text>
        </View>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
          <Text style={styles.statusLabel}>Settlement Service</Text>
          <Text style={[styles.statusValue, { color: '#10b981' }]}>Operational</Text>
        </View>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: '#f59e0b' }]} />
          <Text style={styles.statusLabel}>Fraud Detection</Text>
          <Text style={[styles.statusValue, { color: '#f59e0b' }]}>Degraded</Text>
        </View>
      </View>

      {/* Recent Transactions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        {transactions.map((tx) => (
          <TouchableOpacity key={tx.id} style={styles.txRow} activeOpacity={0.7}>
            <View style={styles.txInfo}>
              <Text style={styles.txType}>{tx.type}</Text>
              <Text style={styles.txTime}>{tx.time}</Text>
            </View>
            <View style={styles.txRight}>
              <Text style={styles.txAmount}>₦{tx.amount.toLocaleString()}</Text>
              <View style={[styles.txStatus, { backgroundColor: STATUS_COLORS[tx.status] + '20' }]}>
                <Text style={[styles.txStatusText, { color: STATUS_COLORS[tx.status] }]}>
                  {tx.status}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  header: { fontSize: 24, fontWeight: 'bold', color: '#111827', paddingHorizontal: 16, paddingTop: 16 },
  subHeader: { fontSize: 14, color: '#6b7280', paddingHorizontal: 16, marginBottom: 16 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  metricCard: {
    width: '46%', backgroundColor: '#fff', borderRadius: 12, padding: 16, margin: '2%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  metricLabel: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  metricValue: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  metricChange: { fontSize: 12, fontWeight: '500', marginTop: 4 },
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  statusLabel: { flex: 1, fontSize: 14, color: '#374151' },
  statusValue: { fontSize: 13, fontWeight: '500' },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  txInfo: { flex: 1 },
  txType: { fontSize: 14, fontWeight: '500', color: '#111827' },
  txTime: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontSize: 14, fontWeight: '600', color: '#111827' },
  txStatus: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
  txStatusText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
});
