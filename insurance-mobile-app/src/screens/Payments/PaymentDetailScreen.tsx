import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Card, Title, Text, Button, Chip, Divider, RadioButton } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsApi } from '../../services/api';
import { spacing, typography, theme } from '../../utils/theme';
import { format } from 'date-fns';

const statusColors: Record<string, { bg: string; text: string; icon: string }> = {
  Completed: { bg: '#dcfce7', text: '#166534', icon: 'check-circle' },
  Pending: { bg: '#fef3c7', text: '#92400e', icon: 'clock-outline' },
  Failed: { bg: '#fee2e2', text: '#991b1b', icon: 'alert-circle' },
};

const paymentMethods = [
  { id: 'card', label: 'Debit/Credit Card', icon: 'credit-card', description: 'Visa, Mastercard, Verve' },
  { id: 'bank', label: 'Bank Transfer', icon: 'bank', description: 'Direct bank transfer' },
  { id: 'ussd', label: 'USSD', icon: 'cellphone', description: 'Pay with USSD code' },
  { id: 'wallet', label: 'Mobile Wallet', icon: 'wallet', description: 'OPay, Kuda, PalmPay' },
];

export default function PaymentDetailScreen({ route, navigation }: any) {
  const { id, action } = route.params;
  const queryClient = useQueryClient();
  const [selectedMethod, setSelectedMethod] = useState('card');
  const [showPaymentForm, setShowPaymentForm] = useState(action === 'pay');

  const { data, isLoading } = useQuery({
    queryKey: ['payment', id],
    queryFn: () => paymentsApi.getById(id),
  });

  const processPaymentMutation = useMutation({
    mutationFn: (method: string) => paymentsApi.process(id, method),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment', id] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      Alert.alert(
        'Payment Successful',
        'Your payment has been processed successfully.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    },
    onError: (error: any) => {
      Alert.alert('Payment Failed', error.response?.data?.message || 'Please try again');
    },
  });

  const payment = data?.data;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handlePayment = () => {
    Alert.alert(
      'Confirm Payment',
      `Pay ${formatCurrency(payment?.amount || 0)} using ${paymentMethods.find(m => m.id === selectedMethod)?.label}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Pay', onPress: () => processPaymentMutation.mutate(selectedMethod) },
      ]
    );
  };

  if (isLoading || !payment) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const statusConfig = statusColors[payment.status] || statusColors.Pending;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Title style={styles.headerTitle}>Payment Details</Title>
        <View style={{ width: 24 }} />
      </View>

      <Card style={styles.mainCard}>
        <Card.Content>
          <View style={styles.paymentHeader}>
            <View style={[styles.statusIcon, { backgroundColor: statusConfig.bg }]}>
              <Icon name={statusConfig.icon} size={32} color={statusConfig.text} />
            </View>
            <View style={styles.paymentInfo}>
              <Text style={styles.policyType}>{payment.policyType} Insurance</Text>
              <Text style={styles.policyNumber}>{payment.policyNumber}</Text>
            </View>
            <Chip
              style={[styles.statusChip, { backgroundColor: statusConfig.bg }]}
              textStyle={{ color: statusConfig.text }}
            >
              {payment.status}
            </Chip>
          </View>

          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Amount</Text>
            <Text style={styles.amountValue}>{formatCurrency(payment.amount)}</Text>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Transaction Details</Title>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Transaction ID</Text>
            <Text style={styles.detailValue}>{payment.transactionId}</Text>
          </View>
          <Divider style={styles.divider} />
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>
              {format(new Date(payment.date), 'MMMM dd, yyyy HH:mm')}
            </Text>
          </View>
          <Divider style={styles.divider} />
          
          {payment.paymentMethod && (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Payment Method</Text>
                <Text style={styles.detailValue}>{payment.paymentMethod}</Text>
              </View>
              <Divider style={styles.divider} />
            </>
          )}
          
          {payment.dueDate && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Due Date</Text>
              <Text style={[
                styles.detailValue,
                new Date(payment.dueDate) < new Date() && styles.overdue
              ]}>
                {format(new Date(payment.dueDate), 'MMMM dd, yyyy')}
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {payment.status === 'Pending' && (
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Payment Method</Title>
            
            <RadioButton.Group onValueChange={setSelectedMethod} value={selectedMethod}>
              {paymentMethods.map((method) => (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.methodItem,
                    selectedMethod === method.id && styles.methodItemSelected,
                  ]}
                  onPress={() => setSelectedMethod(method.id)}
                >
                  <View style={styles.methodIcon}>
                    <Icon name={method.icon} size={24} color={theme.colors.primary} />
                  </View>
                  <View style={styles.methodInfo}>
                    <Text style={styles.methodLabel}>{method.label}</Text>
                    <Text style={styles.methodDescription}>{method.description}</Text>
                  </View>
                  <RadioButton value={method.id} />
                </TouchableOpacity>
              ))}
            </RadioButton.Group>
          </Card.Content>
        </Card>
      )}

      {payment.status === 'Completed' && (
        <Card style={[styles.card, styles.successCard]}>
          <Card.Content>
            <View style={styles.successHeader}>
              <Icon name="check-circle" size={24} color="#166534" />
              <Title style={styles.successTitle}>Payment Successful</Title>
            </View>
            <Text style={styles.successText}>
              This payment was completed on {format(new Date(payment.date), 'MMMM dd, yyyy')}.
            </Text>
          </Card.Content>
        </Card>
      )}

      {payment.status === 'Failed' && (
        <Card style={[styles.card, styles.failedCard]}>
          <Card.Content>
            <View style={styles.failedHeader}>
              <Icon name="alert-circle" size={24} color="#991b1b" />
              <Title style={styles.failedTitle}>Payment Failed</Title>
            </View>
            <Text style={styles.failedText}>
              This payment could not be processed. Please try again or use a different payment method.
            </Text>
          </Card.Content>
        </Card>
      )}

      <View style={styles.actions}>
        {payment.status === 'Pending' && (
          <Button
            mode="contained"
            onPress={handlePayment}
            loading={processPaymentMutation.isPending}
            disabled={processPaymentMutation.isPending}
            style={styles.payButton}
            icon="cash"
          >
            Pay {formatCurrency(payment.amount)}
          </Button>
        )}
        
        {payment.status === 'Completed' && (
          <Button
            mode="outlined"
            onPress={() => {}}
            style={styles.actionButton}
            icon="download"
          >
            Download Receipt
          </Button>
        )}
        
        {payment.status === 'Failed' && (
          <Button
            mode="contained"
            onPress={() => setShowPaymentForm(true)}
            style={styles.retryButton}
            icon="refresh"
          >
            Retry Payment
          </Button>
        )}
        
        <Button
          mode="text"
          onPress={() => {}}
          style={styles.actionButton}
          icon="help-circle"
        >
          Need Help?
        </Button>
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
  paymentHeader: {
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
  paymentInfo: {
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
    ...typography.h1,
    color: theme.colors.primary,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.md,
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
  overdue: {
    color: theme.colors.error,
  },
  divider: {
    marginVertical: spacing.xs,
  },
  methodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness,
    marginBottom: spacing.sm,
  },
  methodItemSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '10',
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  methodInfo: {
    flex: 1,
  },
  methodLabel: {
    ...typography.body,
    fontWeight: '600',
    color: theme.colors.text,
  },
  methodDescription: {
    ...typography.caption,
    color: theme.colors.textSecondary,
  },
  successCard: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderWidth: 1,
  },
  successHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  successTitle: {
    ...typography.body,
    fontWeight: '600',
    color: '#166534',
    marginLeft: spacing.sm,
  },
  successText: {
    ...typography.body,
    color: '#14532d',
  },
  failedCard: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
  },
  failedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  failedTitle: {
    ...typography.body,
    fontWeight: '600',
    color: '#991b1b',
    marginLeft: spacing.sm,
  },
  failedText: {
    ...typography.body,
    color: '#7f1d1d',
  },
  actions: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  payButton: {
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
  },
  retryButton: {
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: theme.colors.warning,
  },
  actionButton: {
    marginBottom: spacing.md,
  },
});
