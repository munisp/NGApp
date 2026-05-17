import React, { useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { Card, Title, Text, Chip, Searchbar, SegmentedButtons } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useQuery } from '@tanstack/react-query';
import { policiesApi } from '../../services/api';
import { spacing, typography, theme } from '../../utils/theme';
import { format } from 'date-fns';

interface Policy {
  id: number;
  policyNumber: string;
  type: string;
  status: 'Active' | 'Expired' | 'Cancelled' | 'Pending';
  premium: number;
  sumAssured: number;
  startDate: string;
  endDate: string;
  beneficiaries: string[];
}

const statusColors: Record<string, { bg: string; text: string }> = {
  Active: { bg: '#dcfce7', text: '#166534' },
  Expired: { bg: '#fee2e2', text: '#991b1b' },
  Cancelled: { bg: '#f3f4f6', text: '#4b5563' },
  Pending: { bg: '#fef3c7', text: '#92400e' },
};

const policyTypeIcons: Record<string, string> = {
  Health: 'heart-pulse',
  Auto: 'car',
  Property: 'home',
  Life: 'account-heart',
  Travel: 'airplane',
};

export default function PoliciesScreen({ navigation }: any) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['policies'],
    queryFn: () => policiesApi.getAll(),
  });

  const policies: Policy[] = data?.data || [];

  const filteredPolicies = policies.filter((policy) => {
    const matchesSearch = policy.policyNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      policy.type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || policy.status.toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const renderPolicy = ({ item }: { item: Policy }) => (
    <TouchableOpacity onPress={() => navigation.navigate('PolicyDetail', { id: item.id })}>
      <Card style={styles.policyCard}>
        <Card.Content>
          <View style={styles.policyHeader}>
            <View style={styles.policyIcon}>
              <Icon
                name={policyTypeIcons[item.type] || 'shield'}
                size={24}
                color={theme.colors.primary}
              />
            </View>
            <View style={styles.policyInfo}>
              <Text style={styles.policyType}>{item.type} Insurance</Text>
              <Text style={styles.policyNumber}>{item.policyNumber}</Text>
            </View>
            <Chip
              style={[styles.statusChip, { backgroundColor: statusColors[item.status].bg }]}
              textStyle={{ color: statusColors[item.status].text, fontSize: 12 }}
            >
              {item.status}
            </Chip>
          </View>

          <View style={styles.policyDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Premium</Text>
              <Text style={styles.detailValue}>{formatCurrency(item.premium)}/year</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Sum Assured</Text>
              <Text style={styles.detailValue}>{formatCurrency(item.sumAssured)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Valid Until</Text>
              <Text style={styles.detailValue}>
                {format(new Date(item.endDate), 'MMM dd, yyyy')}
              </Text>
            </View>
          </View>

          <View style={styles.policyActions}>
            <TouchableOpacity style={styles.actionButton}>
              <Icon name="file-download" size={16} color={theme.colors.primary} />
              <Text style={styles.actionText}>Download</Text>
            </TouchableOpacity>
            {item.status === 'Active' && (
              <TouchableOpacity style={styles.actionButton}>
                <Icon name="refresh" size={16} color={theme.colors.success} />
                <Text style={[styles.actionText, { color: theme.colors.success }]}>Renew</Text>
              </TouchableOpacity>
            )}
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Searchbar
          placeholder="Search policies..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
        <SegmentedButtons
          value={statusFilter}
          onValueChange={setStatusFilter}
          buttons={[
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'expired', label: 'Expired' },
          ]}
          style={styles.segmentedButtons}
        />
      </View>

      <FlatList
        data={filteredPolicies}
        renderItem={renderPolicy}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="shield-off" size={64} color={theme.colors.textSecondary} />
            <Text style={styles.emptyText}>No policies found</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Try a different search term' : 'You don\'t have any policies yet'}
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
  policyCard: {
    marginBottom: spacing.md,
    elevation: 2,
  },
  policyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  policyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  policyInfo: {
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
  statusChip: {
    height: 28,
  },
  policyDetails: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.roundness,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  detailLabel: {
    ...typography.caption,
    color: theme.colors.textSecondary,
  },
  detailValue: {
    ...typography.caption,
    fontWeight: '600',
    color: theme.colors.text,
  },
  policyActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionText: {
    ...typography.caption,
    color: theme.colors.primary,
    fontWeight: '500',
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
