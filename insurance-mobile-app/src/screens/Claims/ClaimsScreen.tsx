import React, { useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { Card, Text, Chip, Searchbar, SegmentedButtons, FAB } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useQuery } from '@tanstack/react-query';
import { claimsApi } from '../../services/api';
import { spacing, typography, theme } from '../../utils/theme';
import { format } from 'date-fns';

interface Claim {
  id: number;
  claimNumber: string;
  policyNumber: string;
  policyType: string;
  amount: number;
  status: 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Paid';
  incidentDate: string;
  submittedDate: string;
  description: string;
}

const statusColors: Record<string, { bg: string; text: string; icon: string }> = {
  Submitted: { bg: '#dbeafe', text: '#1e40af', icon: 'file-send' },
  'Under Review': { bg: '#fef3c7', text: '#92400e', icon: 'file-search' },
  Approved: { bg: '#dcfce7', text: '#166534', icon: 'check-circle' },
  Rejected: { bg: '#fee2e2', text: '#991b1b', icon: 'close-circle' },
  Paid: { bg: '#d1fae5', text: '#065f46', icon: 'cash-check' },
};

export default function ClaimsScreen({ navigation }: any) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['claims'],
    queryFn: () => claimsApi.getAll(),
  });

  const claims: Claim[] = data?.data || [];

  const filteredClaims = claims.filter((claim) => {
    const matchesSearch = claim.claimNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
      claim.status.toLowerCase().replace(' ', '-') === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const renderClaim = ({ item }: { item: Claim }) => {
    const statusConfig = statusColors[item.status] || statusColors.Submitted;
    
    return (
      <TouchableOpacity onPress={() => navigation.navigate('ClaimDetail', { id: item.id })}>
        <Card style={styles.claimCard}>
          <Card.Content>
            <View style={styles.claimHeader}>
              <View style={[styles.statusIcon, { backgroundColor: statusConfig.bg }]}>
                <Icon name={statusConfig.icon} size={24} color={statusConfig.text} />
              </View>
              <View style={styles.claimInfo}>
                <Text style={styles.claimNumber}>Claim #{item.claimNumber}</Text>
                <Text style={styles.policyInfo}>{item.policyType} - {item.policyNumber}</Text>
              </View>
              <Chip
                style={[styles.statusChip, { backgroundColor: statusConfig.bg }]}
                textStyle={{ color: statusConfig.text, fontSize: 11 }}
              >
                {item.status}
              </Chip>
            </View>

            <View style={styles.claimDetails}>
              <View style={styles.detailRow}>
                <Icon name="cash" size={16} color={theme.colors.textSecondary} />
                <Text style={styles.detailText}>Claim Amount: {formatCurrency(item.amount)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Icon name="calendar" size={16} color={theme.colors.textSecondary} />
                <Text style={styles.detailText}>
                  Incident: {format(new Date(item.incidentDate), 'MMM dd, yyyy')}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Icon name="clock-outline" size={16} color={theme.colors.textSecondary} />
                <Text style={styles.detailText}>
                  Submitted: {format(new Date(item.submittedDate), 'MMM dd, yyyy')}
                </Text>
              </View>
            </View>

            <Text style={styles.description} numberOfLines={2}>
              {item.description}
            </Text>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Searchbar
          placeholder="Search claims..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
        <SegmentedButtons
          value={statusFilter}
          onValueChange={setStatusFilter}
          buttons={[
            { value: 'all', label: 'All' },
            { value: 'under-review', label: 'Pending' },
            { value: 'paid', label: 'Paid' },
          ]}
          style={styles.segmentedButtons}
        />
      </View>

      <FlatList
        data={filteredClaims}
        renderItem={renderClaim}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="file-document-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={styles.emptyText}>No claims found</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Try a different search term' : 'You haven\'t filed any claims yet'}
            </Text>
          </View>
        }
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('NewClaim')}
        label="File Claim"
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
    paddingBottom: 100,
  },
  claimCard: {
    marginBottom: spacing.md,
    elevation: 2,
  },
  claimHeader: {
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
  claimInfo: {
    flex: 1,
  },
  claimNumber: {
    ...typography.body,
    fontWeight: '600',
    color: theme.colors.text,
  },
  policyInfo: {
    ...typography.caption,
    color: theme.colors.textSecondary,
  },
  statusChip: {
    height: 26,
  },
  claimDetails: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.roundness,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  detailText: {
    ...typography.caption,
    color: theme.colors.text,
    marginLeft: spacing.sm,
  },
  description: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
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
  fab: {
    position: 'absolute',
    margin: spacing.md,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.primary,
  },
});
