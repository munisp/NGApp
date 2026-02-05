import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface MerchantTransaction {
  id: string;
  merchantId: string;
  merchantName: string;
  category: string;
  amount: number;
  date: string;
  status: string;
}

const MERCHANT_TRANSACTIONS_KEY = 'merchantTransactions';

const categoryEmojis: { [key: string]: string } = {
  restaurant: '🍽️',
  grocery: '🛒',
  retail: '🛍️',
  gas: '⛽',
  entertainment: '🎬',
  health: '🏥',
  other: '🏪',
};

export default function MerchantHistoryScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<MerchantTransaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const stored = await AsyncStorage.getItem(MERCHANT_TRANSACTIONS_KEY);
      let txns: MerchantTransaction[] = [];

      if (stored) {
        txns = JSON.parse(stored);
      } else {
        // Generate sample data
        txns = [
          {
            id: '1',
            merchantId: 'm1',
            merchantName: 'Starbucks Coffee',
            category: 'restaurant',
            amount: 12.5,
            date: new Date(Date.now() - 86400000).toISOString(),
            status: 'completed',
          },
          {
            id: '2',
            merchantId: 'm2',
            merchantName: 'Whole Foods Market',
            category: 'grocery',
            amount: 85.3,
            date: new Date(Date.now() - 2 * 86400000).toISOString(),
            status: 'completed',
          },
          {
            id: '3',
            merchantId: 'm3',
            merchantName: 'Shell Gas Station',
            category: 'gas',
            amount: 45.0,
            date: new Date(Date.now() - 3 * 86400000).toISOString(),
            status: 'completed',
          },
        ];
        await AsyncStorage.setItem(MERCHANT_TRANSACTIONS_KEY, JSON.stringify(txns));
      }

      setTransactions(txns);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  };

  const filteredTransactions =
    filter === 'all' ? transactions : transactions.filter(t => t.category === filter);

  const categories = ['all', ...Array.from(new Set(transactions.map(t => t.category)))];

  const totalSpent = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);

  const renderTransaction = ({ item }: { item: MerchantTransaction }) => {
    const emoji = categoryEmojis[item.category] || categoryEmojis.other;

    return (
      <TouchableOpacity
        onPress={() => router.push(`/(merchant)/receipt?id=${item.id}` as any)}
        className="bg-surface rounded-xl p-4 mb-3 border border-border"
        style={{ opacity: 1 }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <Text className="text-4xl mr-4">{emoji}</Text>
            <View className="flex-1">
              <Text className="text-foreground font-semibold text-base mb-1">
                {item.merchantName}
              </Text>
              <Text className="text-muted text-sm capitalize">{item.category}</Text>
              <Text className="text-muted text-xs mt-1">
                {new Date(item.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </View>
          <Text className="text-foreground font-bold text-xl">
            ${item.amount.toFixed(2)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Merchant Payments', headerShown: true }} />

      {/* Total Spent */}
      <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30">
        <Text className="text-muted mb-2">Total Merchant Spending</Text>
        <Text className="text-primary font-bold text-5xl mb-2">
          ${totalSpent.toFixed(2)}
        </Text>
        <Text className="text-muted text-sm">
          {filteredTransactions.length} {filteredTransactions.length === 1 ? 'transaction' : 'transactions'}
        </Text>
      </View>

      {/* Category Filter */}
      <View className="mb-4">
        <Text className="text-foreground font-semibold mb-3">Filter by Category</Text>
        <FlatList
          horizontal
          data={categories}
          keyExtractor={item => item}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setFilter(item)}
              className={`mr-3 px-4 py-2 rounded-xl ${
                filter === item ? 'bg-primary' : 'bg-surface border border-border'
              }`}
              style={{ opacity: 1 }}
            >
              <Text
                className={`font-semibold capitalize ${
                  filter === item ? 'text-white' : 'text-foreground'
                }`}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Transactions List */}
      {filteredTransactions.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-6xl mb-4">🏪</Text>
          <Text className="text-foreground font-semibold text-lg mb-2">No Transactions</Text>
          <Text className="text-muted text-center mb-6">
            Start making merchant payments to see your history
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(merchant)/pay' as any)}
            className="bg-primary px-6 py-3 rounded-xl"
            style={{ opacity: 1 }}
          >
            <Text className="text-white font-semibold">Scan Merchant QR</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredTransactions}
          renderItem={renderTransaction}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0a7ea4" />
          }
          ListFooterComponent={
            <TouchableOpacity
              onPress={() => router.push('/(merchant)/pay' as any)}
              className="bg-primary rounded-xl p-4 mb-6 mt-3"
              style={{ opacity: 1 }}
            >
              <Text className="text-white text-center font-semibold text-lg">
                📷 Scan New Merchant QR
              </Text>
            </TouchableOpacity>
          }
        />
      )}
    </ScreenContainer>
  );
}
