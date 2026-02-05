import { useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { trpc } from '@/lib/trpc';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Weekly', icon: '📅' },
  { value: 'biweekly', label: 'Bi-weekly', icon: '📆' },
  { value: 'monthly', label: 'Monthly', icon: '🗓️' },
];

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function RecurringContributionsScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRecurringId, setSelectedRecurringId] = useState<string | null>(null);

  // Form states
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('monthly');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [dayOfWeek, setDayOfWeek] = useState(1); // Monday
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');

  const { data: recurring, isLoading, refetch } = trpc.recurringContributions.getRecurringContributions.useQuery();
  const { data: goals } = trpc.savingsGoals.getGoals.useQuery();
  const createMutation = trpc.recurringContributions.createRecurringContribution.useMutation();
  const updateMutation = trpc.recurringContributions.updateRecurringContribution.useMutation();
  const deleteMutation = trpc.recurringContributions.deleteRecurringContribution.useMutation();

  const handleRefresh = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleCreate = async () => {
    if (!selectedGoalId || !amount) {
      Alert.alert('Error', 'Please select a goal and enter an amount');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      await createMutation.mutateAsync({
        goalId: selectedGoalId,
        amount: parseFloat(amount),
        frequency,
        dayOfMonth: frequency === 'monthly' ? parseInt(dayOfMonth) : undefined,
        dayOfWeek: frequency !== 'monthly' ? dayOfWeek : undefined,
        startDate,
        endDate: endDate || undefined,
      });

      setShowCreateModal(false);
      resetForm();
      await refetch();

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create recurring contribution');
    }
  };

  const handleToggleActive = async (recurringId: string, currentStatus: boolean) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      await updateMutation.mutateAsync({
        recurringId,
        isActive: !currentStatus,
      });

      await refetch();

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update recurring contribution');
    }
  };

  const handleDelete = (recurringId: string) => {
    Alert.alert('Delete Recurring Contribution', 'Are you sure you want to delete this recurring contribution?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync({ recurringId });
            await refetch();
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          } catch (error) {
            Alert.alert('Error', 'Failed to delete recurring contribution');
          }
        },
      },
    ]);
  };

  const resetForm = () => {
    setSelectedGoalId('');
    setAmount('');
    setFrequency('monthly');
    setDayOfMonth('1');
    setDayOfWeek(1);
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
  };

  const formatCurrency = (value: string) => {
    return `₦${parseFloat(value).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getGoalName = (goalId: string) => {
    return goals?.find((g) => g.id === goalId)?.name || 'Unknown Goal';
  };

  if (isLoading) {
    return (
      <ScreenContainer className="p-4">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-4">Loading recurring contributions...</Text>
        </View>
      </ScreenContainer>
    );
  }

  const activeRecurring = recurring?.filter((r) => r.isActive) || [];
  const inactiveRecurring = recurring?.filter((r) => !r.isActive) || [];
  const activeGoals = goals?.filter((g) => g.isActive && !g.isCompleted) || [];

  return (
    <ScreenContainer className="p-4">
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        <View className="gap-6">
          {/* Header */}
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-3xl font-bold text-foreground">Recurring Contributions</Text>
              <Text className="text-muted mt-1">Automate your savings</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                setShowCreateModal(true);
              }}
              activeOpacity={0.7}
              className="w-12 h-12 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.primary }}
            >
              <Text className="text-2xl text-background">+</Text>
            </TouchableOpacity>
          </View>

          {/* Active Recurring */}
          {activeRecurring.length > 0 && (
            <View className="gap-4">
              <Text className="text-lg font-bold text-foreground">Active</Text>
              {activeRecurring.map((item) => (
                <View key={item.id} className="bg-surface rounded-3xl p-5 border border-border">
                  <View className="flex-row items-center justify-between mb-3">
                    <View>
                      <Text className="text-lg font-bold text-foreground">{getGoalName(item.goalId)}</Text>
                      <Text className="text-xs text-muted capitalize">{item.frequency} contribution</Text>
                    </View>
                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        onPress={() => handleToggleActive(item.id, item.isActive)}
                        activeOpacity={0.7}
                        className="w-10 h-10 rounded-full items-center justify-center"
                        style={{ backgroundColor: colors.warning }}
                      >
                        <Text className="text-lg">⏸</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(item.id)}
                        activeOpacity={0.7}
                        className="w-10 h-10 rounded-full items-center justify-center"
                        style={{ backgroundColor: colors.error }}
                      >
                        <Text className="text-lg">🗑</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View className="flex-row gap-3">
                    <View className="flex-1 bg-background rounded-2xl p-3">
                      <Text className="text-xs text-muted">Amount</Text>
                      <Text className="text-sm font-bold text-foreground">{formatCurrency(item.amount)}</Text>
                    </View>
                    <View className="flex-1 bg-background rounded-2xl p-3">
                      <Text className="text-xs text-muted">Next Payment</Text>
                      <Text className="text-sm font-bold text-foreground">{formatDate(item.nextProcessDate)}</Text>
                    </View>
                  </View>

                  {item.lastProcessedAt && (
                    <Text className="text-xs text-muted mt-2">
                      Last processed: {formatDate(item.lastProcessedAt)}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Inactive Recurring */}
          {inactiveRecurring.length > 0 && (
            <View className="gap-4">
              <Text className="text-lg font-bold text-foreground">Paused</Text>
              {inactiveRecurring.map((item) => (
                <View key={item.id} className="bg-surface rounded-3xl p-5 border border-border opacity-60">
                  <View className="flex-row items-center justify-between mb-3">
                    <View>
                      <Text className="text-lg font-bold text-foreground">{getGoalName(item.goalId)}</Text>
                      <Text className="text-xs text-muted capitalize">{item.frequency} contribution (paused)</Text>
                    </View>
                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        onPress={() => handleToggleActive(item.id, item.isActive)}
                        activeOpacity={0.7}
                        className="w-10 h-10 rounded-full items-center justify-center"
                        style={{ backgroundColor: colors.success }}
                      >
                        <Text className="text-lg">▶️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(item.id)}
                        activeOpacity={0.7}
                        className="w-10 h-10 rounded-full items-center justify-center"
                        style={{ backgroundColor: colors.error }}
                      >
                        <Text className="text-lg">🗑</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View className="flex-row gap-3">
                    <View className="flex-1 bg-background rounded-2xl p-3">
                      <Text className="text-xs text-muted">Amount</Text>
                      <Text className="text-sm font-bold text-foreground">{formatCurrency(item.amount)}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Empty State */}
          {activeRecurring.length === 0 && inactiveRecurring.length === 0 && (
            <View className="items-center py-12">
              <Text className="text-6xl mb-4">🔄</Text>
              <Text className="text-xl font-bold text-foreground mb-2">No Recurring Contributions</Text>
              <Text className="text-sm text-muted text-center mb-6">
                Set up automatic contributions to reach your savings goals faster
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setShowCreateModal(true);
                }}
                activeOpacity={0.7}
                className="px-6 py-3 rounded-2xl"
                style={{ backgroundColor: colors.primary }}
              >
                <Text className="text-sm font-bold text-background">Set Up Recurring</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Create Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View className="bg-background rounded-t-3xl p-6" style={{ maxHeight: '80%' }}>
            <Text className="text-2xl font-bold text-foreground mb-6">Set Up Recurring Contribution</Text>

            <ScrollView className="gap-4">
              {/* Goal Selection */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Savings Goal</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-2">
                  {activeGoals.map((goal) => (
                    <TouchableOpacity
                      key={goal.id}
                      onPress={() => {
                        if (Platform.OS !== 'web') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                        setSelectedGoalId(goal.id);
                      }}
                      activeOpacity={0.7}
                      className="px-4 py-3 rounded-2xl"
                      style={{
                        backgroundColor: selectedGoalId === goal.id ? colors.primary : colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: selectedGoalId === goal.id ? colors.background : colors.foreground }}
                      >
                        {goal.icon} {goal.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Amount */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Amount (₦)</Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="5000"
                  keyboardType="numeric"
                  placeholderTextColor={colors.muted}
                  className="bg-surface border border-border rounded-2xl px-4 py-3 text-foreground"
                />
              </View>

              {/* Frequency */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Frequency</Text>
                <View className="flex-row gap-2">
                  {FREQUENCY_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => {
                        if (Platform.OS !== 'web') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                        setFrequency(option.value as any);
                      }}
                      activeOpacity={0.7}
                      className="flex-1 py-3 rounded-2xl items-center"
                      style={{
                        backgroundColor: frequency === option.value ? colors.primary : colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text className="text-2xl mb-1">{option.icon}</Text>
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: frequency === option.value ? colors.background : colors.foreground }}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Day Selection */}
              {frequency === 'monthly' ? (
                <View>
                  <Text className="text-sm font-semibold text-foreground mb-2">Day of Month</Text>
                  <TextInput
                    value={dayOfMonth}
                    onChangeText={setDayOfMonth}
                    placeholder="1-31"
                    keyboardType="numeric"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-2xl px-4 py-3 text-foreground"
                  />
                </View>
              ) : (
                <View>
                  <Text className="text-sm font-semibold text-foreground mb-2">Day of Week</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-2">
                    {DAYS_OF_WEEK.map((day, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() => {
                          if (Platform.OS !== 'web') {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }
                          setDayOfWeek(index);
                        }}
                        activeOpacity={0.7}
                        className="px-4 py-3 rounded-2xl"
                        style={{
                          backgroundColor: dayOfWeek === index ? colors.primary : colors.surface,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text
                          className="text-xs font-semibold"
                          style={{ color: dayOfWeek === index ? colors.background : colors.foreground }}
                        >
                          {day}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Start Date */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Start Date (YYYY-MM-DD)</Text>
                <TextInput
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="2025-01-01"
                  placeholderTextColor={colors.muted}
                  className="bg-surface border border-border rounded-2xl px-4 py-3 text-foreground"
                />
              </View>

              {/* End Date (Optional) */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">End Date (Optional)</Text>
                <TextInput
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="Leave empty for no end date"
                  placeholderTextColor={colors.muted}
                  className="bg-surface border border-border rounded-2xl px-4 py-3 text-foreground"
                />
              </View>
            </ScrollView>

            <View className="flex-row gap-3 mt-6">
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setShowCreateModal(false);
                  resetForm();
                }}
                activeOpacity={0.7}
                className="flex-1 py-3 rounded-2xl items-center border"
                style={{ borderColor: colors.border }}
              >
                <Text className="text-sm font-bold text-foreground">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreate}
                activeOpacity={0.7}
                className="flex-1 py-3 rounded-2xl items-center"
                style={{ backgroundColor: colors.primary }}
              >
                <Text className="text-sm font-bold text-background">Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
