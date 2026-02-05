import { useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { trpc } from '@/lib/trpc';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';

const CATEGORIES = [
  { id: 'food', name: 'Food & Dining', icon: '🍽️', color: '#FF6B6B' },
  { id: 'transport', name: 'Transport', icon: '🚗', color: '#4ECDC4' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#FFE66D' },
  { id: 'bills', name: 'Bills & Utilities', icon: '💡', color: '#95E1D3' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#C7CEEA' },
  { id: 'health', name: 'Health & Fitness', icon: '💊', color: '#FF8B94' },
  { id: 'other', name: 'Other', icon: '📦', color: '#A8DADC' },
];

export default function CategorizeTransactionsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<string | null>(null);

  // Fetch uncategorized transactions
  const { data: transactions, isLoading, refetch } = trpc.openBanking.getTransactions.useQuery({
    accountId: '',
  });

  const categorizeMutation = trpc.categorization.categorizeSingle.useMutation();

  const handleRefresh = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleBulkCategorize = async () => {
    if (!transactions || transactions.length === 0) return;

    setCategorizing(true);
    try {
      // Get uncategorized transactions
      const uncategorized = transactions.filter((t: any) => !t.category || t.category === 'other');

      for (const transaction of uncategorized) {
        try {
          await categorizeMutation.mutateAsync({
            description: transaction.description,
            merchant: transaction.description,
          });
        } catch (error) {
          console.error(`Failed to categorize transaction ${transaction.id}:`, error);
        }
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      await refetch();
    } catch (error) {
      console.error('Bulk categorization failed:', error);
    } finally {
      setCategorizing(false);
    }
  };

  const handleUpdateCategory = async (transactionId: string, category: string) => {
    try {
      // Update category via categorization API
      await categorizeMutation.mutateAsync({
        description: category,
        merchant: category,
      });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setEditingTransaction(null);
      await refetch();
    } catch (error) {
      console.error('Failed to update category:', error);
    }
  };

  const formatCurrency = (value: number) => {
    return `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getCategoryData = (categoryId: string) => {
    return CATEGORIES.find((c) => c.id === categoryId) || CATEGORIES[6];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer className="p-4">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-4">Loading transactions...</Text>
        </View>
      </ScreenContainer>
    );
  }

  const uncategorizedTransactions = transactions?.filter(
    (t: any) => !t.category || t.category === 'other'
  ) || [];

  return (
    <ScreenContainer className="p-4">
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View className="gap-6">
          {/* Header */}
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.7}
              className="mr-4"
            >
              <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-3xl font-bold text-foreground">Categorize</Text>
              <Text className="text-muted mt-1">
                {uncategorizedTransactions.length} uncategorized transactions
              </Text>
            </View>
          </View>

          {/* Bulk Categorize Button */}
          {uncategorizedTransactions.length > 0 && (
            <TouchableOpacity
              onPress={handleBulkCategorize}
              disabled={categorizing}
              activeOpacity={0.7}
              className="bg-primary rounded-3xl p-5 flex-row items-center justify-center"
            >
              {categorizing ? (
                <>
                  <ActivityIndicator color={colors.background} />
                  <Text className="text-background font-bold text-base ml-3">
                    Categorizing with AI...
                  </Text>
                </>
              ) : (
                <>
                  <IconSymbol name="sparkles" size={20} color={colors.background} />
                  <Text className="text-background font-bold text-base ml-3">
                    Auto-Categorize All with AI
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Transaction List */}
          {uncategorizedTransactions.length > 0 ? (
            <View className="gap-3">
              {uncategorizedTransactions.map((transaction: any) => {
                const categoryData = getCategoryData(transaction.category || 'other');
                const isEditing = editingTransaction === transaction.id;

                return (
                  <View
                    key={transaction.id}
                    className="bg-surface rounded-3xl p-5 border border-border"
                  >
                    <View className="flex-row items-center justify-between mb-3">
                      <View className="flex-1 mr-3">
                        <Text className="text-base font-bold text-foreground mb-1">
                          {transaction.description}
                        </Text>
                        
                        <Text className="text-xs text-muted mt-1">
                          {formatDate(transaction.date)}
                        </Text>
                      </View>
                      <Text
                        className="text-lg font-bold"
                        style={{
                          color: transaction.type === 'debit' ? colors.error : colors.success,
                        }}
                      >
                        {transaction.type === 'debit' ? '-' : '+'}
                        {formatCurrency(parseFloat(transaction.amount))}
                      </Text>
                    </View>

                    {/* Category Selection */}
                    {isEditing ? (
                      <View className="gap-2">
                        <Text className="text-sm font-semibold text-foreground mb-2">
                          Select Category
                        </Text>
                        <View className="flex-row flex-wrap gap-2">
                          {CATEGORIES.map((cat) => (
                            <TouchableOpacity
                              key={cat.id}
                              onPress={() => handleUpdateCategory(transaction.id, cat.id)}
                              activeOpacity={0.7}
                              className="flex-row items-center rounded-2xl px-3 py-2 border"
                              style={{
                                backgroundColor: cat.color + '20',
                                borderColor: cat.color,
                              }}
                            >
                              <Text className="text-base mr-1">{cat.icon}</Text>
                              <Text className="text-xs font-semibold" style={{ color: cat.color }}>
                                {cat.name}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <TouchableOpacity
                          onPress={() => setEditingTransaction(null)}
                          activeOpacity={0.7}
                          className="mt-2"
                        >
                          <Text className="text-sm text-muted text-center">Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => {
                          if (Platform.OS !== 'web') {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }
                          setEditingTransaction(transaction.id);
                        }}
                        activeOpacity={0.7}
                        className="flex-row items-center justify-between p-3 bg-background rounded-2xl"
                      >
                        <View className="flex-row items-center">
                          <View
                            className="w-8 h-8 rounded-xl items-center justify-center mr-2"
                            style={{ backgroundColor: categoryData.color + '20' }}
                          >
                            <Text className="text-base">{categoryData.icon}</Text>
                          </View>
                          <Text className="text-sm font-semibold text-foreground">
                            {categoryData.name}
                          </Text>
                        </View>
                        <IconSymbol name="pencil" size={16} color={colors.muted} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View className="items-center py-12">
              <View
                className="w-24 h-24 rounded-full items-center justify-center mb-4"
                style={{ backgroundColor: colors.success + '15' }}
              >
                <IconSymbol name="checkmark.circle.fill" size={48} color={colors.success} />
              </View>
              <Text className="text-xl font-bold text-foreground mb-2">All Set!</Text>
              <Text className="text-muted text-center px-8">
                All your transactions have been categorized
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
