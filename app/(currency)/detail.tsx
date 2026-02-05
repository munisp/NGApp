import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Transaction {
  id: string;
  type: 'exchange' | 'receive' | 'send';
  amount: number;
  fromCurrency?: string;
  toCurrency?: string;
  date: string;
  description: string;
}

const CURRENCY_HISTORY_KEY = 'currencyHistory';

const currencies: { [key: string]: { name: string; symbol: string; flag: string } } = {
  USD: { name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  EUR: { name: 'Euro', symbol: '€', flag: '🇪🇺' },
  GBP: { name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  NGN: { name: 'Nigerian Naira', symbol: '₦', flag: '🇳🇬' },
  KES: { name: 'Kenyan Shilling', symbol: 'KSh', flag: '🇰🇪' },
  ZAR: { name: 'South African Rand', symbol: 'R', flag: '🇿🇦' },
  GHS: { name: 'Ghanaian Cedi', symbol: 'GH₵', flag: '🇬🇭' },
};

export default function CurrencyDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const currency = params.currency as string;
  const info = currencies[currency] || currencies.USD;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState(1000);

  useEffect(() => {
    loadHistory();
  }, [currency]);

  const loadHistory = async () => {
    try {
      const stored = await AsyncStorage.getItem(CURRENCY_HISTORY_KEY);
      let history: Transaction[] = [];

      if (stored) {
        history = JSON.parse(stored);
      } else {
        // Generate mock history
        history = [
          {
            id: '1',
            type: 'receive',
            amount: 500,
            date: new Date(Date.now() - 86400000 * 2).toISOString(),
            description: 'Received from savings',
          },
          {
            id: '2',
            type: 'exchange',
            amount: 200,
            fromCurrency: 'USD',
            toCurrency: currency,
            date: new Date(Date.now() - 86400000 * 5).toISOString(),
            description: 'Currency exchange',
          },
          {
            id: '3',
            type: 'send',
            amount: 150,
            date: new Date(Date.now() - 86400000 * 10).toISOString(),
            description: 'International payment',
          },
        ];
        await AsyncStorage.setItem(CURRENCY_HISTORY_KEY, JSON.stringify(history));
      }

      // Filter by currency
      const filtered = history.filter(
        txn =>
          (txn.type === 'exchange' && (txn.fromCurrency === currency || txn.toCurrency === currency)) ||
          txn.type !== 'exchange'
      );

      setTransactions(filtered);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isPositive = item.type === 'receive' || (item.type === 'exchange' && item.toCurrency === currency);

    return (
      <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-1">
            <Text className="text-foreground font-semibold text-base mb-1">
              {item.description}
            </Text>
            <Text className="text-muted text-sm">
              {new Date(item.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
            {item.type === 'exchange' && (
              <Text className="text-muted text-xs mt-1">
                {item.fromCurrency} → {item.toCurrency}
              </Text>
            )}
          </View>
          <Text
            className={`font-bold text-xl ${
              isPositive ? 'text-success' : 'text-error'
            }`}
          >
            {isPositive ? '+' : '-'}{info.symbol}{item.amount.toFixed(2)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: info.name, headerShown: true }} />

      {/* Currency Header */}
      <View className="bg-surface rounded-xl p-6 mb-6 border border-border items-center">
        <Text className="text-8xl mb-4">{info.flag}</Text>
        <Text className="text-foreground font-bold text-2xl mb-2">{currency}</Text>
        <Text className="text-muted mb-4">{info.name}</Text>
        <Text className="text-primary font-bold text-6xl mb-4">
          {info.symbol}{balance.toFixed(2)}
        </Text>
        
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={() => router.push('/(currency)/exchange' as any)}
            className="bg-primary px-6 py-3 rounded-xl"
            style={{ opacity: 1 }}
          >
            <Text className="text-white font-semibold">Exchange</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(payment)/send' as any)}
            className="bg-surface border border-border px-6 py-3 rounded-xl"
            style={{ opacity: 1 }}
          >
            <Text className="text-foreground font-semibold">Send</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Transaction History */}
      <View className="flex-1">
        <Text className="text-foreground font-bold text-lg mb-4">Transaction History</Text>
        
        {transactions.length === 0 ? (
          <View className="flex-1 justify-center items-center">
            <Text className="text-6xl mb-4">{info.flag}</Text>
            <Text className="text-foreground font-semibold text-lg mb-2">No Transactions</Text>
            <Text className="text-muted text-center">
              No transaction history for this currency
            </Text>
          </View>
        ) : (
          <FlatList
            data={transactions}
            renderItem={renderTransaction}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </ScreenContainer>
  );
}
