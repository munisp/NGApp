import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import {
  Appbar,
  Searchbar,
  List,
  ActivityIndicator,
  Text,
  FAB,
  Modal,
  Portal,
  Button,
  TextInput,
  useTheme,
  Card,
  Chip,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { trpc } from '@/services/api';
import { useQueryClient } from '@tanstack/react-query';
import { theme } from '@/utils/theme'; // Assuming theme is exported from here

// --- Type Definitions ---

type PaymentStatus = 'paid' | 'pending' | 'failed';

interface Payment {
  id: string;
  policyId: string;
  policyNumber: string;
  amount: number;
  date: string; // ISO date string
  status: PaymentStatus;
  description: string;
}

interface QuickPaymentForm {
  policyNumber: string;
  amount: string;
}

// --- Constants ---

const PAYMENT_STATUS_OPTIONS: { label: string; value: PaymentStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Paid', value: 'paid' },
  { label: 'Pending', value: 'pending' },
  { label: 'Failed', value: 'failed' },
];

// --- Helper Components ---

const PaymentItem: React.FC<{ payment: Payment }> = React.memo(({ payment }) => {
  const paperTheme = useTheme();
  const date = new Date(payment.date).toLocaleDateString();
  const time = new Date(payment.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const statusColor = useMemo(() => {
    switch (payment.status) {
      case 'paid':
        return paperTheme.colors.primary;
      case 'pending':
        return paperTheme.colors.secondary;
      case 'failed':
        return paperTheme.colors.error;
      default:
        return paperTheme.colors.onSurface;
    }
  }, [payment.status, paperTheme.colors]);

  return (
    <List.Item
      title={`$${payment.amount.toFixed(2)}`}
      description={`${payment.description} - Policy: ${payment.policyNumber}`}
      left={props => <List.Icon {...props} icon="credit-card-outline" />}
      right={() => (
        <View style={styles.paymentRight}>
          <Text style={{ color: statusColor, fontWeight: 'bold' }}>
            {payment.status.toUpperCase()}
          </Text>
          <Text style={{ fontSize: 12, color: paperTheme.colors.onSurfaceDisabled }}>
            {date} {time}
          </Text>
        </View>
      )}
      onPress={() => {
        // In a real app, this would navigate to a PaymentDetailScreen
        Alert.alert('Payment Details', `ID: ${payment.id}\nAmount: $${payment.amount.toFixed(2)}`);
      }}
    />
  );
});

// --- Main Screen Component ---

const PaymentsScreen: React.FC = () => {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const paperTheme = useTheme();

  // State for Search and Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | 'all'>('all');
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [isQuickPayModalVisible, setIsQuickPayModalVisible] = useState(false);
  const [quickPayForm, setQuickPayForm] = useState<QuickPaymentForm>({ policyNumber: '', amount: '' });
  const [quickPayErrors, setQuickPayErrors] = useState<{ policyNumber?: string; amount?: string }>({});

  // --- Data Fetching (List) ---
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.payments.list.useInfiniteQuery(
    {
      search: searchQuery || undefined,
      status: filterStatus === 'all' ? undefined : filterStatus,
      limit: 10,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      staleTime: 1000 * 60 * 5, // 5 minutes
    }
  );

  const payments = useMemo(() => data?.pages.flatMap(page => page.items) ?? [], [data]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // --- Mutation (Quick Payment) ---
  const quickPayMutation = trpc.payments.createQuickPayment.useMutation({
    onSuccess: (data) => {
      setIsQuickPayModalVisible(false);
      setQuickPayForm({ policyNumber: '', amount: '' });
      setQuickPayErrors({});
      // Invalidate the list query to show the new payment
      queryClient.invalidateQueries({ queryKey: ['payments', 'list'] });
      Alert.alert('Success', `Payment of $${data.amount.toFixed(2)} successful! ID: ${data.paymentId}`);
    },
    onError: (err) => {
      Alert.alert('Payment Failed', `An error occurred: ${err.message}`);
    },
  });

  const validateQuickPayForm = (): boolean => {
    const errors: typeof quickPayErrors = {};
    const amount = parseFloat(quickPayForm.amount);

    if (!quickPayForm.policyNumber.trim()) {
      errors.policyNumber = 'Policy number is required.';
    }
    if (isNaN(amount) || amount <= 0) {
      errors.amount = 'Valid amount is required.';
    }

    setQuickPayErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleQuickPaySubmit = () => {
    if (validateQuickPayForm()) {
      const amount = parseFloat(quickPayForm.amount);
      // Assuming we have a way to map policyNumber to policyId on the backend
      quickPayMutation.mutate({
        policyNumber: quickPayForm.policyNumber.trim(),
        amount: amount,
      });
    }
  };

  // --- UI Render Functions ---

  const renderListFooter = () => {
    if (isFetchingNextPage) {
      return <ActivityIndicator style={styles.footerIndicator} animating={true} size="small" />;
    }
    if (!hasNextPage && payments.length > 0) {
      return <Text style={styles.endOfListText}>- End of Payments -</Text>;
    }
    return null;
  };

  const renderEmptyState = () => {
    if (isLoading) {
      return <ActivityIndicator style={styles.loading} animating={true} size="large" />;
    }
    if (isError) {
      return (
        <View style={styles.centerMessage}>
          <Text style={styles.errorMessage}>Error loading payments: {error.message}</Text>
          <Button mode="outlined" onPress={handleRefresh} style={styles.retryButton}>
            Try Again
          </Button>
        </View>
      );
    }
    if (payments.length === 0 && !isLoading) {
      return (
        <View style={styles.centerMessage}>
          <Text style={styles.emptyMessage}>No payments found.</Text>
          <Text style={styles.emptyMessageDetail}>
            Adjust your search or filter settings.
          </Text>
        </View>
      );
    }
    return null;
  };

  // --- Modals ---

  const renderFilterModal = () => (
    <Portal>
      <Modal
        visible={isFilterModalVisible}
        onDismiss={() => setIsFilterModalVisible(false)}
        contentContainerStyle={[styles.modalContainer, { backgroundColor: paperTheme.colors.background }]}
      >
        <Text style={styles.modalTitle}>Filter Payments</Text>
        <View style={styles.chipContainer}>
          {PAYMENT_STATUS_OPTIONS.map(option => (
            <Chip
              key={option.value}
              icon={filterStatus === option.value ? 'check' : 'circle-outline'}
              selected={filterStatus === option.value}
              onPress={() => setFilterStatus(option.value)}
              style={styles.chip}
            >
              {option.label}
            </Chip>
          ))}
        </View>
        <Button mode="contained" onPress={() => setIsFilterModalVisible(false)} style={styles.modalButton}>
          Apply Filter
        </Button>
      </Modal>
    </Portal>
  );

  const renderQuickPayModal = () => (
    <Portal>
      <Modal
        visible={isQuickPayModalVisible}
        onDismiss={() => {
          setIsQuickPayModalVisible(false);
          setQuickPayErrors({});
          setQuickPayForm({ policyNumber: '', amount: '' });
        }}
        contentContainerStyle={[styles.modalContainer, { backgroundColor: paperTheme.colors.background }]}
      >
        <Text style={styles.modalTitle}>Quick Payment</Text>
        <TextInput
          label="Policy Number"
          value={quickPayForm.policyNumber}
          onChangeText={(text) => setQuickPayForm(prev => ({ ...prev, policyNumber: text }))}
          mode="outlined"
          keyboardType="default"
          error={!!quickPayErrors.policyNumber}
          style={styles.input}
        />
        {quickPayErrors.policyNumber && <Text style={styles.errorText}>{quickPayErrors.policyNumber}</Text>}

        <TextInput
          label="Amount ($)"
          value={quickPayForm.amount}
          onChangeText={(text) => setQuickPayForm(prev => ({ ...prev, amount: text.replace(/[^0-9.]/g, '') }))}
          mode="outlined"
          keyboardType="numeric"
          error={!!quickPayErrors.amount}
          style={styles.input}
        />
        {quickPayErrors.amount && <Text style={styles.errorText}>{quickPayErrors.amount}</Text>}

        <Button
          mode="contained"
          onPress={handleQuickPaySubmit}
          loading={quickPayMutation.isLoading}
          disabled={quickPayMutation.isLoading}
          style={styles.modalButton}
        >
          Pay Now
        </Button>
      </Modal>
    </Portal>
  );

  // --- Main Render ---

  return (
    <View style={[styles.container, { backgroundColor: paperTheme.colors.background }]}>
      <Appbar.Header theme={{ colors: { primary: theme.colors.primary } }}>
        <Appbar.Content title="Payments" />
        <Appbar.Action icon="filter-variant" onPress={() => setIsFilterModalVisible(true)} />
        <Appbar.Action icon="magnify" onPress={() => { /* Toggle search visibility if needed */ }} />
      </Appbar.Header>

      <Searchbar
        placeholder="Search payments..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
        theme={{ colors: { primary: theme.colors.primary } }}
      />

      <View style={styles.listContainer}>
        <FlatList
          data={payments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PaymentItem payment={item} />}
          contentContainerStyle={payments.length === 0 && !isLoading ? styles.flatListContent : undefined}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderListFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isFetchingNextPage}
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
        />
      </View>

      {renderFilterModal()}
      {renderQuickPayModal()}

      <FAB
        style={[styles.fab, { backgroundColor: theme.colors.accent }]}
        icon="cash-plus"
        label="Quick Pay"
        onPress={() => setIsQuickPayModalVisible(true)}
      />
    </View>
  );
};

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContainer: {
    flex: 1,
  },
  flatListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  searchBar: {
    margin: 8,
    elevation: 1,
  },
  loading: {
    padding: 20,
  },
  centerMessage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorMessage: {
    color: theme.colors.error,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  emptyMessageDetail: {
    fontSize: 14,
    color: theme.colors.placeholder,
  },
  retryButton: {
    marginTop: 10,
  },
  footerIndicator: {
    marginVertical: 20,
  },
  endOfListText: {
    textAlign: 'center',
    marginVertical: 10,
    color: theme.colors.placeholder,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  paymentRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  modalContainer: {
    margin: 20,
    padding: 20,
    borderRadius: 8,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 20,
  },
  chip: {
    margin: 4,
  },
  modalButton: {
    marginTop: 15,
  },
  input: {
    marginBottom: 10,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 12,
    marginBottom: 10,
    marginLeft: 5,
  },
});

export default PaymentsScreen;
