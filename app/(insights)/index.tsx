import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trpc } from '@/lib/trpc';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  category: string;
  date: string;
  description: string;
}

interface CategorySpending {
  category: string;
  amount: number;
  percentage: number;
  transactions: number;
}

const TRANSACTIONS_KEY = 'insightsTransactions';

// Transaction categories with emojis
const categories = {
  food: { name: 'Food & Dining', emoji: '🍔', color: '#F59E0B' },
  transport: { name: 'Transportation', emoji: '🚗', color: '#3B82F6' },
  shopping: { name: 'Shopping', emoji: '🛍️', color: '#EC4899' },
  bills: { name: 'Bills & Utilities', emoji: '💡', color: '#8B5CF6' },
  entertainment: { name: 'Entertainment', emoji: '🎬', color: '#10B981' },
  health: { name: 'Health & Fitness', emoji: '💊', color: '#EF4444' },
  other: { name: 'Other', emoji: '📦', color: '#6B7280' },
};

export default function SpendingInsightsScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categoryData, setCategoryData] = useState<CategorySpending[]>([]);
  const [totalSpending, setTotalSpending] = useState(0);
  const [insights, setInsights] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeMutation = trpc.insights.analyze.useMutation();

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const stored = await AsyncStorage.getItem(TRANSACTIONS_KEY);
      let txns: Transaction[] = [];
      
      if (stored) {
        txns = JSON.parse(stored);
      } else {
        // Generate mock transactions for demo
        txns = generateMockTransactions();
        await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(txns));
      }

      setTransactions(txns);
      await analyzeSpending(txns);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  };

  const generateMockTransactions = (): Transaction[] => {
    const mockTxns: Transaction[] = [];
    const categoryKeys = Object.keys(categories);
    
    for (let i = 0; i < 30; i++) {
      const category = categoryKeys[Math.floor(Math.random() * categoryKeys.length)];
      const amount = Math.random() * 100 + 10;
      const daysAgo = Math.floor(Math.random() * 30);
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);

      mockTxns.push({
        id: `txn_${i}`,
        type: 'debit',
        amount,
        category,
        date: date.toISOString(),
        description: `${categories[category as keyof typeof categories].name} purchase`,
      });
    }

    return mockTxns;
  };

  const analyzeSpending = async (txns: Transaction[]) => {
    // Calculate total spending
    const total = txns.reduce((sum, txn) => sum + txn.amount, 0);
    setTotalSpending(total);

    try {
      setIsAnalyzing(true);

      // Group by category
      const categoryMap: { [key: string]: { amount: number; count: number } } = {};
      
      txns.forEach(txn => {
        if (!categoryMap[txn.category]) {
          categoryMap[txn.category] = { amount: 0, count: 0 };
        }
        categoryMap[txn.category].amount += txn.amount;
        categoryMap[txn.category].count += 1;
      });

      // Convert to array and sort
      const categoryArray: CategorySpending[] = Object.entries(categoryMap)
        .map(([category, data]) => ({
          category,
          amount: data.amount,
          percentage: (data.amount / total) * 100,
          transactions: data.count,
        }))
        .sort((a, b) => b.amount - a.amount);

      setCategoryData(categoryArray);

      // Call AI backend for insights
      const result = await analyzeMutation.mutateAsync({ transactions: txns });
      setInsights(result.insights);
    } catch (error) {
      console.error('Failed to analyze spending:', error);
      // Fallback to local insights if AI fails
      const fallbackInsights = [
        `Your spending for the last 30 days totals $${total.toFixed(2)}.`,
        `Average daily spending is $${(total / 30).toFixed(2)}.`,
        'Enable AI insights by logging in for personalized recommendations.',
      ];
      setInsights(fallbackInsights);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateLocalInsights = (catData: CategorySpending[], total: number) => {
    const insightsList: string[] = [];

    // Top spending category
    if (catData.length > 0) {
      const topCategory = catData[0];
      const categoryInfo = categories[topCategory.category as keyof typeof categories];
      insightsList.push(
        `Your highest spending is on ${categoryInfo.name} (${topCategory.percentage.toFixed(0)}% of total). Consider setting a budget limit for this category.`
      );
    }

    // Average daily spending
    const avgDaily = total / 30;
    insightsList.push(
      `Your average daily spending is $${avgDaily.toFixed(2)}. This projects to $${(avgDaily * 365).toFixed(2)} annually.`
    );

    // Spending pattern
    if (catData.length >= 2) {
      const secondCategory = catData[1];
      const categoryInfo = categories[secondCategory.category as keyof typeof categories];
      insightsList.push(
        `${categoryInfo.name} is your second-largest expense at $${secondCategory.amount.toFixed(2)}. Look for ways to optimize these costs.`
      );
    }

    // Recommendation
    insightsList.push(
      `💡 Tip: Try the 50/30/20 rule - allocate 50% for needs, 30% for wants, and 20% for savings and debt repayment.`
    );

    setInsights(insightsList);
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Spending Insights', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Total Spending */}
        <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30 items-center">
          <Text className="text-foreground font-bold text-xl mb-2">This Month's Spending</Text>
          <Text className="text-primary font-bold text-6xl mb-2">
            ${totalSpending.toFixed(2)}
          </Text>
          <Text className="text-muted">Last 30 days</Text>
        </View>

        {/* AI Insights */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <View className="flex-row items-center mb-4">
            <Text className="text-2xl mr-2">🤖</Text>
            <Text className="text-foreground font-bold text-lg">AI Insights</Text>
          </View>
          
          {isAnalyzing ? (
            <View className="items-center py-6">
              <ActivityIndicator size="large" color="#0a7ea4" />
              <Text className="text-muted mt-3">Analyzing your spending...</Text>
            </View>
          ) : insights.length > 0 ? (
            insights.map((insight, index) => (
              <View key={index} className="bg-primary/10 rounded-xl p-4 mb-3">
                <Text className="text-foreground text-sm leading-relaxed">{insight}</Text>
              </View>
            ))
          ) : (
            <Text className="text-muted text-center">No insights available</Text>
          )}
        </View>

        {/* Spending by Category */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-4">Spending by Category</Text>
          
          {categoryData.map((cat) => {
            const categoryInfo = categories[cat.category as keyof typeof categories];
            return (
              <TouchableOpacity
                key={cat.category}
                onPress={() => router.push(`/(insights)/category?cat=${cat.category}` as any)}
                className="mb-4"
                style={{ opacity: 1 }}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center flex-1">
                    <Text className="text-3xl mr-3">{categoryInfo.emoji}</Text>
                    <View className="flex-1">
                      <Text className="text-foreground font-semibold">
                        {categoryInfo.name}
                      </Text>
                      <Text className="text-muted text-sm">
                        {cat.transactions} transaction{cat.transactions !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className="text-foreground font-bold text-lg">
                      ${cat.amount.toFixed(2)}
                    </Text>
                    <Text className="text-muted text-sm">
                      {cat.percentage.toFixed(0)}%
                    </Text>
                  </View>
                </View>
                
                {/* Progress Bar */}
                <View className="bg-border rounded-full h-2 overflow-hidden">
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${cat.percentage}%`,
                      backgroundColor: categoryInfo.color,
                    }}
                  />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Monthly Trend */}
        <TouchableOpacity
          onPress={() => router.push('/(insights)/trends' as any)}
          className="bg-primary rounded-xl p-4 mb-6"
          style={{ opacity: 1 }}
        >
          <Text className="text-white text-center font-semibold text-lg">
            📊 View Monthly Trends
          </Text>
        </TouchableOpacity>

        {/* Tips */}
        <View className="bg-success/10 rounded-xl p-4 mb-6 border border-success/30">
          <Text className="text-success font-semibold mb-2">💰 Money-Saving Tips</Text>
          <Text className="text-muted text-sm mb-2">
            • Set spending limits for each category
          </Text>
          <Text className="text-muted text-sm mb-2">
            • Review subscriptions and cancel unused ones
          </Text>
          <Text className="text-muted text-sm">
            • Use budgeting tools to track your progress
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
