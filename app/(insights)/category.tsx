import { View, Text, FlatList } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  category: string;
  date: string;
  description: string;
}

const TRANSACTIONS_KEY = 'insightsTransactions';

const categories = {
  food: { name: 'Food & Dining', emoji: '🍔', color: '#F59E0B' },
  transport: { name: 'Transportation', emoji: '🚗', color: '#3B82F6' },
  shopping: { name: 'Shopping', emoji: '🛍️', color: '#EC4899' },
  bills: { name: 'Bills & Utilities', emoji: '💡', color: '#8B5CF6' },
  entertainment: { name: 'Entertainment', emoji: '🎬', color: '#10B981' },
  health: { name: 'Health & Fitness', emoji: '💊', color: '#EF4444' },
  other: { name: 'Other', emoji: '📦', color: '#6B7280' },
};

export default function CategoryDetailScreen() {
  const params = useLocalSearchParams();
  const categoryKey = params.cat as string;
  const categoryInfo = categories[categoryKey as keyof typeof categories] || categories.other;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadCategoryTransactions();
  }, [categoryKey]);

  const loadCategoryTransactions = async () => {
    try {
      const stored = await AsyncStorage.getItem(TRANSACTIONS_KEY);
      if (stored) {
        const allTxns: Transaction[] = JSON.parse(stored);
        const filtered = allTxns.filter(txn => txn.category === categoryKey);
        setTransactions(filtered);
        const sum = filtered.reduce((acc, txn) => acc + txn.amount, 0);
        setTotal(sum);
      }
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
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
          </View>
          <Text className="text-foreground font-bold text-xl">
            ${item.amount.toFixed(2)}
          </Text>
        </View>
      </View>
    );
  };

  const avgTransaction = transactions.length > 0 ? total / transactions.length : 0;

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: categoryInfo.name, headerShown: true }} />

      {/* Category Header */}
      <View className="bg-surface rounded-xl p-6 mb-6 border border-border items-center">
        <Text className="text-6xl mb-3">{categoryInfo.emoji}</Text>
        <Text className="text-foreground font-bold text-2xl mb-2">{categoryInfo.name}</Text>
        <Text className="text-primary font-bold text-5xl mb-4">
          ${total.toFixed(2)}
        </Text>
        <View className="flex-row gap-6">
          <View className="items-center">
            <Text className="text-muted text-sm mb-1">Transactions</Text>
            <Text className="text-foreground font-bold text-xl">{transactions.length}</Text>
          </View>
          <View className="items-center">
            <Text className="text-muted text-sm mb-1">Average</Text>
            <Text className="text-foreground font-bold text-xl">${avgTransaction.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Transactions List */}
      {transactions.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-6xl mb-4">{categoryInfo.emoji}</Text>
          <Text className="text-foreground font-semibold text-lg mb-2">No Transactions</Text>
          <Text className="text-muted text-center">
            No transactions found in this category
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
    </ScreenContainer>
  );
}
