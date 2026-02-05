import { ScrollView, Text, View, TouchableOpacity, TextInput, Modal, FlatList } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";

type ChallengeType = "52-week" | "no-spend-month" | "round-up";

export default function ChallengesScreen() {
  const colors = useColors();
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedType, setSelectedType] = useState<ChallengeType>("52-week");
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);

  const { data: challenges, refetch: refetchChallenges } = trpc.savingsChallenges.getChallenges.useQuery();
  // Progress is tracked directly in the challenges table
  const { data: leaderboard } = trpc.savingsChallenges.getLeaderboard.useQuery({ challengeType: selectedType });
  const { data: achievements } = trpc.savingsChallenges.getAchievements.useQuery();

  const startChallengeMutation = trpc.savingsChallenges.startChallenge.useMutation({
    onSuccess: () => {
      refetchChallenges();
      setShowStartModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const pauseChallengeMutation = trpc.savingsChallenges.pauseChallenge.useMutation({
    onSuccess: () => refetchChallenges(),
  });

  const resumeChallengeMutation = trpc.savingsChallenges.resumeChallenge.useMutation({
    onSuccess: () => refetchChallenges(),
  });

  const handleStartChallenge = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startChallengeMutation.mutate({ challengeType: selectedType });
  };

  const handlePauseChallenge = (challengeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pauseChallengeMutation.mutate({ challengeId });
  };

  const handleResumeChallenge = (challengeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resumeChallengeMutation.mutate({ challengeId });
  };

  const getChallengeTitle = (type: string) => {
    switch (type) {
      case "52-week": return "52-Week Challenge";
      case "no-spend-month": return "No-Spend Month";
      case "round-up": return "Round-Up Savings";
      default: return type;
    }
  };

  const getChallengeDescription = (type: string) => {
    switch (type) {
      case "52-week": return "Save $1 in week 1, $2 in week 2, up to $52 in week 52. Total: $1,378";
      case "no-spend-month": return "Track consecutive days without non-essential spending";
      case "round-up": return "Automatically round up transactions and save the difference";
      default: return "";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return colors.success;
      case "PAUSED": return colors.warning;
      case "COMPLETED": return colors.primary;
      default: return colors.muted;
    }
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground mb-2">Savings Challenges</Text>
          <Text className="text-base text-muted">Gamify your savings journey</Text>
        </View>

        {/* Quick Actions */}
        <View className="flex-row gap-3 mb-6">
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowStartModal(true);
            }}
            className="flex-1 bg-primary py-3 rounded-xl items-center"
          >
            <Text className="text-background font-semibold">Start Challenge</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowLeaderboard(true);
            }}
            className="flex-1 bg-surface py-3 rounded-xl items-center border border-border"
          >
            <Text className="text-foreground font-semibold">Leaderboard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowAchievements(true);
            }}
            className="flex-1 bg-surface py-3 rounded-xl items-center border border-border"
          >
            <Text className="text-foreground font-semibold">Achievements</Text>
          </TouchableOpacity>
        </View>

        {/* Active Challenges */}
        {challenges && challenges.length > 0 ? (
          <View className="gap-4">
            {challenges.map((challenge) => {
              const progressPercent = challenge.currentAmount && challenge.targetAmount ? 
                (parseFloat(challenge.currentAmount) / parseFloat(challenge.targetAmount)) * 100 : 0;

              return (
                <View key={challenge.id} className="bg-surface rounded-2xl p-4 border border-border">
                  {/* Challenge Header */}
                  <View className="flex-row justify-between items-start mb-3">
                    <View className="flex-1">
                      <Text className="text-lg font-bold text-foreground">
                        {getChallengeTitle(challenge.challengeType)}
                      </Text>
                      <View className="flex-row items-center gap-2 mt-1">
                        <View 
                          className="px-2 py-1 rounded"
                          style={{ backgroundColor: getStatusColor(challenge.status) + '20' }}
                        >
                          <Text style={{ color: getStatusColor(challenge.status) }} className="text-xs font-medium">
                            {challenge.status}
                          </Text>
                        </View>
                        {challenge.challengeType === "52-week" && challenge.weekNumber && (
                          <Text className="text-xs text-muted">
                            Week {challenge.weekNumber} of 52
                          </Text>
                        )}
                        {challenge.challengeType === "no-spend-month" && challenge.consecutiveDays !== undefined && (
                          <Text className="text-xs text-muted">
                            {challenge.consecutiveDays} days streak
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Progress Bar */}
                  <View className="mb-3">
                    <View className="flex-row justify-between mb-1">
                      <Text className="text-sm text-muted">Progress</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        ${parseFloat(challenge.currentAmount || '0').toFixed(2)} / ${parseFloat(challenge.targetAmount).toFixed(2)}
                      </Text>
                    </View>
                    <View className="h-2 bg-border rounded-full overflow-hidden">
                      <View 
                        className="h-full rounded-full"
                        style={{ 
                          width: `${Math.min(progressPercent, 100)}%`,
                          backgroundColor: colors.success
                        }}
                      />
                    </View>
                    <Text className="text-xs text-muted mt-1">{progressPercent.toFixed(1)}% complete</Text>
                  </View>

                  {/* Actions */}
                  <View className="flex-row gap-2">
                    {challenge.status === "ACTIVE" && (
                      <TouchableOpacity
                        onPress={() => handlePauseChallenge(challenge.id)}
                        className="flex-1 bg-warning/20 py-2 rounded-lg items-center"
                      >
                        <Text className="text-warning font-medium">Pause</Text>
                      </TouchableOpacity>
                    )}
                    {challenge.status === "PAUSED" && (
                      <TouchableOpacity
                        onPress={() => handleResumeChallenge(challenge.id)}
                        className="flex-1 bg-success/20 py-2 rounded-lg items-center"
                      >
                        <Text className="text-success font-medium">Resume</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View className="bg-surface rounded-2xl p-6 items-center border border-border">
            <Text className="text-4xl mb-3">🎯</Text>
            <Text className="text-lg font-semibold text-foreground mb-2">No Active Challenges</Text>
            <Text className="text-sm text-muted text-center mb-4">
              Start a savings challenge to gamify your financial goals
            </Text>
            <TouchableOpacity
              onPress={() => setShowStartModal(true)}
              className="bg-primary px-6 py-2 rounded-lg"
            >
              <Text className="text-background font-semibold">Start Your First Challenge</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Start Challenge Modal */}
        <Modal visible={showStartModal} transparent animationType="slide">
          <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View className="bg-background rounded-t-3xl p-6" style={{ maxHeight: '80%' }}>
              <Text className="text-2xl font-bold text-foreground mb-4">Start a Challenge</Text>
              
              {/* Challenge Types */}
              <View className="gap-3 mb-6">
                {[
                  { type: "52-week" as ChallengeType, icon: "📅", title: "52-Week Challenge", desc: "Save incrementally each week" },
                  { type: "no-spend-month" as ChallengeType, icon: "🚫", title: "No-Spend Month", desc: "Track spending-free days" },
                  { type: "round-up" as ChallengeType, icon: "🔄", title: "Round-Up Savings", desc: "Auto-save transaction change" },
                ].map((challenge) => (
                  <TouchableOpacity
                    key={challenge.type}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedType(challenge.type);
                    }}
                    className={`p-4 rounded-xl border-2 ${
                      selectedType === challenge.type ? 'border-primary bg-primary/10' : 'border-border bg-surface'
                    }`}
                  >
                    <View className="flex-row items-center gap-3">
                      <Text className="text-3xl">{challenge.icon}</Text>
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-foreground">{challenge.title}</Text>
                        <Text className="text-sm text-muted">{challenge.desc}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Challenge Details */}
              <View className="bg-surface rounded-xl p-4 mb-6 border border-border">
                <Text className="text-sm font-semibold text-foreground mb-2">Challenge Details</Text>
                <Text className="text-sm text-muted">{getChallengeDescription(selectedType)}</Text>
              </View>

              {/* Actions */}
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => setShowStartModal(false)}
                  className="flex-1 bg-surface py-3 rounded-xl items-center border border-border"
                >
                  <Text className="text-foreground font-semibold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleStartChallenge}
                  disabled={startChallengeMutation.isPending}
                  className="flex-1 bg-primary py-3 rounded-xl items-center"
                >
                  <Text className="text-background font-semibold">
                    {startChallengeMutation.isPending ? "Starting..." : "Start Challenge"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Leaderboard Modal */}
        <Modal visible={showLeaderboard} transparent animationType="slide">
          <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View className="bg-background rounded-t-3xl p-6" style={{ maxHeight: '80%' }}>
              <Text className="text-2xl font-bold text-foreground mb-4">Leaderboard</Text>
              
              {/* Challenge Type Selector */}
              <View className="flex-row gap-2 mb-4">
                {[
                  { type: "52-week" as ChallengeType, label: "52-Week" },
                  { type: "no-spend-month" as ChallengeType, label: "No-Spend" },
                  { type: "round-up" as ChallengeType, label: "Round-Up" },
                ].map((challenge) => (
                  <TouchableOpacity
                    key={challenge.type}
                    onPress={() => setSelectedType(challenge.type)}
                    className={`px-4 py-2 rounded-lg ${
                      selectedType === challenge.type ? 'bg-primary' : 'bg-surface border border-border'
                    }`}
                  >
                    <Text className={selectedType === challenge.type ? 'text-background font-semibold' : 'text-foreground'}>
                      {challenge.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Leaderboard List */}
              <ScrollView className="flex-1 mb-4">
                {leaderboard && leaderboard.length > 0 ? (
                  leaderboard.map((entry, index) => (
                    <View key={entry.userId} className="flex-row items-center py-3 border-b border-border">
                      <Text className="text-lg font-bold text-foreground w-8">{entry.rank}</Text>
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-foreground">User {entry.userId.slice(0, 8)}</Text>
                        <Text className="text-sm text-muted">${parseFloat(entry.totalSaved).toFixed(2)} saved</Text>
                      </View>
                      {index < 3 && (
                        <Text className="text-2xl">{index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}</Text>
                      )}
                    </View>
                  ))
                ) : (
                  <View className="items-center py-8">
                    <Text className="text-muted">No leaderboard data yet</Text>
                  </View>
                )}
              </ScrollView>

              <TouchableOpacity
                onPress={() => setShowLeaderboard(false)}
                className="bg-surface py-3 rounded-xl items-center border border-border"
              >
                <Text className="text-foreground font-semibold">Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Achievements Modal */}
        <Modal visible={showAchievements} transparent animationType="slide">
          <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View className="bg-background rounded-t-3xl p-6" style={{ maxHeight: '80%' }}>
              <Text className="text-2xl font-bold text-foreground mb-4">Achievements</Text>
              
              <ScrollView className="flex-1 mb-4">
                {achievements && achievements.length > 0 ? (
                  achievements.map((achievement) => (
                    <View key={achievement.id} className="bg-surface rounded-xl p-4 mb-3 border border-border">
                      <View className="flex-row items-center gap-3">
                        <Text className="text-4xl">{achievement.icon}</Text>
                        <View className="flex-1">
                          <Text className="text-base font-semibold text-foreground">{achievement.title}</Text>
                          <Text className="text-sm text-muted">{achievement.description}</Text>
                          <Text className="text-xs text-muted mt-1">
                            Earned {new Date(achievement.earnedAt).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))
                ) : (
                  <View className="items-center py-8">
                    <Text className="text-4xl mb-3">🏆</Text>
                    <Text className="text-lg font-semibold text-foreground mb-2">No Achievements Yet</Text>
                    <Text className="text-sm text-muted text-center">
                      Complete challenges to earn achievements
                    </Text>
                  </View>
                )}
              </ScrollView>

              <TouchableOpacity
                onPress={() => setShowAchievements(false)}
                className="bg-surface py-3 rounded-xl items-center border border-border"
              >
                <Text className="text-foreground font-semibold">Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </ScreenContainer>
  );
}
