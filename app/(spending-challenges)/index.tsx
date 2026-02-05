import { ScrollView, Text, View, Pressable, TextInput, Alert, Modal } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  getAllChallenges,
  getActiveChallenges,
  getCompletedChallenges,
  createChallenge,
  getChallengeLeaderboard,
  getChallengeStatistics,
  inviteFriendToChallenge,
  updateChallengeProgress,
  completeChallenge,
  formatChallengeGoal,
  getChallengeDuration,
  getChallengeProgressPercentage,
  type SpendingChallenge,
  type ChallengeParticipant,
} from "@/utils/spending-challenges";

export default function SpendingChallengesScreen() {
  const colors = useColors();
  const [activeChallenges, setActiveChallenges] = useState<SpendingChallenge[]>([]);
  const [completedChallenges, setCompletedChallenges] = useState<SpendingChallenge[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<SpendingChallenge | null>(null);
  const [leaderboard, setLeaderboard] = useState<ChallengeParticipant[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  
  // Create challenge form
  const [challengeName, setChallengeName] = useState("");
  const [challengeDescription, setChallengeDescription] = useState("");
  const [goalType, setGoalType] = useState<"reduce_spending" | "save_amount" | "no_spend_category">("save_amount");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetCategory, setTargetCategory] = useState("");
  const [durationDays, setDurationDays] = useState("30");
  
  // Invite form
  const [friendName, setFriendName] = useState("");
  const [friendEmail, setFriendEmail] = useState("");

  useEffect(() => {
    loadChallenges();
  }, []);

  const loadChallenges = async () => {
    const [active, completed] = await Promise.all([
      getActiveChallenges(),
      getCompletedChallenges(),
    ]);
    
    setActiveChallenges(active);
    setCompletedChallenges(completed);
  };

  const handleCreateChallenge = async () => {
    if (!challengeName.trim()) {
      Alert.alert("Error", "Please enter a challenge name");
      return;
    }
    
    if (!targetAmount.trim() && goalType !== "no_spend_category") {
      Alert.alert("Error", "Please enter a target amount");
      return;
    }
    
    if (!targetCategory.trim() && goalType === "no_spend_category") {
      Alert.alert("Error", "Please enter a category");
      return;
    }
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const challenge = await createChallenge(
        challengeName,
        challengeDescription,
        goalType,
        parseFloat(targetAmount) || undefined,
        targetCategory || undefined,
        parseInt(durationDays) || 30
      );
      
      setShowCreateModal(false);
      resetCreateForm();
      await loadChallenges();
      
      Alert.alert("Success", "Challenge created! Invite friends to compete.");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to create challenge");
    }
  };

  const resetCreateForm = () => {
    setChallengeName("");
    setChallengeDescription("");
    setGoalType("save_amount");
    setTargetAmount("");
    setTargetCategory("");
    setDurationDays("30");
  };

  const handleViewLeaderboard = async (challenge: SpendingChallenge) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const [leaderboardData, statsData] = await Promise.all([
        getChallengeLeaderboard(challenge.id),
        getChallengeStatistics(challenge.id),
      ]);
      
      setSelectedChallenge(challenge);
      setLeaderboard(leaderboardData);
      setStats(statsData);
      setShowLeaderboardModal(true);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to load leaderboard");
    }
  };

  const handleInviteFriend = async () => {
    if (!selectedChallenge) return;
    
    if (!friendName.trim() || !friendEmail.trim()) {
      Alert.alert("Error", "Please enter friend's name and email");
      return;
    }
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const success = await inviteFriendToChallenge(
        selectedChallenge.id,
        friendName,
        friendEmail
      );
      
      if (success) {
        setFriendName("");
        setFriendEmail("");
        setShowInviteModal(false);
        Alert.alert("Success", "Invitation sent!");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to send invitation");
    }
  };

  const handleCompleteChallenge = async (challengeId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const success = await completeChallenge(challengeId);
      
      if (success) {
        await loadChallenges();
        Alert.alert("Success", "Challenge completed! Check the results.");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to complete challenge");
    }
  };

  const renderChallengeCard = (challenge: SpendingChallenge) => {
    const duration = getChallengeDuration(challenge);
    const daysRemaining = Math.max(0, Math.ceil((challenge.end_date - Date.now()) / (24 * 60 * 60 * 1000)));
    const currentUser = challenge.participants.find((p) => p.user_id === "current_user");
    const progressPercentage = currentUser ? getChallengeProgressPercentage(currentUser) : 0;
    
    return (
      <View
        key={challenge.id}
        style={{ backgroundColor: colors.surface }}
        className="rounded-2xl p-5 border border-border mb-4"
      >
        <View className="flex-row items-start justify-between mb-3">
          <View className="flex-1">
            <Text className="text-lg font-bold text-foreground mb-1">{challenge.name}</Text>
            <Text className="text-sm text-muted">{challenge.description}</Text>
          </View>
          
          <View
            style={{
              backgroundColor: challenge.status === "active" ? colors.success + "20" : colors.muted + "20",
            }}
            className="px-3 py-1 rounded-full"
          >
            <Text
              style={{
                color: challenge.status === "active" ? colors.success : colors.muted,
              }}
              className="text-xs font-semibold uppercase"
            >
              {challenge.status}
            </Text>
          </View>
        </View>

        <View
          style={{ backgroundColor: colors.primary + "10" }}
          className="rounded-lg p-3 mb-3"
        >
          <Text style={{ color: colors.primary }} className="text-sm font-semibold">
            🎯 {formatChallengeGoal(challenge)}
          </Text>
        </View>

        {currentUser && (
          <View className="mb-3">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm text-muted">Your Progress</Text>
              <Text className="text-sm font-semibold text-foreground">
                ${currentUser.current_progress.toFixed(0)} / ${currentUser.target_progress.toFixed(0)}
              </Text>
            </View>
            
            <View className="h-2 bg-muted/20 rounded-full overflow-hidden">
              <View
                style={{
                  width: `${progressPercentage}%`,
                  backgroundColor: colors.success,
                }}
                className="h-full"
              />
            </View>
            
            <View className="flex-row items-center justify-between mt-2">
              <Text className="text-xs text-muted">Rank #{currentUser.rank}</Text>
              <Text className="text-xs text-muted">{progressPercentage.toFixed(0)}% complete</Text>
            </View>
          </View>
        )}

        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-2">
            <Text className="text-2xl">👥</Text>
            <Text className="text-sm text-muted">
              {challenge.participants.length} participant{challenge.participants.length !== 1 ? "s" : ""}
            </Text>
          </View>
          
          <Text className="text-sm text-muted">
            {challenge.status === "active" ? `${daysRemaining} days left` : `${duration} days`}
          </Text>
        </View>

        <View className="flex-row gap-2">
          <Pressable
            onPress={() => handleViewLeaderboard(challenge)}
            style={({ pressed }) => [
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            className="flex-1 rounded-xl py-3"
          >
            <Text
              style={{ color: colors.background }}
              className="text-center font-semibold text-sm"
            >
              🏆 Leaderboard
            </Text>
          </Pressable>
          
          {challenge.status === "active" && (
            <Pressable
              onPress={() => {
                setSelectedChallenge(challenge);
                setShowInviteModal(true);
              }}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              className="rounded-xl py-3 px-4 border"
            >
              <Text className="text-center font-semibold text-sm text-foreground">
                ➕ Invite
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-2xl font-bold text-foreground">Spending Challenges</Text>
              <Text className="text-sm text-muted">Compete with friends to save more</Text>
            </View>
            
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowCreateModal(true);
              }}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              className="w-12 h-12 rounded-full items-center justify-center"
            >
              <Text style={{ color: colors.background }} className="text-2xl">+</Text>
            </Pressable>
          </View>

          {/* Active Challenges */}
          {activeChallenges.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">
                Active Challenges ({activeChallenges.length})
              </Text>
              {activeChallenges.map(renderChallengeCard)}
            </View>
          )}

          {/* Completed Challenges */}
          {completedChallenges.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">
                Completed Challenges ({completedChallenges.length})
              </Text>
              {completedChallenges.slice(0, 3).map(renderChallengeCard)}
            </View>
          )}

          {/* Empty State */}
          {activeChallenges.length === 0 && completedChallenges.length === 0 && (
            <View className="items-center py-16">
              <Text className="text-6xl mb-4">🏆</Text>
              <Text className="text-lg font-semibold text-foreground mb-2">
                No Challenges Yet
              </Text>
              <Text className="text-sm text-muted text-center mb-6">
                Create a challenge and invite friends to compete on savings goals
              </Text>
              <Pressable
                onPress={() => setShowCreateModal(true)}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                className="rounded-xl px-6 py-3"
              >
                <Text
                  style={{ color: colors.background }}
                  className="font-semibold text-base"
                >
                  Create Challenge
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Create Challenge Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <ScreenContainer className="p-6">
          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="gap-6">
              <View className="flex-row items-center justify-between">
                <Text className="text-2xl font-bold text-foreground">Create Challenge</Text>
                <Pressable onPress={() => setShowCreateModal(false)}>
                  <Text className="text-base text-muted">Cancel</Text>
                </Pressable>
              </View>

              <View className="gap-3">
                <Text className="text-base font-semibold text-foreground">Challenge Name</Text>
                <TextInput
                  value={challengeName}
                  onChangeText={setChallengeName}
                  placeholder="e.g., 30-Day Savings Sprint"
                  style={{
                    backgroundColor: colors.surface,
                    color: colors.foreground,
                    borderColor: colors.border,
                  }}
                  className="border rounded-xl px-4 py-3 text-base"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View className="gap-3">
                <Text className="text-base font-semibold text-foreground">Description</Text>
                <TextInput
                  value={challengeDescription}
                  onChangeText={setChallengeDescription}
                  placeholder="What's this challenge about?"
                  multiline
                  numberOfLines={3}
                  style={{
                    backgroundColor: colors.surface,
                    color: colors.foreground,
                    borderColor: colors.border,
                  }}
                  className="border rounded-xl px-4 py-3 text-base"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View className="gap-3">
                <Text className="text-base font-semibold text-foreground">Goal Type</Text>
                <View className="flex-row gap-2">
                  {[
                    { value: "save_amount", label: "Save Amount" },
                    { value: "reduce_spending", label: "Reduce Spending" },
                    { value: "no_spend_category", label: "No Spend" },
                  ].map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={() => setGoalType(option.value as any)}
                      style={({ pressed }) => [
                        {
                          backgroundColor:
                            goalType === option.value ? colors.primary : colors.surface,
                          borderColor: colors.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                      className="flex-1 rounded-xl py-3 border"
                    >
                      <Text
                        style={{
                          color: goalType === option.value ? colors.background : colors.foreground,
                        }}
                        className="text-center font-semibold text-sm"
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {goalType !== "no_spend_category" ? (
                <View className="gap-3">
                  <Text className="text-base font-semibold text-foreground">Target Amount</Text>
                  <TextInput
                    value={targetAmount}
                    onChangeText={setTargetAmount}
                    placeholder="e.g., 500"
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
              ) : (
                <View className="gap-3">
                  <Text className="text-base font-semibold text-foreground">Category</Text>
                  <TextInput
                    value={targetCategory}
                    onChangeText={setTargetCategory}
                    placeholder="e.g., Dining Out"
                    style={{
                      backgroundColor: colors.surface,
                      color: colors.foreground,
                      borderColor: colors.border,
                    }}
                    className="border rounded-xl px-4 py-3 text-base"
                    placeholderTextColor={colors.muted}
                  />
                </View>
              )}

              <View className="gap-3">
                <Text className="text-base font-semibold text-foreground">Duration (Days)</Text>
                <TextInput
                  value={durationDays}
                  onChangeText={setDurationDays}
                  placeholder="e.g., 30"
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

              <Pressable
                onPress={handleCreateChallenge}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                className="rounded-xl py-4"
              >
                <Text
                  style={{ color: colors.background }}
                  className="text-center font-semibold text-base"
                >
                  Create Challenge
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </ScreenContainer>
      </Modal>

      {/* Leaderboard Modal */}
      <Modal
        visible={showLeaderboardModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLeaderboardModal(false)}
      >
        <ScreenContainer className="p-6">
          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="gap-6">
              <View className="flex-row items-center justify-between">
                <Text className="text-2xl font-bold text-foreground">Leaderboard</Text>
                <Pressable onPress={() => setShowLeaderboardModal(false)}>
                  <Text className="text-base text-muted">Close</Text>
                </Pressable>
              </View>

              {selectedChallenge && (
                <>
                  <View
                    style={{ backgroundColor: colors.primary + "10" }}
                    className="rounded-2xl p-4"
                  >
                    <Text className="text-lg font-bold text-foreground mb-1">
                      {selectedChallenge.name}
                    </Text>
                    <Text style={{ color: colors.primary }} className="text-sm font-semibold">
                      {formatChallengeGoal(selectedChallenge)}
                    </Text>
                  </View>

                  {stats && (
                    <View className="flex-row gap-3">
                      <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
                        <Text className="text-sm text-muted mb-1">Total Progress</Text>
                        <Text style={{ color: colors.success }} className="text-2xl font-bold">
                          ${stats.total_progress.toFixed(0)}
                        </Text>
                      </View>
                      <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
                        <Text className="text-sm text-muted mb-1">Avg Progress</Text>
                        <Text style={{ color: colors.primary }} className="text-2xl font-bold">
                          ${stats.average_progress.toFixed(0)}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View className="gap-3">
                    <Text className="text-lg font-semibold text-foreground">Rankings</Text>
                    {leaderboard.map((participant, index) => (
                      <View
                        key={participant.user_id}
                        style={{
                          backgroundColor:
                            index === 0 ? colors.success + "10" : colors.surface,
                          borderColor: index === 0 ? colors.success : colors.border,
                        }}
                        className="rounded-xl p-4 border"
                      >
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-3">
                            <View
                              style={{
                                backgroundColor:
                                  index === 0
                                    ? colors.success
                                    : index === 1
                                    ? colors.warning
                                    : index === 2
                                    ? "#CD7F32"
                                    : colors.muted,
                              }}
                              className="w-10 h-10 rounded-full items-center justify-center"
                            >
                              <Text
                                style={{ color: colors.background }}
                                className="font-bold text-lg"
                              >
                                {participant.rank}
                              </Text>
                            </View>
                            
                            <View>
                              <Text className="text-base font-semibold text-foreground">
                                {participant.user_name}
                              </Text>
                              <Text className="text-sm text-muted">
                                {getChallengeProgressPercentage(participant).toFixed(0)}% complete
                              </Text>
                            </View>
                          </View>
                          
                          <Text
                            style={{ color: colors.success }}
                            className="text-lg font-bold"
                          >
                            ${participant.current_progress.toFixed(0)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        </ScreenContainer>
      </Modal>

      {/* Invite Friend Modal */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowInviteModal(false)}
      >
        <ScreenContainer className="p-6">
          <View className="gap-6">
            <View className="flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-foreground">Invite Friend</Text>
              <Pressable onPress={() => setShowInviteModal(false)}>
                <Text className="text-base text-muted">Cancel</Text>
              </Pressable>
            </View>

            <View className="gap-3">
              <Text className="text-base font-semibold text-foreground">Friend's Name</Text>
              <TextInput
                value={friendName}
                onChangeText={setFriendName}
                placeholder="Enter name"
                style={{
                  backgroundColor: colors.surface,
                  color: colors.foreground,
                  borderColor: colors.border,
                }}
                className="border rounded-xl px-4 py-3 text-base"
                placeholderTextColor={colors.muted}
              />
            </View>

            <View className="gap-3">
              <Text className="text-base font-semibold text-foreground">Friend's Email</Text>
              <TextInput
                value={friendEmail}
                onChangeText={setFriendEmail}
                placeholder="Enter email"
                keyboardType="email-address"
                autoCapitalize="none"
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
              onPress={handleInviteFriend}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              className="rounded-xl py-4"
            >
              <Text
                style={{ color: colors.background }}
                className="text-center font-semibold text-base"
              >
                Send Invitation
              </Text>
            </Pressable>
          </View>
        </ScreenContainer>
      </Modal>
    </ScreenContainer>
  );
}
