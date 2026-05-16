import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Card, Title, Text, Button, Chip, Divider } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { policiesApi } from '../../services/api';
import { spacing, typography, theme } from '../../utils/theme';
import { format } from 'date-fns';

const statusColors: Record<string, { bg: string; text: string }> = {
  Active: { bg: '#dcfce7', text: '#166534' },
  Expired: { bg: '#fee2e2', text: '#991b1b' },
  Cancelled: { bg: '#f3f4f6', text: '#4b5563' },
  Pending: { bg: '#fef3c7', text: '#92400e' },
};

export default function PolicyDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['policy', id],
    queryFn: () => policiesApi.getById(id),
  });

  const renewMutation = useMutation({
    mutationFn: () => policiesApi.renew(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy', id] });
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      Alert.alert('Success', 'Policy renewal initiated successfully');
    },
    onError: () => {
      Alert.alert('Error', 'Failed to renew policy. Please try again.');
    },
  });

  const policy = data?.data;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleRenew = () => {
    Alert.alert(
      'Renew Policy',
      `Are you sure you want to renew this policy? Premium: ${formatCurrency(policy?.premium || 0)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Renew', onPress: () => renewMutation.mutate() },
      ]
    );
  };

  const handleFileClaim = () => {
    navigation.navigate('NewClaim', { policyId: id });
  };

  if (isLoading || !policy) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Title style={styles.headerTitle}>Policy Details</Title>
        <View style={{ width: 24 }} />
      </View>

      <Card style={styles.mainCard}>
        <Card.Content>
          <View style={styles.policyHeader}>
            <View style={styles.policyIcon}>
              <Icon name="shield-check" size={32} color={theme.colors.primary} />
            </View>
            <View style={styles.policyInfo}>
              <Text style={styles.policyType}>{policy.type} Insurance</Text>
              <Text style={styles.policyNumber}>{policy.policyNumber}</Text>
            </View>
            <Chip
              style={[styles.statusChip, { backgroundColor: statusColors[policy.status]?.bg }]}
              textStyle={{ color: statusColors[policy.status]?.text }}
            >
              {policy.status}
            </Chip>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Coverage Details</Title>
          
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Sum Assured</Text>
              <Text style={styles.detailValue}>{formatCurrency(policy.sumAssured)}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Annual Premium</Text>
              <Text style={styles.detailValue}>{formatCurrency(policy.premium)}</Text>
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Start Date</Text>
              <Text style={styles.detailValue}>
                {format(new Date(policy.startDate), 'MMM dd, yyyy')}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>End Date</Text>
              <Text style={styles.detailValue}>
                {format(new Date(policy.endDate), 'MMM dd, yyyy')}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {policy.beneficiaries && policy.beneficiaries.length > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Beneficiaries</Title>
            {policy.beneficiaries.map((beneficiary: string, index: number) => (
              <View key={index} style={styles.beneficiaryItem}>
                <Icon name="account" size={20} color={theme.colors.primary} />
                <Text style={styles.beneficiaryName}>{beneficiary}</Text>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Coverage Includes</Title>
          {getCoverageItems(policy.type).map((item, index) => (
            <View key={index} style={styles.coverageItem}>
              <Icon name="check-circle" size={20} color={theme.colors.success} />
              <Text style={styles.coverageText}>{item}</Text>
            </View>
          ))}
        </Card.Content>
      </Card>

      <View style={styles.actions}>
        {policy.status === 'Active' && (
          <>
            <Button
              mode="contained"
              onPress={handleFileClaim}
              style={styles.actionButton}
              icon="file-document-edit"
            >
              File a Claim
            </Button>
            <Button
              mode="outlined"
              onPress={handleRenew}
              loading={renewMutation.isPending}
              style={styles.actionButton}
              icon="refresh"
            >
              Renew Policy
            </Button>
          </>
        )}
        <Button
          mode="text"
          onPress={() => {}}
          style={styles.actionButton}
          icon="download"
        >
          Download Policy Document
        </Button>
      </View>
    </ScrollView>
  );
}

function getCoverageItems(type: string): string[] {
  const coverageMap: Record<string, string[]> = {
    Health: [
      'Hospitalization expenses',
      'Outpatient treatment',
      'Prescription medications',
      'Emergency medical care',
      'Specialist consultations',
    ],
    Auto: [
      'Third-party liability',
      'Collision damage',
      'Theft protection',
      'Personal accident cover',
      'Roadside assistance',
    ],
    Property: [
      'Fire and lightning damage',
      'Theft and burglary',
      'Natural disasters',
      'Water damage',
      'Personal belongings',
    ],
    Life: [
      'Death benefit',
      'Terminal illness cover',
      'Accidental death benefit',
      'Disability cover',
      'Critical illness rider',
    ],
  };
  return coverageMap[type] || ['Standard coverage included'];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
  },
  mainCard: {
    margin: spacing.md,
    marginBottom: spacing.sm,
  },
  card: {
    margin: spacing.md,
    marginTop: spacing.sm,
  },
  policyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  policyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  policyInfo: {
    flex: 1,
  },
  policyType: {
    ...typography.h3,
    color: theme.colors.text,
  },
  policyNumber: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    marginTop: spacing.xs,
  },
  statusChip: {
    height: 32,
  },
  sectionTitle: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: spacing.xs,
  },
  detailValue: {
    ...typography.body,
    fontWeight: '600',
    color: theme.colors.text,
  },
  divider: {
    marginVertical: spacing.md,
  },
  beneficiaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  beneficiaryName: {
    ...typography.body,
    marginLeft: spacing.md,
    color: theme.colors.text,
  },
  coverageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  coverageText: {
    ...typography.body,
    marginLeft: spacing.md,
    color: theme.colors.text,
  },
  actions: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  actionButton: {
    marginBottom: spacing.md,
  },
});
