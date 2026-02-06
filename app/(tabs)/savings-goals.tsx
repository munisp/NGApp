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
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { DEMO } from '@/lib/demo-data';

const CATEGORY_ICONS: Record<string, string> = {
  emergency: '🚨',
  vacation: '✈️',
  home: '🏠',
  education: '🎓',
  car: '🚗',
  wedding: '💍',
  other: '💰',
};

export default function SavingsGoalsScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  // Form states
  const [goalName, setGoalName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [category, setCategory] = useState<string>('emergency');
  const [contributionAmount, setContributionAmount] = useState('');
  const [contributionNote, setContributionNote] = useState('');
  const [recurringAmount, setRecurringAmount] = useState('');
  const [recurringFrequency, setRecurringFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('monthly');
  const [recurringDay, setRecurringDay] = useState('1');

  const { data: _goals, isLoading, isError: goalsError, refetch } = trpc.savingsGoals.getGoals.useQuery();
  const goals = goalsError ? DEMO.savingsGoals : _goals;
  const createGoalMutation = trpc.savingsGoals.createGoal.useMutation();
  const addContributionMutation = trpc.savingsGoals.addContribution.useMutation();
  const deleteGoalMutation = trpc.savingsGoals.deleteGoal.useMutation();
  
    // Recurring contributions
    const { data: _recurringContributions, isError: recError } = trpc.recurringContributions.getRecurringContributions.useQuery();
    const recurringContributions = recError ? DEMO.recurringContributions : _recurringContributions;
  const createRecurringMutation = trpc.recurringContributions.createRecurringContribution.useMutation();
  const updateRecurringMutation = trpc.recurringContributions.updateRecurringContribution.useMutation();
  const deleteRecurringMutation = trpc.recurringContributions.deleteRecurringContribution.useMutation();

  const handleRefresh = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleCreateGoal = async () => {
    if (!goalName || !targetAmount || !targetDate) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      await createGoalMutation.mutateAsync({
        name: goalName,
        targetAmount: parseFloat(targetAmount),
        targetDate,
        category: category as any,
        icon: CATEGORY_ICONS[category],
      });

      setShowCreateModal(false);
      setGoalName('');
      setTargetAmount('');
      setTargetDate('');
      setCategory('emergency');
      await refetch();

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create goal');
    }
  };

  const handleAddContribution = async () => {
    if (!contributionAmount || !selectedGoalId) {
      Alert.alert('Error', 'Please enter an amount');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      await addContributionMutation.mutateAsync({
        goalId: selectedGoalId,
        amount: parseFloat(contributionAmount),
        note: contributionNote,
      });

      setShowContributeModal(false);
      setContributionAmount('');
      setContributionNote('');
      setSelectedGoalId(null);
      await refetch();

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add contribution');
    }
  };

  const handleDeleteGoal = (goalId: string, goalName: string) => {
    Alert.alert('Delete Goal', `Are you sure you want to delete "${goalName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteGoalMutation.mutateAsync({ goalId });
            await refetch();
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          } catch (error) {
            Alert.alert('Error', 'Failed to delete goal');
          }
        },
      },
    ]);
  };

  const formatCurrency = (value: number) => {
    return `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

    if (isLoading && !goalsError) {
      return (
        <ScreenContainer className="p-4">
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="text-muted mt-4">Loading goals...</Text>
          </View>
        </ScreenContainer>
      );
    }

  const activeGoals = goals?.filter((g) => g.isActive && !g.isCompleted) || [];
  const completedGoals = goals?.filter((g) => g.isCompleted) || [];

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
              <Text className="text-3xl font-bold text-foreground">Savings Goals</Text>
              <Text className="text-muted mt-1">Track your financial goals</Text>
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

          {/* Active Goals */}
          {activeGoals.length > 0 && (
            <View className="gap-4">
              <Text className="text-lg font-bold text-foreground">Active Goals</Text>
              {activeGoals.map((goal) => (
                <View key={goal.id} className="bg-surface rounded-3xl p-5 border border-border">
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center gap-3">
                      <Text className="text-3xl">{goal.icon}</Text>
                      <View>
                        <Text className="text-lg font-bold text-foreground">{goal.name}</Text>
                        <Text className="text-xs text-muted capitalize">{goal.category}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteGoal(goal.id, goal.name)}
                      activeOpacity={0.7}
                    >
                      <IconSymbol name="trash" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>

                  {/* Progress with Milestones */}
                  <View className="gap-2 mb-3">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-2xl font-bold text-foreground">
                        {formatCurrency(parseFloat(goal.currentAmount))}
                      </Text>
                      <Text className="text-sm text-muted">of {formatCurrency(parseFloat(goal.targetAmount))}</Text>
                    </View>
                    
                    {/* Progress Bar with Milestone Markers */}
                    <View className="relative">
                      <View className="h-3 bg-background rounded-full overflow-hidden">
                        <View
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(goal.progress, 100)}%`,
                            backgroundColor: goal.progress >= 100 ? colors.success : colors.primary,
                          }}
                        />
                      </View>
                      
                      {/* Milestone Markers */}
                      <View className="absolute top-0 left-0 right-0 h-3 flex-row items-center">
                        {[25, 50, 75, 100].map((milestone) => {
                          const isReached = goal.progress >= milestone;
                          return (
                            <View
                              key={milestone}
                              className="absolute items-center"
                              style={{ left: `${milestone}%`, transform: [{ translateX: -6 }] }}
                            >
                              <View
                                className="w-3 h-3 rounded-full border-2"
                                style={{
                                  backgroundColor: isReached ? colors.success : colors.background,
                                  borderColor: isReached ? colors.success : colors.border,
                                }}
                              />
                            </View>
                          );
                        })}
                      </View>
                    </View>
                    
                    {/* Milestone Achievements */}
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs font-semibold text-foreground">{goal.progress.toFixed(1)}% complete</Text>
                      <View className="flex-row gap-1">
                        {[25, 50, 75, 100].map((milestone) => {
                          const isReached = goal.progress >= milestone;
                          const milestoneEmoji = milestone === 25 ? '🎖️' : milestone === 50 ? '🏆' : milestone === 75 ? '⭐' : '🎉';
                          return isReached ? (
                            <Text key={milestone} className="text-xs">{milestoneEmoji}</Text>
                          ) : null;
                        })}
                      </View>
                    </View>
                    
                    {/* Celebration Message */}
                    {goal.progress >= 25 && goal.progress < 30 && (
                      <View className="bg-success/10 rounded-xl p-2 mt-1">
                        <Text className="text-xs font-semibold text-success text-center">
                          🎖️ Quarter way there! Keep going!
                        </Text>
                      </View>
                    )}
                    {goal.progress >= 50 && goal.progress < 55 && (
                      <View className="bg-success/10 rounded-xl p-2 mt-1">
                        <Text className="text-xs font-semibold text-success text-center">
                          🏆 Halfway milestone reached! Amazing progress!
                        </Text>
                      </View>
                    )}
                    {goal.progress >= 75 && goal.progress < 80 && (
                      <View className="bg-success/10 rounded-xl p-2 mt-1">
                        <Text className="text-xs font-semibold text-success text-center">
                          ⭐ Three quarters done! You're almost there!
                        </Text>
                      </View>
                    )}
                    {goal.progress >= 100 && (
                      <View className="bg-success/10 rounded-xl p-2 mt-1">
                        <Text className="text-xs font-semibold text-success text-center">
                          🎉 Goal Completed! Congratulations!
                        </Text>
                      </View>
                    )}
                    
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs text-muted">
                        {goal.daysRemaining > 0 ? `${goal.daysRemaining} days left` : 'Past due date'}
                      </Text>
                    </View>
                  </View>

                  {/* Stats */}
                  <View className="flex-row gap-3 mb-3">
                    <View className="flex-1 bg-background rounded-2xl p-3">
                      <Text className="text-xs text-muted">Remaining</Text>
                      <Text className="text-sm font-bold text-foreground">{formatCurrency(goal.remaining)}</Text>
                    </View>
                    <View className="flex-1 bg-background rounded-2xl p-3">
                      <Text className="text-xs text-muted">Target Date</Text>
                      <Text className="text-sm font-bold text-foreground">{formatDate(goal.targetDate)}</Text>
                    </View>
                  </View>

                  {/* Recurring Contribution Status */}
                  {(() => {
                    const recurring = recurringContributions?.find(r => r.goalId === goal.id);
                    if (recurring) {
                      return (
                        <View className="bg-primary/10 rounded-2xl p-3 mb-3">
                          <View className="flex-row items-center justify-between mb-2">
                            <Text className="text-xs font-semibold text-primary">🔄 Recurring {recurring.frequency}</Text>
                            <Text className="text-sm font-bold text-foreground">
                              {formatCurrency(parseFloat(recurring.amount))}
                            </Text>
                          </View>
                          <Text className="text-xs text-muted mb-2">
                            Next: {new Date(recurring.nextProcessDate).toLocaleDateString()}
                          </Text>
                          <View className="flex-row gap-2">
                            {recurring.isActive ? (
                              <TouchableOpacity
                                onPress={async () => {
                                  if (Platform.OS !== 'web') {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  }
                                  await updateRecurringMutation.mutateAsync({
                                    recurringId: recurring.id,
                                    isActive: false,
                                  });
                                  await refetch();
                                }}
                                activeOpacity={0.7}
                                className="flex-1 py-2 rounded-xl items-center bg-warning/20"
                              >
                                <Text className="text-xs font-semibold text-warning">Pause</Text>
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity
                                onPress={async () => {
                                  if (Platform.OS !== 'web') {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  }
                                  await updateRecurringMutation.mutateAsync({
                                    recurringId: recurring.id,
                                    isActive: true,
                                  });
                                  await refetch();
                                }}
                                activeOpacity={0.7}
                                className="flex-1 py-2 rounded-xl items-center bg-success/20"
                              >
                                <Text className="text-xs font-semibold text-success">Resume</Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity
                              onPress={async () => {
                                if (Platform.OS !== 'web') {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }
                                Alert.alert(
                                  'Delete Recurring Contribution',
                                  'Are you sure you want to stop this recurring contribution?',
                                  [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                      text: 'Delete',
                                      style: 'destructive',
                                      onPress: async () => {
                                        await deleteRecurringMutation.mutateAsync({
                                          recurringId: recurring.id,
                                        });
                                        await refetch();
                                      },
                                    },
                                  ]
                                );
                              }}
                              activeOpacity={0.7}
                              className="flex-1 py-2 rounded-xl items-center bg-error/20"
                            >
                              <Text className="text-xs font-semibold text-error">Delete</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    }
                    return null;
                  })()}

                  {/* Action Buttons */}
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => {
                        if (Platform.OS !== 'web') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                        setSelectedGoalId(goal.id);
                        setShowContributeModal(true);
                      }}
                      activeOpacity={0.7}
                      className="flex-1 py-3 rounded-2xl items-center"
                      style={{ backgroundColor: colors.primary }}
                    >
                      <Text className="text-sm font-bold text-background">Add Once</Text>
                    </TouchableOpacity>
                    {!recurringContributions?.find(r => r.goalId === goal.id) && (
                      <TouchableOpacity
                        onPress={() => {
                          if (Platform.OS !== 'web') {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }
                          setSelectedGoalId(goal.id);
                          setShowRecurringModal(true);
                        }}
                        activeOpacity={0.7}
                        className="flex-1 py-3 rounded-2xl items-center border-2"
                        style={{ borderColor: colors.primary }}
                      >
                        <Text className="text-sm font-bold" style={{ color: colors.primary }}>Set Recurring</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Completed Goals */}
          {completedGoals.length > 0 && (
            <View className="gap-4">
              <Text className="text-lg font-bold text-foreground">Completed Goals 🎉</Text>
              {completedGoals.map((goal) => (
                <View key={goal.id} className="bg-surface rounded-3xl p-5 border border-success opacity-70">
                  <View className="flex-row items-center gap-3 mb-2">
                    <Text className="text-3xl">{goal.icon}</Text>
                    <View>
                      <Text className="text-lg font-bold text-foreground">{goal.name}</Text>
                      <Text className="text-xs text-success">Completed {goal.completedAt && formatDate(goal.completedAt)}</Text>
                    </View>
                  </View>
                  <Text className="text-xl font-bold text-foreground">
                    {formatCurrency(parseFloat(goal.currentAmount))}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Empty State */}
          {activeGoals.length === 0 && completedGoals.length === 0 && (
            <View className="items-center py-12">
              <Text className="text-6xl mb-4">🎯</Text>
              <Text className="text-xl font-bold text-foreground mb-2">No Savings Goals Yet</Text>
              <Text className="text-sm text-muted text-center mb-6">
                Create your first savings goal and start building your financial future
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
                <Text className="text-sm font-bold text-background">Create Goal</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Create Goal Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View className="bg-background rounded-t-3xl p-6" style={{ maxHeight: '80%' }}>
            <Text className="text-2xl font-bold text-foreground mb-6">Create Savings Goal</Text>

            <ScrollView className="gap-4">
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Goal Name</Text>
                <TextInput
                  value={goalName}
                  onChangeText={setGoalName}
                  placeholder="e.g., Emergency Fund"
                  placeholderTextColor={colors.muted}
                  className="bg-surface border border-border rounded-2xl px-4 py-3 text-foreground"
                />
              </View>

              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Target Amount (₦)</Text>
                <TextInput
                  value={targetAmount}
                  onChangeText={setTargetAmount}
                  placeholder="100000"
                  keyboardType="numeric"
                  placeholderTextColor={colors.muted}
                  className="bg-surface border border-border rounded-2xl px-4 py-3 text-foreground"
                />
              </View>

              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Target Date (YYYY-MM-DD)</Text>
                <TextInput
                  value={targetDate}
                  onChangeText={setTargetDate}
                  placeholder="2025-12-31"
                  placeholderTextColor={colors.muted}
                  className="bg-surface border border-border rounded-2xl px-4 py-3 text-foreground"
                />
              </View>

              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-2">
                  {Object.entries(CATEGORY_ICONS).map(([key, icon]) => (
                    <TouchableOpacity
                      key={key}
                      onPress={() => {
                        if (Platform.OS !== 'web') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                        setCategory(key);
                      }}
                      activeOpacity={0.7}
                      className="px-4 py-3 rounded-2xl items-center"
                      style={{
                        backgroundColor: category === key ? colors.primary : colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text className="text-2xl mb-1">{icon}</Text>
                      <Text
                        className="text-xs font-semibold capitalize"
                        style={{ color: category === key ? colors.background : colors.foreground }}
                      >
                        {key}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </ScrollView>

            <View className="flex-row gap-3 mt-6">
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setShowCreateModal(false);
                }}
                activeOpacity={0.7}
                className="flex-1 py-3 rounded-2xl items-center border"
                style={{ borderColor: colors.border }}
              >
                <Text className="text-sm font-bold text-foreground">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateGoal}
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

      {/* Contribute Modal */}
      <Modal visible={showContributeModal} animationType="slide" transparent>
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View className="bg-background rounded-t-3xl p-6">
            <Text className="text-2xl font-bold text-foreground mb-6">Add Contribution</Text>

            <View className="gap-4">
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Amount (₦)</Text>
                <TextInput
                  value={contributionAmount}
                  onChangeText={setContributionAmount}
                  placeholder="5000"
                  keyboardType="numeric"
                  placeholderTextColor={colors.muted}
                  className="bg-surface border border-border rounded-2xl px-4 py-3 text-foreground"
                />
              </View>

              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Note (Optional)</Text>
                <TextInput
                  value={contributionNote}
                  onChangeText={setContributionNote}
                  placeholder="e.g., Monthly savings"
                  placeholderTextColor={colors.muted}
                  className="bg-surface border border-border rounded-2xl px-4 py-3 text-foreground"
                />
              </View>
            </View>

            <View className="flex-row gap-3 mt-6">
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setShowContributeModal(false);
                }}
                activeOpacity={0.7}
                className="flex-1 py-3 rounded-2xl items-center border"
                style={{ borderColor: colors.border }}
              >
                <Text className="text-sm font-bold text-foreground">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddContribution}
                activeOpacity={0.7}
                className="flex-1 py-3 rounded-2xl items-center"
                style={{ backgroundColor: colors.primary }}
              >
                <Text className="text-sm font-bold text-background">Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Set Up Recurring Contribution Modal */}
      <Modal visible={showRecurringModal} animationType="slide" transparent>
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View className="bg-background rounded-t-3xl p-6">
            <Text className="text-2xl font-bold text-foreground mb-6">Set Up Recurring Contribution</Text>

            <View className="gap-4">
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Amount (₦)</Text>
                <TextInput
                  value={recurringAmount}
                  onChangeText={setRecurringAmount}
                  placeholder="1000"
                  keyboardType="numeric"
                  placeholderTextColor={colors.muted}
                  className="bg-surface border border-border rounded-2xl px-4 py-3 text-foreground"
                />
              </View>

              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Frequency</Text>
                <View className="flex-row gap-2">
                  {(['weekly', 'biweekly', 'monthly'] as const).map((freq) => (
                    <TouchableOpacity
                      key={freq}
                      onPress={() => {
                        if (Platform.OS !== 'web') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                        setRecurringFrequency(freq);
                      }}
                      activeOpacity={0.7}
                      className="flex-1 py-3 rounded-2xl items-center"
                      style={{
                        backgroundColor: recurringFrequency === freq ? colors.primary : colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text
                        className="text-sm font-semibold capitalize"
                        style={{ color: recurringFrequency === freq ? colors.background : colors.foreground }}
                      >
                        {freq}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {recurringFrequency === 'monthly' && (
                <View>
                  <Text className="text-sm font-semibold text-foreground mb-2">Day of Month (1-28)</Text>
                  <TextInput
                    value={recurringDay}
                    onChangeText={setRecurringDay}
                    placeholder="1"
                    keyboardType="numeric"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-2xl px-4 py-3 text-foreground"
                  />
                </View>
              )}

              <View className="bg-primary/10 rounded-2xl p-4">
                <Text className="text-xs text-muted mb-1">💡 Tip</Text>
                <Text className="text-sm text-foreground">
                  Recurring contributions will be automatically processed from your linked bank account on the scheduled date.
                </Text>
              </View>
            </View>

            <View className="flex-row gap-3 mt-6">
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setShowRecurringModal(false);
                  setRecurringAmount('');
                  setRecurringFrequency('monthly');
                  setRecurringDay('1');
                }}
                activeOpacity={0.7}
                className="flex-1 py-3 rounded-2xl items-center border"
                style={{ borderColor: colors.border }}
              >
                <Text className="text-sm font-bold text-foreground">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (!recurringAmount || !selectedGoalId) {
                    Alert.alert('Error', 'Please enter an amount');
                    return;
                  }

                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }

                  try {
                    await createRecurringMutation.mutateAsync({
                      goalId: selectedGoalId,
                      amount: parseFloat(recurringAmount),
                      frequency: recurringFrequency,
                      startDate: new Date().toISOString().split('T')[0], // Today
                      dayOfMonth: recurringFrequency === 'monthly' ? parseInt(recurringDay) : undefined,
                    });

                    setShowRecurringModal(false);
                    setRecurringAmount('');
                    setRecurringFrequency('monthly');
                    setRecurringDay('1');
                    await refetch();

                    if (Platform.OS !== 'web') {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }
                  } catch (error) {
                    Alert.alert('Error', 'Failed to set up recurring contribution');
                  }
                }}
                activeOpacity={0.7}
                className="flex-1 py-3 rounded-2xl items-center"
                style={{ backgroundColor: colors.primary }}
              >
                <Text className="text-sm font-bold text-background">Set Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
