import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, TextInput, RefreshControl } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/lib/auth-context';
import { accountService, Transaction } from '@/lib/api/services-mock';

export default function TransactionHistoryScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'deposit' | 'withdrawal' | 'transfer'>('all');

  useEffect(() => {
    loadTransactions();
  }, []);

  useEffect(() => {
    filterTransactions();
  }, [transactions, searchQuery, filterType]);

  const loadTransactions = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      if (!isAuthenticated) {
        return;
      }

      // Get transactions from all accounts
      const accounts = await accountService.getAccounts();
      const allTransactions: Transaction[] = [];

      for (const account of accounts) {
        const accountTransactions = await accountService.getTransactions(account.id, 50);
        allTransactions.push(...accountTransactions);
      }

      // Sort by date, most recent first
      allTransactions.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setTransactions(allTransactions);
    } catch (error: any) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterTransactions = () => {
    let filtered = transactions;

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(t => t.type === filterType);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.description.toLowerCase().includes(query) ||
        t.amount.toString().includes(query)
      );
    }

    setFilteredTransactions(filtered);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return '💰';
      case 'withdrawal':
        return '💸';
      case 'transfer':
        return '🔄';
      default:
        return '📝';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-success';
      case 'pending':
        return 'text-warning';
      case 'failed':
        return 'text-error';
      default:
        return 'text-muted';
    }
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <Text className="text-2xl mr-3">{getTransactionIcon(item.type)}</Text>
          <View className="flex-1">
            <Text className="text-foreground font-semibold">{item.description}</Text>
            <Text className="text-muted text-xs">
              {new Date(item.created_at).toLocaleDateString()} • {new Date(item.created_at).toLocaleTimeString()}
            </Text>
          </View>
        </View>
        <View className="items-end">
          <Text
            className={`text-lg font-bold ${
              item.type === 'deposit' ? 'text-success' : 'text-foreground'
            }`}
          >
            {item.type === 'deposit' ? '+' : '-'}
            {item.currency} {item.amount.toFixed(2)}
          </Text>
          <Text className={`text-xs font-medium ${getStatusColor(item.status)}`}>
            {item.status}
          </Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ title: 'Transaction History' }} />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0a7ea4" />
          <Text className="text-muted mt-4">Loading transactions...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Transaction History' }} />

      {/* Search Bar */}
      <View className="mb-4">
        <TextInput
          className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
          placeholder="Search transactions..."
          placeholderTextColor="#9BA1A6"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filter Buttons */}
      <View className="flex-row gap-2 mb-4">
        {(['all', 'deposit', 'withdrawal', 'transfer'] as const).map((type) => (
          <TouchableOpacity
            key={type}
            onPress={() => setFilterType(type)}
            className={`px-4 py-2 rounded-full ${
              filterType === type ? 'bg-primary' : 'bg-surface border border-border'
            }`}
            style={{ opacity: 1 }}
          >
            <Text
              className={`text-sm font-medium ${
                filterType === type ? 'text-white' : 'text-foreground'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Transactions List */}
      <FlatList
        data={filteredTransactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadTransactions(true)} />
        }
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center py-20">
            <Text className="text-6xl mb-4">📭</Text>
            <Text className="text-xl font-semibold text-foreground mb-2">No Transactions</Text>
            <Text className="text-muted text-center">
              {searchQuery || filterType !== 'all'
                ? 'No transactions match your filters'
                : 'You don\'t have any transactions yet'}
            </Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}
