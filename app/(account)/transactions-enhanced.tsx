import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import { accountService, Transaction } from '@/lib/api/services-mock';
import { exportAsCSV, exportAsPDF } from '@/lib/export-transactions';

type TransactionType = 'all' | 'deposit' | 'withdrawal' | 'transfer';

interface FilterState {
  searchQuery: string;
  transactionType: TransactionType;
  minAmount: string;
  maxAmount: string;
  startDate: string;
  endDate: string;
}

export default function TransactionsEnhancedScreen() {
  const params = useLocalSearchParams();
  const accountId = params.accountId as string;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    transactionType: 'all',
    minAmount: '',
    maxAmount: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    loadTransactions();
  }, [accountId]);

  useEffect(() => {
    applyFilters();
  }, [transactions, filters]);

  const loadTransactions = async () => {
    try {
      setIsLoading(true);
      const data = await accountService.getTransactions(accountId || '');
      setTransactions(data);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...transactions];

    // Search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        tx =>
          tx.description?.toLowerCase().includes(query) ||
          tx.type.toLowerCase().includes(query)
      );
    }

    // Transaction type filter
    if (filters.transactionType !== 'all') {
      filtered = filtered.filter(tx => tx.type === filters.transactionType);
    }

    // Amount range filter
    if (filters.minAmount) {
      const min = parseFloat(filters.minAmount);
      filtered = filtered.filter(tx => tx.amount >= min);
    }
    if (filters.maxAmount) {
      const max = parseFloat(filters.maxAmount);
      filtered = filtered.filter(tx => tx.amount <= max);
    }

    // Date range filter
    if (filters.startDate) {
      const start = new Date(filters.startDate);
      filtered = filtered.filter(tx => new Date(tx.created_at) >= start);
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59);
      filtered = filtered.filter(tx => new Date(tx.created_at) <= end);
    }

    setFilteredTransactions(filtered);
  };

  const clearFilters = () => {
    setFilters({
      searchQuery: '',
      transactionType: 'all',
      minAmount: '',
      maxAmount: '',
      startDate: '',
      endDate: '',
    });
  };

  const hasActiveFilters = () => {
    return (
      filters.searchQuery ||
      filters.transactionType !== 'all' ||
      filters.minAmount ||
      filters.maxAmount ||
      filters.startDate ||
      filters.endDate
    );
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isCredit = item.type === 'deposit';
    const amountColor = isCredit ? 'text-success' : 'text-error';
    const amountPrefix = isCredit ? '+' : '-';

    return (
      <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1">
            <Text className="text-foreground font-semibold text-base mb-1">
              {item.description || 'Transaction'}
            </Text>
            <Text className="text-muted text-sm">
              {item.description}
            </Text>
          </View>
          <Text className={`${amountColor} font-bold text-lg`}>
            {amountPrefix}${item.amount.toFixed(2)}
          </Text>
        </View>
        <View className="flex-row justify-between items-center">
          <Text className="text-muted text-xs">
            {new Date(item.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          <View
            className={`px-2 py-1 rounded ${
              item.status === 'completed' ? 'bg-success/20' : 'bg-warning/20'
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                item.status === 'completed' ? 'text-success' : 'text-warning'
              }`}
            >
              {item.status}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Transaction History', headerShown: true }} />

      {/* Search Bar */}
      <View className="mb-4">
        <TextInput
          value={filters.searchQuery}
          onChangeText={text => setFilters(prev => ({ ...prev, searchQuery: text }))}
          placeholder="Search transactions..."
          placeholderTextColor="#9BA1A6"
          className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
        />
      </View>

      {/* Export and Filter Row */}
      <View className="flex-row justify-between items-center mb-4 gap-2">
        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              'Export Transactions',
              'Choose export format',
              [
                {
                  text: 'CSV',
                  onPress: async () => {
                    try {
                      await exportAsCSV(filteredTransactions);
                      Alert.alert('Success', 'Transactions exported as CSV');
                    } catch (error) {
                      Alert.alert('Error', 'Failed to export transactions');
                    }
                  },
                },
                {
                  text: 'PDF',
                  onPress: async () => {
                    try {
                      await exportAsPDF(filteredTransactions);
                      Alert.alert('Success', 'Transactions exported as PDF');
                    } catch (error) {
                      Alert.alert('Error', 'Failed to export transactions');
                    }
                  },
                },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
          className="bg-success/20 border border-success rounded-xl px-4 py-2"
          style={{ opacity: 1 }}
        >
          <Text className="text-success font-medium">📥 Export</Text>
        </TouchableOpacity>

        <View className="flex-row gap-2 flex-1">
        <TouchableOpacity
          onPress={() => setShowFilters(!showFilters)}
          className="flex-row items-center bg-surface border border-border rounded-xl px-4 py-2"
          style={{ opacity: 1 }}
        >
          <Text className="text-foreground mr-2">🔍 Filters</Text>
          {hasActiveFilters() && (
            <View className="bg-primary rounded-full w-2 h-2" />
          )}
        </TouchableOpacity>

        {hasActiveFilters() && (
          <TouchableOpacity
            onPress={clearFilters}
            className="bg-error/20 rounded-xl px-4 py-2"
            style={{ opacity: 1 }}
          >
            <Text className="text-error font-medium">Clear All</Text>
          </TouchableOpacity>
        )}
        </View>
      </View>

      {/* Filter Panel */}
      {showFilters && (
        <ScrollView className="bg-surface rounded-xl p-4 mb-4 border border-border">
          {/* Transaction Type */}
          <Text className="text-foreground font-semibold mb-2">Transaction Type</Text>
          <View className="flex-row gap-2 mb-4">
            {(['all', 'deposit', 'withdrawal', 'transfer'] as TransactionType[]).map(type => (
              <TouchableOpacity
                key={type}
                onPress={() => setFilters(prev => ({ ...prev, transactionType: type }))}
                className={`flex-1 rounded-xl py-2 ${
                  filters.transactionType === type
                    ? 'bg-primary'
                    : 'bg-background border border-border'
                }`}
                style={{ opacity: 1 }}
              >
                <Text
                  className={`text-center font-medium ${
                    filters.transactionType === type ? 'text-white' : 'text-foreground'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Amount Range */}
          <Text className="text-foreground font-semibold mb-2">Amount Range</Text>
          <View className="flex-row gap-2 mb-4">
            <TextInput
              value={filters.minAmount}
              onChangeText={text => setFilters(prev => ({ ...prev, minAmount: text }))}
              placeholder="Min"
              keyboardType="numeric"
              placeholderTextColor="#9BA1A6"
              className="flex-1 bg-background border border-border rounded-xl px-4 py-2 text-foreground"
            />
            <TextInput
              value={filters.maxAmount}
              onChangeText={text => setFilters(prev => ({ ...prev, maxAmount: text }))}
              placeholder="Max"
              keyboardType="numeric"
              placeholderTextColor="#9BA1A6"
              className="flex-1 bg-background border border-border rounded-xl px-4 py-2 text-foreground"
            />
          </View>

          {/* Date Range */}
          <Text className="text-foreground font-semibold mb-2">Date Range</Text>
          <View className="flex-row gap-2 mb-2">
            <TextInput
              value={filters.startDate}
              onChangeText={text => setFilters(prev => ({ ...prev, startDate: text }))}
              placeholder="Start (YYYY-MM-DD)"
              placeholderTextColor="#9BA1A6"
              className="flex-1 bg-background border border-border rounded-xl px-4 py-2 text-foreground"
            />
            <TextInput
              value={filters.endDate}
              onChangeText={text => setFilters(prev => ({ ...prev, endDate: text }))}
              placeholder="End (YYYY-MM-DD)"
              placeholderTextColor="#9BA1A6"
              className="flex-1 bg-background border border-border rounded-xl px-4 py-2 text-foreground"
            />
          </View>
        </ScrollView>
      )}

      {/* Results Count */}
      <Text className="text-muted text-sm mb-3">
        Showing {filteredTransactions.length} of {transactions.length} transactions
      </Text>

      {/* Transaction List */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0a7ea4" />
        </View>
      ) : filteredTransactions.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-6xl mb-4">📭</Text>
          <Text className="text-foreground font-semibold text-lg mb-2">No Transactions Found</Text>
          <Text className="text-muted text-center">
            {hasActiveFilters() ? 'Try adjusting your filters' : 'No transactions yet'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredTransactions}
          renderItem={renderTransaction}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}
