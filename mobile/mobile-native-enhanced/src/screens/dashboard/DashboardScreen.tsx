import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import ApiClient from '../../services/ApiClient';

interface DashboardStats {
  totalTransactions: number;
  totalAmount: number;
  activeAgents: number;
  securityAlerts: number;
}

interface RecentTransaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string;
  created_at: string;
}

const MOCK_STATS: DashboardStats = {
  totalTransactions: 234567,
  totalAmount: 15750000,
  activeAgents: 1247,
  securityAlerts: 12,
};

const MOCK_TRANSACTIONS: RecentTransaction[] = [
  { id: 'TXN-001', type: 'deposit', amount: 50000, status: 'completed', description: 'Cash deposit - John Doe', created_at: new Date().toISOString() },
  { id: 'TXN-002', type: 'withdrawal', amount: 25000, status: 'processing', description: 'ATM withdrawal - Jane Smith', created_at: new Date().toISOString() },
  { id: 'TXN-003', type: 'transfer', amount: 15000, status: 'completed', description: 'Bank transfer - Mike Johnson', created_at: new Date().toISOString() },
  { id: 'TXN-004', type: 'bills', amount: 8500, status: 'completed', description: 'Electricity bill payment', created_at: new Date().toISOString() },
];

interface DashboardScreenProps {
  onNavigate?: (screen: string) => void;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<DashboardStats>(MOCK_STATS);
  const [recentTx, setRecentTx] = useState<RecentTransaction[]>(MOCK_TRANSACTIONS);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    try {
      const res = await ApiClient.get<{ stats: DashboardStats; transactions: RecentTransaction[] }>('/api/dashboard');
      if (res.data.stats) setStats(res.data.stats);
      if (res.data.transactions) setRecentTx(res.data.transactions);
    } catch {
      setStats(MOCK_STATS);
      setRecentTx(MOCK_TRANSACTIONS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadDashboard(); }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  const formatCurrency = (amount: number) => `\u20A6${amount.toLocaleString()}`;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.header}>Dashboard</Text>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalTransactions.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Transactions</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{formatCurrency(stats.totalAmount)}</Text>
          <Text style={styles.statLabel}>Total Amount</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.activeAgents.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Active Agents</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: stats.securityAlerts > 0 ? '#EF4444' : '#10B981' }]}>
            {stats.securityAlerts}
          </Text>
          <Text style={styles.statLabel}>Alerts</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onNavigate?.('transactions')}>
          <Text style={styles.actionIcon}>+</Text>
          <Text style={styles.actionText}>Deposit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onNavigate?.('transactions')}>
          <Text style={styles.actionIcon}>-</Text>
          <Text style={styles.actionText}>Withdraw</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onNavigate?.('transactions')}>
          <Text style={styles.actionIcon}>&gt;</Text>
          <Text style={styles.actionText}>Transfer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onNavigate?.('profile')}>
          <Text style={styles.actionIcon}>@</Text>
          <Text style={styles.actionText}>Profile</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Recent Transactions</Text>
      {recentTx.map(tx => (
        <View key={tx.id} style={styles.txRow}>
          <View>
            <Text style={styles.txDesc}>{tx.description}</Text>
            <Text style={styles.txDate}>{new Date(tx.created_at).toLocaleTimeString()}</Text>
          </View>
          <View style={styles.txRight}>
            <Text style={[styles.txAmount, { color: tx.type === 'deposit' ? '#10B981' : '#EF4444' }]}>
              {tx.type === 'deposit' ? '+' : '-'}{formatCurrency(tx.amount)}
            </Text>
            <Text style={[styles.txStatus, { color: tx.status === 'completed' ? '#10B981' : '#F59E0B' }]}>
              {tx.status}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6', padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 12 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  actionBtn: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, alignItems: 'center', width: '23%', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  actionIcon: { fontSize: 24, color: '#007AFF', fontWeight: 'bold' },
  actionText: { fontSize: 11, color: '#6B7280', marginTop: 4 },
  txRow: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txDesc: { fontSize: 14, fontWeight: '500', color: '#111827' },
  txDate: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontSize: 14, fontWeight: '600' },
  txStatus: { fontSize: 11, marginTop: 2 },
});

export default DashboardScreen;
