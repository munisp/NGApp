import { ScrollView, Text, View, Pressable, TextInput, Alert, Modal } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  getGamifiedGoals,
  createGamifiedGoal,
  addContribution,
  getGoalStatistics,
  getProgressPercentage,
  getDaysRemaining,
  getNextMilestone,
  getAmountForNextMilestone,
  getMotivationalMessage,
  getCategoryIcon,
  getCategoryColor,
  getRecommendedContribution,
  type GamifiedGoal,
} from "@/utils/gamified-goals";

export default function GamifiedGoalsScreen() {
  const colors = useColors();
  const [goals, setGoals] = useState<GamifiedGoal[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<GamifiedGoal | null>(null);
  
  // Create form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [category, setCategory] = useState<GamifiedGoal["category"]>("savings");
  const [deadline, setDeadline] = useState("");
  
  // Contribute form state
  const [contributeAmount, setContributeAmount] = useState("");

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    const [allGoals, statistics] = await Promise.all([
      getGamifiedGoals(),
      getGoalStatistics(),
    ]);
    
    setGoals(allGoals.filter((g) => g.is_active));
    setStats(statistics);
  };

  const handleCreateGoal = async () => {
    if (!name || !targetAmount || !deadline) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    const amount = parseFloat(targetAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Error", "Please enter a valid target amount");
      return;
    }

    const deadlineDays = parseInt(deadline);
    if (isNaN(deadlineDays) || deadlineDays <= 0) {
      Alert.alert("Error", "Please enter valid days until deadline");
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const deadlineDate = Date.now() + deadlineDays * 24 * 60 * 60 * 1000;
      
      await createGamifiedGoal({
        name,
        description,
        target_amount: amount,
        deadline: deadlineDate,
        category,
        icon: getCategoryIcon(category),
      });

      Alert.alert("Success", "Goal created! Start contributing to earn achievements!");
      
      // Reset form
      setName("");
      setDescription("");
      setTargetAmount("");
      setCategory("savings");
      setDeadline("");
      setShowCreateModal(false);
      
      await loadGoals();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to create goal");
    }
  };

  const handleContribute = async () => {
    if (!selectedGoal || !contributeAmount) {
      Alert.alert("Error", "Please enter an amount");
      return;
    }

    const amount = parseFloat(contributeAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const result = await addContribution(selectedGoal.id, amount);
      
      // Show achievements if any
      if (result.new_achievements.length > 0) {
        const achievementNames = result.new_achievements.map((a) => `${a.icon} ${a.name}`).join("\n");
        Alert.alert(
          "🎉 New Achievements!",
          achievementNames,
          [{ text: "Awesome!", style: "default" }]
        );
      }
      
      // Show milestones if any
      if (result.new_milestones.length > 0) {
        const milestone = result.new_milestones[0];
        Alert.alert(
          "🎯 Milestone Reached!",
          `You've reached ${milestone.percentage}% of your goal!\n\n${milestone.reward}`,
          [{ text: "Keep Going!", style: "default" }]
        );
      }
      
      setContributeAmount("");
      setShowContributeModal(false);
      setSelectedGoal(null);
      
      await loadGoals();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to add contribution");
    }
  };

  const renderGoal = (goal: GamifiedGoal) => {
    const progress = getProgressPercentage(goal);
    const daysRemaining = getDaysRemaining(goal);
    const nextMilestone = getNextMilestone(goal);
    const amountForNext = getAmountForNextMilestone(goal);
    const motivationalMsg = getMotivationalMessage(goal);
    const recommended = getRecommendedContribution(goal);
    const categoryColor = getCategoryColor(goal.category);

    return (
      <View
        key={goal.id}
        className="bg-surface rounded-2xl p-4 border border-border"
      >
        {/* Header */}
        <View className="flex-row items-start justify-between mb-3">
          <View className="flex-1">
            <View className="flex-row items-center gap-2 mb-1">
              <Text className="text-2xl">{goal.icon}</Text>
              <Text className="text-base font-semibold text-foreground">
                {goal.name}
              </Text>
            </View>
            {goal.description && (
              <Text className="text-sm text-muted mb-2">{goal.description}</Text>
            )}
          </View>
          
          <View
            style={{ backgroundColor: categoryColor + "20" }}
            className="px-3 py-1 rounded-full"
          >
            <Text
              style={{ color: categoryColor }}
              className="text-xs font-semibold capitalize"
            >
              {goal.category}
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View className="mb-3">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs text-muted">Progress</Text>
            <Text className="text-xs font-semibold text-foreground">
              {progress.toFixed(0)}%
            </Text>
          </View>
          <View className="h-4 bg-background rounded-full overflow-hidden">
            <View
              style={{
                width: `${Math.min(100, progress)}%`,
                backgroundColor: categoryColor,
              }}
              className="h-full rounded-full"
            />
          </View>
        </View>

        {/* Amount Info */}
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-xs text-muted mb-1">Current</Text>
            <Text className="text-base font-bold text-foreground">
              ${goal.current_amount.toFixed(2)}
            </Text>
          </View>
          
          <View className="items-center">
            <Text className="text-xs text-muted mb-1">Target</Text>
            <Text className="text-base font-bold text-foreground">
              ${goal.target_amount.toFixed(2)}
            </Text>
          </View>
          
          <View className="items-end">
            <Text className="text-xs text-muted mb-1">Remaining</Text>
            <Text className="text-base font-bold text-foreground">
              ${(goal.target_amount - goal.current_amount).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Milestones */}
        <View className="flex-row items-center gap-2 mb-3">
          {goal.milestones.map((milestone) => (
            <View
              key={milestone.id}
              style={{
                backgroundColor: milestone.reached ? categoryColor : colors.border,
              }}
              className="flex-1 h-2 rounded-full"
            />
          ))}
        </View>

        {/* Next Milestone */}
        {nextMilestone && (
          <View
            style={{ backgroundColor: categoryColor + "10" }}
            className="p-3 rounded-xl mb-3"
          >
            <Text style={{ color: categoryColor }} className="text-xs font-semibold mb-1">
              Next Milestone: {nextMilestone.percentage}%
            </Text>
            <Text className="text-xs text-muted">
              ${amountForNext.toFixed(2)} more to reach
            </Text>
          </View>
        )}

        {/* Stats */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-4">
            <View>
              <Text className="text-xs text-muted">Streak</Text>
              <Text className="text-sm font-semibold text-foreground">
                🔥 {goal.streak_days} days
              </Text>
            </View>
            <View>
              <Text className="text-xs text-muted">Achievements</Text>
              <Text className="text-sm font-semibold text-foreground">
                🏆 {goal.achievements.length}
              </Text>
            </View>
          </View>
          
          <View className="items-end">
            <Text className="text-xs text-muted">Days Left</Text>
            <Text className="text-sm font-semibold text-foreground">
              ⏰ {daysRemaining}
            </Text>
          </View>
        </View>

        {/* Motivational Message */}
        <View
          style={{ backgroundColor: colors.primary + "10" }}
          className="p-3 rounded-xl mb-3"
        >
          <Text style={{ color: colors.primary }} className="text-sm font-medium">
            {motivationalMsg}
          </Text>
        </View>

        {/* Recommended Contribution */}
        {progress < 100 && (
          <View className="bg-background p-3 rounded-xl mb-3">
            <Text className="text-xs text-muted mb-1">Recommended daily contribution</Text>
            <Text className="text-lg font-bold text-foreground">
              ${recommended.toFixed(2)}
            </Text>
          </View>
        )}

        {/* Contribute Button */}
        {progress < 100 && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedGoal(goal);
              setShowContributeModal(true);
            }}
            style={({ pressed }) => [
              {
                backgroundColor: categoryColor,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            className="rounded-xl py-3"
          >
            <Text
              style={{ color: colors.background }}
              className="text-center font-semibold"
            >
              Add Contribution
            </Text>
          </Pressable>
        )}

        {/* Completed Badge */}
        {progress >= 100 && (
          <View
            style={{ backgroundColor: colors.success + "20" }}
            className="p-4 rounded-xl items-center"
          >
            <Text className="text-3xl mb-2">🏆</Text>
            <Text style={{ color: colors.success }} className="text-lg font-bold">
              Goal Completed!
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">
              Financial Goals
            </Text>
            <Text className="text-sm text-muted">
              Gamified savings with rewards & achievements
            </Text>
          </View>

          {/* Stats Cards */}
          {stats && (
            <View className="flex-row gap-3">
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Active</Text>
                <Text className="text-xl font-bold text-foreground">
                  {stats.active_goals}
                </Text>
              </View>
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Achievements</Text>
                <Text className="text-xl font-bold text-foreground">
                  {stats.total_achievements}
                </Text>
              </View>
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Streak</Text>
                <Text className="text-xl font-bold text-foreground">
                  {stats.highest_streak}🔥
                </Text>
              </View>
            </View>
          )}

          {/* Create Button */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowCreateModal(true);
            }}
            style={({ pressed }) => [
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            className="rounded-full py-4"
          >
            <Text
              style={{ color: colors.background }}
              className="text-center font-semibold text-base"
            >
              + Create Financial Goal
            </Text>
          </Pressable>

          {/* Active Goals */}
          {goals.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">
                Your Goals
              </Text>
              {goals.map(renderGoal)}
            </View>
          )}

          {/* Empty State */}
          {goals.length === 0 && (
            <View className="items-center justify-center py-12">
              <Text className="text-6xl mb-4">🎯</Text>
              <Text className="text-lg font-semibold text-foreground mb-2">
                No goals yet
              </Text>
              <Text className="text-sm text-muted text-center">
                Create your first goal and start earning achievements!
              </Text>
            </View>
          )}

          {/* Info Card */}
          <View
            style={{ backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }}
            className="rounded-2xl p-4 border"
          >
            <Text className="text-sm font-semibold text-foreground mb-2">
              🏆 How Gamified Goals Work
            </Text>
            <Text className="text-sm text-muted mb-1">
              • Earn achievements for reaching milestones
            </Text>
            <Text className="text-sm text-muted mb-1">
              • Build streaks with consistent contributions
            </Text>
            <Text className="text-sm text-muted">
              • Get motivational messages to stay on track
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Create Goal Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View
            style={{ backgroundColor: colors.background }}
            className="rounded-t-3xl p-6"
          >
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-foreground">
                Create Financial Goal
              </Text>
              <Pressable onPress={() => setShowCreateModal(false)}>
                <Text className="text-2xl text-muted">✕</Text>
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
              <View className="gap-4">
                {/* Name */}
                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Goal Name *</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g., Emergency Fund"
                    style={{
                      backgroundColor: colors.surface,
                      color: colors.foreground,
                      borderColor: colors.border,
                    }}
                    className="border rounded-xl px-4 py-3 text-base"
                    placeholderTextColor={colors.muted}
                  />
                </View>

                {/* Description */}
                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Description</Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Optional description"
                    multiline
                    numberOfLines={2}
                    style={{
                      backgroundColor: colors.surface,
                      color: colors.foreground,
                      borderColor: colors.border,
                    }}
                    className="border rounded-xl px-4 py-3 text-base"
                    placeholderTextColor={colors.muted}
                  />
                </View>

                {/* Target Amount */}
                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Target Amount *</Text>
                  <TextInput
                    value={targetAmount}
                    onChangeText={setTargetAmount}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    style={{
                      backgroundColor: colors.surface,
                      color: colors.foreground,
                      borderColor: colors.border,
                    }}
                    className="border rounded-xl px-4 py-3 text-base"
                    placeholderTextColor={colors.muted}
                  />
                </View>

                {/* Deadline */}
                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Days Until Deadline *</Text>
                  <TextInput
                    value={deadline}
                    onChangeText={setDeadline}
                    placeholder="30"
                    keyboardType="number-pad"
                    style={{
                      backgroundColor: colors.surface,
                      color: colors.foreground,
                      borderColor: colors.border,
                    }}
                    className="border rounded-xl px-4 py-3 text-base"
                    placeholderTextColor={colors.muted}
                  />
                </View>

                {/* Category */}
                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Category</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {(["savings", "investment", "debt", "emergency", "custom"] as const).map((cat) => (
                      <Pressable
                        key={cat}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setCategory(cat);
                        }}
                        style={({ pressed }) => [
                          {
                            backgroundColor: category === cat ? getCategoryColor(cat) : colors.surface,
                            borderColor: colors.border,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                        className="border rounded-xl px-4 py-2"
                      >
                        <Text
                          style={{
                            color: category === cat ? colors.background : colors.foreground,
                          }}
                          className="text-sm font-medium capitalize"
                        >
                          {getCategoryIcon(cat)} {cat}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Create Button */}
                <Pressable
                  onPress={handleCreateGoal}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                  className="rounded-xl py-4 mt-2"
                >
                  <Text
                    style={{ color: colors.background }}
                    className="text-center font-semibold text-base"
                  >
                    Create Goal
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Contribute Modal */}
      <Modal
        visible={showContributeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowContributeModal(false)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View
            style={{ backgroundColor: colors.background }}
            className="rounded-t-3xl p-6"
          >
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-foreground">
                Add Contribution
              </Text>
              <Pressable onPress={() => setShowContributeModal(false)}>
                <Text className="text-2xl text-muted">✕</Text>
              </Pressable>
            </View>

            <View className="gap-4">
              {selectedGoal && (
                <View className="bg-surface rounded-xl p-4 mb-2">
                  <Text className="text-sm text-muted mb-1">Contributing to</Text>
                  <Text className="text-lg font-semibold text-foreground">
                    {selectedGoal.icon} {selectedGoal.name}
                  </Text>
                </View>
              )}

              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">Amount</Text>
                <TextInput
                  value={contributeAmount}
                  onChangeText={setContributeAmount}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  autoFocus
                  style={{
                    backgroundColor: colors.surface,
                    color: colors.foreground,
                    borderColor: colors.border,
                  }}
                  className="border rounded-xl px-4 py-3 text-base"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <Pressable
                onPress={handleContribute}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                className="rounded-xl py-4"
              >
                <Text
                  style={{ color: colors.background }}
                  className="text-center font-semibold text-base"
                >
                  Add Contribution
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
