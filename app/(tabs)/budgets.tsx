import { useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Modal, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { trpc } from '@/lib/trpc';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { DEMO } from '@/lib/demo-data';

const CATEGORIES= [
  { id: 'food', name: 'Food & Dining', icon: '🍽️', color: '#FF6B6B' },
  { id: 'transport', name: 'Transport', icon: '🚗', color: '#4ECDC4' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#FFE66D' },
  { id: 'bills', name: 'Bills & Utilities', icon: '💡', color: '#95E1D3' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#C7CEEA' },
  { id: 'health', name: 'Health & Fitness', icon: '💊', color: '#FF8B94' },
  { id: 'other', name: 'Other', icon: '📦', color: '#A8DADC' },
];

export default function BudgetsScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('food');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [alertThreshold, setAlertThreshold] = useState('80');

    const { data: _budgets, isLoading, isError: budgetsError, refetch } = trpc.budgets.getBudgets.useQuery();
    const { data: _budgetStatus, isError: statusError } = trpc.budgets.getBudgetStatus.useQuery({});
    const budgets = budgetsError ? DEMO.budgets : _budgets;
    const budgetStatus = statusError ? DEMO.budgetStatus : _budgetStatus;
  const createBudgetMutation = trpc.budgets.createBudget.useMutation();
  const deleteBudgetMutation = trpc.budgets.deleteBudget.useMutation();
  const updateBudgetMutation = trpc.budgets.updateBudget.useMutation();

  const handleRefresh = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleCreateBudget = async () => {
    if (!monthlyLimit || parseFloat(monthlyLimit) <= 0) {
      Alert.alert('Error', 'Please enter a valid monthly limit');
      return;
    }

    try {
      await createBudgetMutation.mutateAsync({
        category: selectedCategory as any,
        monthlyLimit: parseFloat(monthlyLimit),
        alertThreshold: parseFloat(alertThreshold) / 100,
      });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setShowCreateModal(false);
      setMonthlyLimit('');
      setAlertThreshold('80');
      await refetch();
    } catch (error) {
      Alert.alert('Error', 'Failed to create budget');
    }
  };

  const handleDeleteBudget = async (budgetId: string) => {
    Alert.alert(
      'Delete Budget',
      'Are you sure you want to delete this budget?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBudgetMutation.mutateAsync({ budgetId });
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              await refetch();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete budget');
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (value: number) => {
    return `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getCategoryData = (categoryId: string) => {
    return CATEGORIES.find((c) => c.id === categoryId) || CATEGORIES[6];
  };

    if (isLoading && !budgetsError) {
      return (
        <ScreenContainer className="p-4">
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="text-muted mt-4">Loading budgets...</Text>
          </View>
        </ScreenContainer>
      );
    }

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
            <View>
              <Text className="text-3xl font-bold text-foreground">Budgets</Text>
              <Text className="text-muted mt-1">Track your spending by category</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                setShowCreateModal(true);
              }}
              activeOpacity={0.7}
              className="bg-primary rounded-2xl w-12 h-12 items-center justify-center"
            >
              <IconSymbol name="plus" size={24} color={colors.background} />
            </TouchableOpacity>
          </View>

          {/* Budget Cards */}
          {budgets && budgets.length > 0 ? (
            <View className="gap-4">
              {budgets.map((budget: any) => {
                const categoryData = getCategoryData(budget.category);
                const status = budgetStatus?.find((s: any) => s.budgetId === budget.id);
                const percentageUsed = status?.percentageUsed || 0;
                const isOverBudget = status?.isOverBudget || false;
                const isNearLimit = status?.isNearLimit || false;

                return (
                  <View
                    key={budget.id}
                    className="bg-surface rounded-3xl p-6 border border-border"
                  >
                    {/* Category Header */}
                    <View className="flex-row items-center justify-between mb-4">
                      <View className="flex-row items-center flex-1">
                        <View
                          className="w-12 h-12 rounded-2xl items-center justify-center mr-3"
                          style={{ backgroundColor: categoryData.color + '20' }}
                        >
                          <Text className="text-2xl">{categoryData.icon}</Text>
                        </View>
                        <View>
                          <Text className="text-lg font-bold text-foreground">
                            {categoryData.name}
                          </Text>
                          <Text className="text-sm text-muted">
                            {formatCurrency(parseFloat(budget.monthlyLimit))} / month
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDeleteBudget(budget.id)}
                        activeOpacity={0.7}
                      >
                        <IconSymbol name="trash" size={20} color={colors.error} />
                      </TouchableOpacity>
                    </View>

                    {/* Progress Bar */}
                    <View className="mb-3">
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-sm text-muted">
                          {formatCurrency(status?.amountSpent || 0)} spent
                        </Text>
                        <Text
                          className="text-sm font-semibold"
                          style={{
                            color: isOverBudget
                              ? colors.error
                              : isNearLimit
                              ? colors.warning
                              : colors.success,
                          }}
                        >
                          {percentageUsed.toFixed(0)}%
                        </Text>
                      </View>
                      <View className="h-3 bg-background rounded-full overflow-hidden">
                        <View
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(percentageUsed, 100)}%`,
                            backgroundColor: isOverBudget
                              ? colors.error
                              : isNearLimit
                              ? colors.warning
                              : categoryData.color,
                          }}
                        />
                      </View>
                    </View>

                    {/* Status Badge */}
                    {isOverBudget && (
                      <View
                        className="flex-row items-center p-3 rounded-2xl"
                        style={{ backgroundColor: colors.error + '15' }}
                      >
                        <IconSymbol name="exclamationmark.triangle.fill" size={16} color={colors.error} />
                        <Text className="text-sm font-semibold ml-2" style={{ color: colors.error }}>
                          Over budget by {formatCurrency((status?.amountSpent || 0) - parseFloat(budget.monthlyLimit))}
                        </Text>
                      </View>
                    )}
                    {isNearLimit && !isOverBudget && (
                      <View
                        className="flex-row items-center p-3 rounded-2xl"
                        style={{ backgroundColor: colors.warning + '15' }}
                      >
                        <IconSymbol name="exclamationmark.circle.fill" size={16} color={colors.warning} />
                        <Text className="text-sm font-semibold ml-2" style={{ color: colors.warning }}>
                          Approaching limit ({percentageUsed.toFixed(0)}% used)
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View className="items-center py-12">
              <View
                className="w-24 h-24 rounded-full items-center justify-center mb-4"
                style={{ backgroundColor: colors.primary + '15' }}
              >
                <IconSymbol name="chart.bar.fill" size={48} color={colors.primary} />
              </View>
              <Text className="text-xl font-bold text-foreground mb-2">No Budgets Yet</Text>
              <Text className="text-muted text-center px-8 mb-6">
                Create your first budget to start tracking your spending
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setShowCreateModal(true);
                }}
                activeOpacity={0.7}
                className="bg-primary rounded-2xl py-4 px-8"
              >
                <Text className="text-background font-bold text-base">Create Budget</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Create Budget Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View className="bg-background rounded-t-3xl p-6" style={{ maxHeight: '80%' }}>
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-2xl font-bold text-foreground">Create Budget</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)} activeOpacity={0.7}>
                <IconSymbol name="xmark" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              {/* Category Selection */}
              <Text className="text-sm font-semibold text-foreground mb-3">Category</Text>
              <View className="flex-row flex-wrap gap-3 mb-6">
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setSelectedCategory(cat.id)}
                    activeOpacity={0.7}
                    className="flex-row items-center rounded-2xl px-4 py-3 border"
                    style={{
                      backgroundColor:
                        selectedCategory === cat.id ? cat.color + '20' : colors.surface,
                      borderColor: selectedCategory === cat.id ? cat.color : colors.border,
                    }}
                  >
                    <Text className="text-xl mr-2">{cat.icon}</Text>
                    <Text
                      className="text-sm font-semibold"
                      style={{
                        color: selectedCategory === cat.id ? cat.color : colors.foreground,
                      }}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Monthly Limit */}
              <Text className="text-sm font-semibold text-foreground mb-3">Monthly Limit (₦)</Text>
              <TextInput
                value={monthlyLimit}
                onChangeText={setMonthlyLimit}
                placeholder="e.g., 50000"
                keyboardType="numeric"
                className="bg-surface rounded-2xl px-4 py-4 text-foreground text-base mb-6 border border-border"
                placeholderTextColor={colors.muted}
              />

              {/* Alert Threshold */}
              <Text className="text-sm font-semibold text-foreground mb-3">
                Alert Threshold ({alertThreshold}%)
              </Text>
              <Text className="text-xs text-muted mb-3">
                Get notified when you've spent this percentage of your budget
              </Text>
              <TextInput
                value={alertThreshold}
                onChangeText={setAlertThreshold}
                placeholder="80"
                keyboardType="numeric"
                className="bg-surface rounded-2xl px-4 py-4 text-foreground text-base mb-6 border border-border"
                placeholderTextColor={colors.muted}
              />

              {/* Create Button */}
              <TouchableOpacity
                onPress={handleCreateBudget}
                disabled={createBudgetMutation.isPending}
                activeOpacity={0.7}
                className="bg-primary rounded-2xl py-4 items-center"
              >
                {createBudgetMutation.isPending ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text className="text-background font-bold text-base">Create Budget</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
