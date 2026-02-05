import { useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { trpc } from '@/lib/trpc';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

type TransactionType = 'all' | 'debit' | 'credit';
type TransactionStatus = 'all' | 'completed' | 'pending' | 'failed';

export default function TransactionsScreen() {
  const colors = useColors();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionType>('all');
  const [statusFilter, setStatusFilter] = useState<TransactionStatus>('all');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const pageSize = 50;

  // Get linked accounts first
  const { data: accountsData } = trpc.openBanking.getLinkedAccounts.useQuery();
  const accounts = accountsData || [];

  // Use first account if available
  const selectedAccountId = accountId || accounts[0]?.id || '';

  const { data: transactions = [], isLoading, refetch, isFetching } = trpc.openBanking.getTransactions.useQuery(
    {
      accountId: selectedAccountId,
      limit: pageSize,
    },
    {
      enabled: !!selectedAccountId,
    }
  );

  // Filter transactions based on search and filters
  const filteredTransactions = transactions.filter((txn: any) => {
    const matchesSearch =
      searchQuery === '' ||
      txn.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.merchant?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType =
      typeFilter === 'all' ||
      txn.type === typeFilter;

    const matchesStatus =
      statusFilter === 'all' ||
      txn.status === statusFilter;

    // Date range filter
    const txnDate = new Date(txn.transactionDate || txn.date);
    const matchesDateFrom = !dateFrom || txnDate >= new Date(dateFrom);
    const matchesDateTo = !dateTo || txnDate <= new Date(dateTo);

    // Amount range filter
    const txnAmount = Math.abs(parseFloat(txn.amount));
    const matchesAmountMin = !amountMin || txnAmount >= parseFloat(amountMin);
    const matchesAmountMax = !amountMax || txnAmount <= parseFloat(amountMax);

    // Category filter
    const matchesCategory = categoryFilter === 'all' || txn.category === categoryFilter;

    return matchesSearch && matchesType && matchesStatus && matchesDateFrom && matchesDateTo && matchesAmountMin && matchesAmountMax && matchesCategory;
  });

  // Get unique categories from transactions
  const categories = ['all', ...new Set(transactions.map((t: any) => t.category).filter(Boolean))];

  const handleRefresh = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    refetch();
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setAmountMin('');
    setAmountMax('');
    setCategoryFilter('all');
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const hasActiveFilters = searchQuery !== '' || typeFilter !== 'all' || statusFilter !== 'all' || dateFrom !== '' || dateTo !== '' || amountMin !== '' || amountMax !== '' || categoryFilter !== 'all';

  const handleLoadMore = () => {
    // Pagination handled by limit parameter
  };

  const formatAmount = (amount: number, type: string) => {
    const sign = type === 'debit' ? '-' : '+';
    return `${sign}₦${Math.abs(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return colors.success;
      case 'pending':
        return colors.warning;
      case 'failed':
        return colors.error;
      default:
        return colors.muted;
    }
  };

  const renderTransaction = ({ item }: { item: any }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      className="bg-surface rounded-2xl p-4 mb-3 border border-border"
      onPress={() => {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }}
    >
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
            {item.description || item.merchant || 'Transaction'}
          </Text>
          <Text className="text-sm text-muted mt-1">{formatDate(item.date)}</Text>
        </View>
        <View className="items-end ml-3">
          <Text
            className="text-lg font-bold"
            style={{
              color: item.type === 'debit' ? colors.error : colors.success,
            }}
          >
            {formatAmount(item.amount, item.type)}
          </Text>
          <View
            className="px-2 py-0.5 rounded mt-1"
            style={{ backgroundColor: `${getStatusColor(item.status)}20` }}
          >
            <Text className="text-xs font-medium" style={{ color: getStatusColor(item.status) }}>
              {item.status}
            </Text>
          </View>
        </View>
      </View>
      {item.category && (
        <View className="flex-row items-center mt-2">
          <View className="px-2 py-1 rounded" style={{ backgroundColor: colors.primary + '20' }}>
            <Text className="text-xs font-medium" style={{ color: colors.primary }}>
              {item.category}
            </Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderFilterButton = (
    label: string,
    value: string,
    currentValue: string,
    onPress: () => void
  ) => (
    <TouchableOpacity
      onPress={() => {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress();
      }}
      className="px-4 py-2 rounded-full mr-2"
      style={{
        backgroundColor: currentValue === value ? colors.primary : colors.surface,
      }}
    >
      <Text
        className="text-sm font-medium"
        style={{
          color: currentValue === value ? colors.background : colors.foreground,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer className="p-4">
      <View className="flex-1">
        {/* Header */}
        <View className="mb-4">
          <Text className="text-3xl font-bold text-foreground">Transactions</Text>
          <Text className="text-muted mt-1">View your transaction history</Text>
        </View>

        {/* Search Bar */}
        <View className="mb-4">
          <View className="flex-row items-center bg-surface rounded-2xl px-4 py-3 border border-border">
            <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search transactions..."
              className="flex-1 ml-3 text-foreground"
              placeholderTextColor={colors.muted}
            />
            {searchQuery !== '' && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                activeOpacity={0.7}
              >
                <IconSymbol name="xmark.circle.fill" size={20} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Type Filter */}
        <View className="mb-3">
          <Text className="text-sm font-medium text-foreground mb-2">Type</Text>
          <View className="flex-row">
            {renderFilterButton('All', 'all', typeFilter, () => setTypeFilter('all'))}
            {renderFilterButton('Debit', 'debit', typeFilter, () => setTypeFilter('debit'))}
            {renderFilterButton('Credit', 'credit', typeFilter, () => setTypeFilter('credit'))}
          </View>
        </View>

        {/* Status Filter */}
        <View className="mb-3">
          <Text className="text-sm font-medium text-foreground mb-2">Status</Text>
          <View className="flex-row">
            {renderFilterButton('All', 'all', statusFilter, () => setStatusFilter('all'))}
            {renderFilterButton('Completed', 'completed', statusFilter, () => setStatusFilter('completed'))}
            {renderFilterButton('Pending', 'pending', statusFilter, () => setStatusFilter('pending'))}
            {renderFilterButton('Failed', 'failed', statusFilter, () => setStatusFilter('failed'))}
          </View>
        </View>

        {/* Advanced Filters Toggle & Clear */}
        <View className="flex-row items-center justify-between mb-3">
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              setShowAdvancedFilters(!showAdvancedFilters);
            }}
            className="flex-row items-center"
            activeOpacity={0.7}
          >
            <IconSymbol name="slider.horizontal.3" size={20} color={colors.primary} />
            <Text className="text-sm font-semibold ml-2" style={{ color: colors.primary }}>
              {showAdvancedFilters ? 'Hide' : 'Show'} Advanced Filters
            </Text>
          </TouchableOpacity>
          {hasActiveFilters && (
            <TouchableOpacity
              onPress={clearAllFilters}
              activeOpacity={0.7}
              className="px-3 py-1 rounded-full"
              style={{ backgroundColor: colors.error + '20' }}
            >
              <Text className="text-xs font-semibold" style={{ color: colors.error }}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
            {/* Date Range */}
            <View className="mb-4">
              <Text className="text-sm font-semibold text-foreground mb-2">Date Range</Text>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Text className="text-xs text-muted mb-1">From</Text>
                  <TextInput
                    value={dateFrom}
                    onChangeText={setDateFrom}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.muted}
                    className="bg-background border border-border rounded-xl px-3 py-2 text-foreground text-sm"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted mb-1">To</Text>
                  <TextInput
                    value={dateTo}
                    onChangeText={setDateTo}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.muted}
                    className="bg-background border border-border rounded-xl px-3 py-2 text-foreground text-sm"
                  />
                </View>
              </View>
            </View>

            {/* Amount Range */}
            <View className="mb-4">
              <Text className="text-sm font-semibold text-foreground mb-2">Amount Range (₦)</Text>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Text className="text-xs text-muted mb-1">Min</Text>
                  <TextInput
                    value={amountMin}
                    onChangeText={setAmountMin}
                    placeholder="0"
                    keyboardType="numeric"
                    placeholderTextColor={colors.muted}
                    className="bg-background border border-border rounded-xl px-3 py-2 text-foreground text-sm"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted mb-1">Max</Text>
                  <TextInput
                    value={amountMax}
                    onChangeText={setAmountMax}
                    placeholder="1000000"
                    keyboardType="numeric"
                    placeholderTextColor={colors.muted}
                    className="bg-background border border-border rounded-xl px-3 py-2 text-foreground text-sm"
                  />
                </View>
              </View>
            </View>

            {/* Category Filter */}
            <View>
              <Text className="text-sm font-semibold text-foreground mb-2">Category</Text>
              <View className="flex-row flex-wrap gap-2">
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => {
                      if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                      setCategoryFilter(cat);
                    }}
                    activeOpacity={0.7}
                    className="px-3 py-2 rounded-full"
                    style={{
                      backgroundColor: categoryFilter === cat ? colors.primary : colors.background,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text
                      className="text-xs font-medium capitalize"
                      style={{ color: categoryFilter === cat ? colors.background : colors.foreground }}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Results Count */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-sm text-muted">
            {filteredTransactions.length} {filteredTransactions.length === 1 ? 'transaction' : 'transactions'} found
          </Text>
        </View>

        {/* Transactions List */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="text-muted mt-4">Loading transactions...</Text>
          </View>
        ) : filteredTransactions.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <IconSymbol name="doc.text" size={64} color={colors.muted} />
            <Text className="text-lg font-semibold text-foreground mt-4">No transactions found</Text>
            <Text className="text-muted mt-2 text-center">
              {searchQuery || typeFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Your transactions will appear here'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredTransactions}
            renderItem={renderTransaction}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={isFetching}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              isFetching ? (
                <View className="py-4">
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : null
            }
          />
        )}
      </View>
    </ScreenContainer>
  );
}
