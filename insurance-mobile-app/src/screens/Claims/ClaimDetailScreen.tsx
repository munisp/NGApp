import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Card, Title, Text, Button, Chip, Divider, ProgressBar } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useQuery } from '@tanstack/react-query';
import { claimsApi } from '../../services/api';
import { spacing, typography, theme } from '../../utils/theme';
import { format } from 'date-fns';

const statusColors: Record<string, { bg: string; text: string; icon: string }> = {
  Submitted: { bg: '#dbeafe', text: '#1e40af', icon: 'file-send' },
  'Under Review': { bg: '#fef3c7', text: '#92400e', icon: 'file-search' },
  Approved: { bg: '#dcfce7', text: '#166534', icon: 'check-circle' },
  Rejected: { bg: '#fee2e2', text: '#991b1b', icon: 'close-circle' },
  Paid: { bg: '#d1fae5', text: '#065f46', icon: 'cash-check' },
};

const claimStages = [
  { key: 'Submitted', label: 'Submitted', icon: 'file-send' },
  { key: 'Under Review', label: 'Under Review', icon: 'file-search' },
  { key: 'Approved', label: 'Approved', icon: 'check-circle' },
  { key: 'Paid', label: 'Paid', icon: 'cash-check' },
];

export default function ClaimDetailScreen({ route, navigation }: any) {
  const { id } = route.params;

  const { data, isLoading } = useQuery({
    queryKey: ['claim', id],
    queryFn: () => claimsApi.getById(id),
  });

  const claim = data?.data;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStageProgress = (status: string) => {
    const stageIndex = claimStages.findIndex(s => s.key === status);
    if (status === 'Rejected') return 2;
    return stageIndex >= 0 ? stageIndex : 0;
  };

  if (isLoading || !claim) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const statusConfig = statusColors[claim.status] || statusColors.Submitted;
  const currentStage = getStageProgress(claim.status);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Title style={styles.headerTitle}>Claim Details</Title>
        <View style={{ width: 24 }} />
      </View>

      <Card style={styles.mainCard}>
        <Card.Content>
          <View style={styles.claimHeader}>
            <View style={[styles.statusIcon, { backgroundColor: statusConfig.bg }]}>
              <Icon name={statusConfig.icon} size={32} color={statusConfig.text} />
            </View>
            <View style={styles.claimInfo}>
              <Text style={styles.claimNumber}>Claim #{claim.claimNumber}</Text>
              <Text style={styles.policyInfo}>{claim.policyType} Insurance</Text>
            </View>
            <Chip
              style={[styles.statusChip, { backgroundColor: statusConfig.bg }]}
              textStyle={{ color: statusConfig.text }}
            >
              {claim.status}
            </Chip>
          </View>

          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Claim Amount</Text>
            <Text style={styles.amountValue}>{formatCurrency(claim.amount)}</Text>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Claim Progress</Title>
          <View style={styles.progressContainer}>
            {claimStages.map((stage, index) => {
              const isCompleted = index <= currentStage;
              const isCurrent = index === currentStage;
              const isRejected = claim.status === 'Rejected' && index === 2;
              
              return (
                <View key={stage.key} style={styles.stageItem}>
                  <View style={styles.stageIconContainer}>
                    <View style={[
                      styles.stageIcon,
                      isCompleted && styles.stageIconCompleted,
                      isRejected && styles.stageIconRejected,
                      isCurrent && styles.stageIconCurrent,
                    ]}>
                      <Icon
                        name={isRejected ? 'close' : isCompleted ? 'check' : stage.icon}
                        size={20}
                        color={isCompleted || isRejected ? '#fff' : theme.colors.textSecondary}
                      />
                    </View>
                    {index < claimStages.length - 1 && (
                      <View style={[
                        styles.stageLine,
                        index < currentStage && styles.stageLineCompleted,
                      ]} />
                    )}
                  </View>
                  <Text style={[
                    styles.stageLabel,
                    isCompleted && styles.stageLabelCompleted,
                    isRejected && styles.stageLabelRejected,
                  ]}>
                    {isRejected ? 'Rejected' : stage.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Claim Details</Title>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Policy Number</Text>
            <Text style={styles.detailValue}>{claim.policyNumber}</Text>
          </View>
          <Divider style={styles.divider} />
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Incident Date</Text>
            <Text style={styles.detailValue}>
              {format(new Date(claim.incidentDate), 'MMMM dd, yyyy')}
            </Text>
          </View>
          <Divider style={styles.divider} />
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Submitted Date</Text>
            <Text style={styles.detailValue}>
              {format(new Date(claim.submittedDate), 'MMMM dd, yyyy')}
            </Text>
          </View>
          <Divider style={styles.divider} />
          
          <View style={styles.descriptionContainer}>
            <Text style={styles.detailLabel}>Description</Text>
            <Text style={styles.descriptionText}>{claim.description}</Text>
          </View>
        </Card.Content>
      </Card>

      {claim.documents && claim.documents.length > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Supporting Documents</Title>
            <View style={styles.documentsGrid}>
              {claim.documents.map((doc: any, index: number) => (
                <TouchableOpacity key={index} style={styles.documentItem}>
                  <View style={styles.documentIcon}>
                    <Icon name="file-document" size={32} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.documentName} numberOfLines={1}>
                    {doc.name || `Document ${index + 1}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card.Content>
        </Card>
      )}

      {claim.status === 'Rejected' && claim.rejectionReason && (
        <Card style={[styles.card, styles.rejectionCard]}>
          <Card.Content>
            <View style={styles.rejectionHeader}>
              <Icon name="alert-circle" size={24} color="#991b1b" />
              <Title style={styles.rejectionTitle}>Rejection Reason</Title>
            </View>
            <Text style={styles.rejectionText}>{claim.rejectionReason}</Text>
          </Card.Content>
        </Card>
      )}

      {claim.status === 'Approved' && (
        <Card style={[styles.card, styles.approvalCard]}>
          <Card.Content>
            <View style={styles.approvalHeader}>
              <Icon name="check-circle" size={24} color="#166534" />
              <Title style={styles.approvalTitle}>Claim Approved</Title>
            </View>
            <Text style={styles.approvalText}>
              Your claim has been approved. Payment will be processed within 3-5 business days.
            </Text>
            {claim.approvedAmount && (
              <Text style={styles.approvedAmount}>
                Approved Amount: {formatCurrency(claim.approvedAmount)}
              </Text>
            )}
          </Card.Content>
        </Card>
      )}

      <View style={styles.actions}>
        <Button
          mode="outlined"
          onPress={() => {}}
          style={styles.actionButton}
          icon="message-text"
        >
          Contact Support
        </Button>
        {claim.status === 'Submitted' && (
          <Button
            mode="text"
            onPress={() => {}}
            style={styles.actionButton}
            icon="file-edit"
            textColor={theme.colors.warning}
          >
            Edit Claim
          </Button>
        )}
      </View>
    </ScrollView>
  );
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
  claimHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  claimInfo: {
    flex: 1,
  },
  claimNumber: {
    ...typography.h3,
    color: theme.colors.text,
  },
  policyInfo: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    marginTop: spacing.xs,
  },
  statusChip: {
    height: 32,
  },
  amountContainer: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.roundness,
    padding: spacing.md,
    alignItems: 'center',
  },
  amountLabel: {
    ...typography.caption,
    color: theme.colors.textSecondary,
  },
  amountValue: {
    ...typography.h2,
    color: theme.colors.primary,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stageItem: {
    alignItems: 'center',
    flex: 1,
  },
  stageIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  stageIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stageIconCompleted: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.success,
  },
  stageIconRejected: {
    backgroundColor: theme.colors.error,
    borderColor: theme.colors.error,
  },
  stageIconCurrent: {
    borderColor: theme.colors.primary,
    borderWidth: 3,
  },
  stageLine: {
    position: 'absolute',
    right: 0,
    width: '50%',
    height: 2,
    backgroundColor: theme.colors.border,
  },
  stageLineCompleted: {
    backgroundColor: theme.colors.success,
  },
  stageLabel: {
    ...typography.small,
    color: theme.colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  stageLabelCompleted: {
    color: theme.colors.success,
    fontWeight: '600',
  },
  stageLabelRejected: {
    color: theme.colors.error,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  detailLabel: {
    ...typography.caption,
    color: theme.colors.textSecondary,
  },
  detailValue: {
    ...typography.body,
    color: theme.colors.text,
    fontWeight: '500',
  },
  divider: {
    marginVertical: spacing.xs,
  },
  descriptionContainer: {
    paddingTop: spacing.sm,
  },
  descriptionText: {
    ...typography.body,
    color: theme.colors.text,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  documentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  documentItem: {
    width: 80,
    alignItems: 'center',
  },
  documentIcon: {
    width: 64,
    height: 64,
    borderRadius: theme.roundness,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  documentName: {
    ...typography.small,
    color: theme.colors.text,
    textAlign: 'center',
  },
  rejectionCard: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
  },
  rejectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  rejectionTitle: {
    ...typography.body,
    fontWeight: '600',
    color: '#991b1b',
    marginLeft: spacing.sm,
  },
  rejectionText: {
    ...typography.body,
    color: '#7f1d1d',
  },
  approvalCard: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderWidth: 1,
  },
  approvalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  approvalTitle: {
    ...typography.body,
    fontWeight: '600',
    color: '#166534',
    marginLeft: spacing.sm,
  },
  approvalText: {
    ...typography.body,
    color: '#14532d',
  },
  approvedAmount: {
    ...typography.body,
    fontWeight: '600',
    color: '#166534',
    marginTop: spacing.sm,
  },
  actions: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  actionButton: {
    marginBottom: spacing.md,
  },
});
