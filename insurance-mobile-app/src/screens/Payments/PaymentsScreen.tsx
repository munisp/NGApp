import React, { useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { Card, Text, Chip, Searchbar, SegmentedButtons, FAB } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useQuery } from '@tanstack/react-query';
import { paymentsApi } from '../../services/api';
import { spacing, typography, theme } from '../../utils/theme';
import { format } from 'date-fns';

interface Payment {
  id: number;
  transactionId: string;
  policyNumber: string;
  policyType: string;
  amount: number;
  status: 'Completed' | 'Pending' | 'Failed';
  paymentMethod: string;
  date: string;
  dueDate?: string;
}

const statusColors: Record<string, { bg: string; text: string; icon: string }> = {
  Completed: { bg: '#dcfce7', text: '#166534', icon: 'check-circle' },
  Pending: { bg: '#fef3c7', text: '#92400e', icon: 'clock-outline' },
  Failed: { bg: '#fee2e2', text: '#991b1b', icon: 'alert-circle' },
};

export default function PaymentsScreen({ navigation }: any) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['payments'],
    queryFn: () => paymentsApi.getAll(),
  });

  const payments: Payment[] = data?.data || [];

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch = payment.transactionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.policyNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || payment.status.toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingPayments = payments.filter(p => p.status === 'Pending');
  const totalPending = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const renderPayment = ({ item }: { item: Payment }) => {
    const statusConfig = statusColors[item.status] || statusColors.Pending;
    
    return (
      <TouchableOpacity onPress={() => navigation.navigate('PaymentDetail', { id: item.id })}>
        <Card style={styles.paymentCard}>
          <Card.Content>
            <View style={styles.paymentHeader}>
              <View style={[styles.statusIcon, { backgroundColor: statusConfig.bg }]}>
                <Icon name={statusConfig.icon} size={24} color={statusConfig.text} />
              </View>
              <View style={styles.paymentInfo}>
                <Text style={styles.policyType}>{item.policyType} Insurance</Text>
                <Text style={styles.policyNumber}>{item.policyNumber}</Text>
              </View>
              <View style={styles.amountContainer}>
                <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
                <Chip
                  style={[styles.statusChip, { backgroundColor: statusConfig.bg }]}
                  textStyle={{ color: statusConfig.text, fontSize: 10 }}
                >
                  {item.status}
                </Chip>
              </View>
            </View>

            <View style={styles.paymentDetails}>
              <View style={styles.detailItem}>
                <Icon name="identifier" size={14} color={theme.colors.textSecondary} />
                <Text style={styles.detailText}>{item.transactionId}</Text>
              </View>
              <View style={styles.detailItem}>
                <Icon name="calendar" size={14} color={theme.colors.textSecondary} />
                <Text style={styles.detailText}>
                  {format(new Date(item.date), 'MMM dd, yyyy')}
                </Text>
              </View>
              {item.paymentMethod && (
                <View style={styles.detailItem}>
                  <Icon name="credit-card" size={14} color={theme.colors.textSecondary} />
                  <Text style={styles.detailText}>{item.paymentMethod}</Text>
                </View>
              )}
            </View>

            {item.status === 'Pending' && (
              <TouchableOpacity
                style={styles.payNowButton}
                onPress={() => navigation.navigate('PaymentDetail', { id: item.id, action: 'pay' })}
              >
                <Icon name="cash" size={16} color="#fff" />
                <Text style={styles.payNowText}>Pay Now</Text>
              </TouchableOpacity>
            )}
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {pendingPayments.length > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryContent}>
            <Icon name="alert-circle" size={24} color={theme.colors.warning} />
            <View style={styles.summaryText}>
              <Text style={styles.summaryTitle}>
                {pendingPayments.length} Pending Payment{pendingPayments.length > 1 ? 's' : ''}
              </Text>
              <Text style={styles.summaryAmount}>Total: {formatCurrency(totalPending)}</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.header}>
        <Searchbar
          placeholder="Search payments..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
        <SegmentedButtons
          value={statusFilter}
          onValueChange={setStatusFilter}
          buttons={[
            { value: 'all', label: 'All' },
            { value: 'pending', label: 'Pending' },
            { value: 'completed', label: 'Completed' },
          ]}
          style={styles.segmentedButtons}
        />
      </View>

      <FlatList
        data={filteredPayments}
        renderItem={renderPayment}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="credit-card-off" size={64} color={theme.colors.textSecondary} />
            <Text style={styles.emptyText}>No payments found</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Try a different search term' : 'Your payment history will appear here'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  summaryCard: {
    backgroundColor: '#fef3c7',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#fcd34d',
  },
  summaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryText: {
    marginLeft: spacing.md,
  },
  summaryTitle: {
    ...typography.body,
    fontWeight: '600',
    color: '#92400e',
  },
  summaryAmount: {
    ...typography.caption,
    color: '#b45309',
  },
  header: {
    padding: spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchbar: {
    marginBottom: spacing.md,
    elevation: 0,
    backgroundColor: theme.colors.background,
  },
  segmentedButtons: {
    marginBottom: spacing.sm,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  paymentCard: {
    marginBottom: spacing.md,
    elevation: 2,
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  paymentInfo: {
    flex: 1,
  },
  policyType: {
    ...typography.body,
    fontWeight: '600',
    color: theme.colors.text,
  },
  policyNumber: {
    ...typography.caption,
    color: theme.colors.textSecondary,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    ...typography.body,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: spacing.xs,
  },
  statusChip: {
    height: 22,
  },
  paymentDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.roundness,
    padding: spacing.sm,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    ...typography.small,
    color: theme.colors.textSecondary,
    marginLeft: spacing.xs,
  },
  payNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.roundness,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  payNowText: {
    ...typography.body,
    fontWeight: '600',
    color: '#fff',
    marginLeft: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    ...typography.h3,
    color: theme.colors.text,
    marginTop: spacing.md,
  },
  emptySubtext: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    marginTop: spacing.sm,
  },
});
