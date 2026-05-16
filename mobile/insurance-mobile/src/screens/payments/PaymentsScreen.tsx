/**
 * Payments Screen — Insurance Platform Mobile
 * Full CRUD: list payment history, initiate payments
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient, Payment } from '../services/api';

const COLORS = { primary: '#1E40AF', success: '#10B981', warning: '#F59E0B', danger: '#EF4444', background: '#F8FAFC', card: '#FFFFFF', text: '#1E293B', textSecondary: '#64748B', border: '#E2E8F0' };
const STATUS_COLORS: Record<string, string> = { successful: COLORS.success, pending: COLORS.warning, failed: COLORS.danger };

function PaymentCard({ payment }: { payment: Payment }) {
  const statusColor = STATUS_COLORS[payment.status] ?? COLORS.textSecondary;
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.paymentRef}>{payment.reference}</Text>
          <Text style={styles.paymentType}>{payment.type}</Text>
          <Text style={styles.paymentDate}>{new Date(payment.createdAt).toLocaleDateString()}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.paymentAmount}>₦{Number(payment.amount).toLocaleString()}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{payment.status}</Text>
          </View>
          {payment.channel && <Text style={styles.paymentChannel}>{payment.channel}</Text>}
        </View>
      </View>
    </View>
  );
}

export default function PaymentsScreen() {
  const navigation = useNavigation<any>();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalPaid, setTotalPaid] = useState(0);

  const loadPayments = useCallback(async () => {
    try {
      const data = await apiClient.getPaymentHistory();
      setPayments(data);
      setTotalPaid(data.filter(p => p.status === 'successful').reduce((sum, p) => sum + Number(p.amount), 0));
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to load payments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadPayments(); }, [loadPayments]);

  if (loading) return <SafeAreaView style={styles.container}><View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Payments</Text>
        <TouchableOpacity style={styles.payBtn} onPress={() => navigation.navigate('MakePayment', {})}>
          <Text style={styles.payBtnText}>+ Pay Now</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Paid</Text>
          <Text style={styles.summaryValue}>₦{totalPaid.toLocaleString()}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Transactions</Text>
          <Text style={styles.summaryValue}>{payments.length}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Successful</Text>
          <Text style={[styles.summaryValue, { color: COLORS.success }]}>{payments.filter(p => p.status === 'successful').length}</Text>
        </View>
      </View>

      <FlatList
        data={payments}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <PaymentCard payment={item} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPayments(); }} colors={[COLORS.primary]} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💳</Text>
            <Text style={styles.emptyTitle}>No payment history</Text>
            <Text style={styles.emptySubtitle}>Your payment transactions will appear here</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  payBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  payBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  summaryCard: { flexDirection: 'row', backgroundColor: COLORS.card, marginHorizontal: 16, borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  summaryValue: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  summaryDivider: { width: 1, backgroundColor: COLORS.border },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  card: { backgroundColor: COLORS.card, borderRadius: 12, marginBottom: 10, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between' },
  paymentRef: { fontSize: 13, fontWeight: '600', color: COLORS.text, fontFamily: 'monospace' },
  paymentType: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  paymentDate: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  paymentAmount: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 4 },
  statusText: { fontSize: 11, fontWeight: '600' },
  paymentChannel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: COLORS.textSecondary },
});
