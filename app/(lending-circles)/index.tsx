import { ScrollView, Text, View, Pressable, TextInput, Alert, Modal, FlatList } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  getLendingCircles,
  createLendingCircle,
  joinLendingCircle,
  makeContribution,
  addChatMessage,
  getUserCircles,
  getFormingCircles,
  getPendingContributions,
  getCircleStatistics,
  getFrequencyDisplayName,
  calculateTotalPayout,
  type LendingCircle,
  type CircleMember,
} from "@/utils/lending-circles";

export default function LendingCirclesScreen() {
  const colors = useColors();
  const [myCircles, setMyCircles] = useState<LendingCircle[]>([]);
  const [availableCircles, setAvailableCircles] = useState<LendingCircle[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCircleModal, setShowCircleModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedCircle, setSelectedCircle] = useState<LendingCircle | null>(null);
  
  // Create form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contributionAmount, setContributionAmount] = useState("");
  const [frequency, setFrequency] = useState<LendingCircle["frequency"]>("monthly");
  const [maxMembers, setMaxMembers] = useState("");
  const [startDate, setStartDate] = useState("");
  
  // Chat state
  const [chatMessage, setChatMessage] = useState("");
  
  // Mock user ID (in production, get from auth context)
  const currentUserId = "user_123";
  const currentUserName = "John Doe";

  useEffect(() => {
    loadCircles();
  }, []);

  const loadCircles = async () => {
    const [userCircles, forming] = await Promise.all([
      getUserCircles(currentUserId),
      getFormingCircles(),
    ]);
    
    setMyCircles(userCircles);
    setAvailableCircles(forming.filter((c) => !userCircles.some((uc) => uc.id === c.id)));
  };

  const handleCreateCircle = async () => {
    if (!name || !contributionAmount || !maxMembers || !startDate) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    const amount = parseFloat(contributionAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Error", "Please enter a valid contribution amount");
      return;
    }

    const members = parseInt(maxMembers);
    if (isNaN(members) || members < 3 || members > 20) {
      Alert.alert("Error", "Circle must have between 3 and 20 members");
      return;
    }

    const days = parseInt(startDate);
    if (isNaN(days) || days < 1) {
      Alert.alert("Error", "Please enter valid days until start");
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const startDateMs = Date.now() + days * 24 * 60 * 60 * 1000;
      
      const circle = await createLendingCircle({
        name,
        description,
        contribution_amount: amount,
        frequency,
        total_members: members,
        max_members: members,
        start_date: startDateMs,
        rules: [
          "Contributions must be made on time",
          "Payout order is determined by join order",
          "Members must complete all cycles",
          "Late payments may affect credit score",
        ],
        created_by: currentUserId,
      });

      // Auto-join as creator
      await joinLendingCircle(circle.id, {
        user_id: currentUserId,
        name: currentUserName,
        email: "john@example.com",
        phone: "+1234567890",
      });

      Alert.alert("Success", "Circle created! Invite members to join.");
      
      // Reset form
      setName("");
      setDescription("");
      setContributionAmount("");
      setFrequency("monthly");
      setMaxMembers("");
      setStartDate("");
      setShowCreateModal(false);
      
      await loadCircles();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to create circle");
    }
  };

  const handleJoinCircle = async (circle: LendingCircle) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const result = await joinLendingCircle(circle.id, {
        user_id: currentUserId,
        name: currentUserName,
        email: "john@example.com",
        phone: "+1234567890",
      });

      if (result.success) {
        Alert.alert("Success", result.message);
        await loadCircles();
      } else {
        Alert.alert("Error", result.message);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to join circle");
    }
  };

  const handleContribute = async (circle: LendingCircle) => {
    const member = circle.members.find((m) => m.user_id === currentUserId);
    if (!member) {
      Alert.alert("Error", "You are not a member of this circle");
      return;
    }

    const pending = getPendingContributions(circle, member.id);
    if (pending.length === 0) {
      Alert.alert("Info", "No pending contributions for current cycle");
      return;
    }

    Alert.alert(
      "Make Contribution",
      `Contribute $${circle.contribution_amount.toFixed(2)} for cycle ${circle.current_cycle}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Contribute",
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              
              const result = await makeContribution(circle.id, member.id, circle.contribution_amount);
              
              if (result.success) {
                Alert.alert("Success", result.message);
                await loadCircles();
              } else {
                Alert.alert("Error", result.message);
              }
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to make contribution");
            }
          },
        },
      ]
    );
  };

  const handleSendMessage = async () => {
    if (!selectedCircle || !chatMessage.trim()) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      await addChatMessage(selectedCircle.id, currentUserId, currentUserName, chatMessage.trim());
      
      setChatMessage("");
      
      // Reload circle to get updated messages
      const circles = await getLendingCircles();
      const updated = circles.find((c) => c.id === selectedCircle.id);
      if (updated) {
        setSelectedCircle(updated);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to send message");
    }
  };

  const renderCircle = (circle: LendingCircle, isMember: boolean) => {
    const stats = getCircleStatistics(circle);
    const totalPayout = calculateTotalPayout(circle);
    const member = circle.members.find((m) => m.user_id === currentUserId);
    const pending = member ? getPendingContributions(circle, member.id) : [];

    return (
      <Pressable
        key={circle.id}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelectedCircle(circle);
          setShowCircleModal(true);
        }}
        style={({ pressed }) => [
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
        className="rounded-2xl p-4 border mb-3"
      >
        {/* Header */}
        <View className="flex-row items-start justify-between mb-3">
          <View className="flex-1">
            <Text className="text-lg font-semibold text-foreground mb-1">
              {circle.name}
            </Text>
            {circle.description && (
              <Text className="text-sm text-muted">{circle.description}</Text>
            )}
          </View>
          
          <View
            style={{
              backgroundColor:
                circle.status === "active"
                  ? colors.success + "20"
                  : circle.status === "forming"
                  ? colors.primary + "20"
                  : colors.muted + "20",
            }}
            className="px-3 py-1 rounded-full"
          >
            <Text
              style={{
                color:
                  circle.status === "active"
                    ? colors.success
                    : circle.status === "forming"
                    ? colors.primary
                    : colors.muted,
              }}
              className="text-xs font-semibold capitalize"
            >
              {circle.status}
            </Text>
          </View>
        </View>

        {/* Info Grid */}
        <View className="flex-row flex-wrap gap-3 mb-3">
          <View className="flex-1 min-w-[45%]">
            <Text className="text-xs text-muted mb-1">Contribution</Text>
            <Text className="text-sm font-semibold text-foreground">
              ${circle.contribution_amount.toFixed(2)}
            </Text>
          </View>
          <View className="flex-1 min-w-[45%]">
            <Text className="text-xs text-muted mb-1">Frequency</Text>
            <Text className="text-sm font-semibold text-foreground">
              {getFrequencyDisplayName(circle.frequency)}
            </Text>
          </View>
          <View className="flex-1 min-w-[45%]">
            <Text className="text-xs text-muted mb-1">Members</Text>
            <Text className="text-sm font-semibold text-foreground">
              {circle.current_members}/{circle.max_members}
            </Text>
          </View>
          <View className="flex-1 min-w-[45%]">
            <Text className="text-xs text-muted mb-1">Total Payout</Text>
            <Text className="text-sm font-semibold text-foreground">
              ${totalPayout.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Progress */}
        {circle.status === "active" && (
          <View className="mb-3">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xs text-muted">Cycle Progress</Text>
              <Text className="text-xs font-semibold text-foreground">
                {circle.current_cycle}/{circle.total_cycles}
              </Text>
            </View>
            <View className="h-2 bg-background rounded-full overflow-hidden">
              <View
                style={{
                  width: `${stats.completion_percentage}%`,
                  backgroundColor: colors.success,
                }}
                className="h-full rounded-full"
              />
            </View>
          </View>
        )}

        {/* Member Info */}
        {member && (
          <View
            style={{ backgroundColor: colors.primary + "10" }}
            className="p-3 rounded-xl mb-3"
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xs text-muted mb-1">Your Position</Text>
                <Text className="text-sm font-semibold text-foreground">
                  #{member.payout_position}
                </Text>
              </View>
              <View>
                <Text className="text-xs text-muted mb-1">Credit Boost</Text>
                <Text className="text-sm font-semibold text-foreground">
                  +{member.credit_score_boost} pts
                </Text>
              </View>
              <View>
                <Text className="text-xs text-muted mb-1">Contributed</Text>
                <Text className="text-sm font-semibold text-foreground">
                  ${member.total_contributed.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Pending Contributions */}
        {pending.length > 0 && (
          <View
            style={{ backgroundColor: colors.warning + "10", borderColor: colors.warning + "30" }}
            className="p-3 rounded-xl border mb-3"
          >
            <Text style={{ color: colors.warning }} className="text-sm font-semibold">
              ⚠️ Contribution Due: ${circle.contribution_amount.toFixed(2)}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View className="flex-row gap-2">
          {isMember && circle.status === "active" && pending.length > 0 && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                handleContribute(circle);
              }}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.success,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              className="flex-1 rounded-xl py-3"
            >
              <Text
                style={{ color: colors.background }}
                className="text-center font-semibold text-sm"
              >
                Make Contribution
              </Text>
            </Pressable>
          )}
          
          {!isMember && circle.status === "forming" && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                handleJoinCircle(circle);
              }}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              className="flex-1 rounded-xl py-3"
            >
              <Text
                style={{ color: colors.background }}
                className="text-center font-semibold text-sm"
              >
                Join Circle
              </Text>
            </Pressable>
          )}
          
          {isMember && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                setSelectedCircle(circle);
                setShowChatModal(true);
              }}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              className="px-4 py-3 rounded-xl border"
            >
              <Text className="text-foreground font-semibold text-sm">💬 Chat</Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">
              Lending Circles
            </Text>
            <Text className="text-sm text-muted">
              Join or create Susu/Chama groups for savings
            </Text>
          </View>

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
              + Create Lending Circle
            </Text>
          </Pressable>

          {/* My Circles */}
          {myCircles.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">
                My Circles
              </Text>
              {myCircles.map((circle) => renderCircle(circle, true))}
            </View>
          )}

          {/* Available Circles */}
          {availableCircles.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">
                Available to Join
              </Text>
              {availableCircles.map((circle) => renderCircle(circle, false))}
            </View>
          )}

          {/* Empty State */}
          {myCircles.length === 0 && availableCircles.length === 0 && (
            <View className="items-center justify-center py-12">
              <Text className="text-6xl mb-4">🤝</Text>
              <Text className="text-lg font-semibold text-foreground mb-2">
                No circles yet
              </Text>
              <Text className="text-sm text-muted text-center">
                Create a lending circle or wait for others to create one
              </Text>
            </View>
          )}

          {/* Info Card */}
          <View
            style={{ backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }}
            className="rounded-2xl p-4 border"
          >
            <Text className="text-sm font-semibold text-foreground mb-2">
              🤝 How Lending Circles Work
            </Text>
            <Text className="text-sm text-muted mb-1">
              • Members contribute fixed amount each cycle
            </Text>
            <Text className="text-sm text-muted mb-1">
              • One member receives full payout each cycle
            </Text>
            <Text className="text-sm text-muted mb-1">
              • Builds credit score through participation
            </Text>
            <Text className="text-sm text-muted">
              • Everyone gets their turn to receive payout
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Create Circle Modal */}
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
                Create Lending Circle
              </Text>
              <Pressable onPress={() => setShowCreateModal(false)}>
                <Text className="text-2xl text-muted">✕</Text>
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
              <View className="gap-4">
                {/* Name */}
                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Circle Name *</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g., Friends Savings Circle"
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

                {/* Contribution Amount */}
                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Contribution Amount *</Text>
                  <TextInput
                    value={contributionAmount}
                    onChangeText={setContributionAmount}
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

                {/* Frequency */}
                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Frequency</Text>
                  <View className="flex-row gap-2">
                    {(["weekly", "biweekly", "monthly"] as const).map((freq) => (
                      <Pressable
                        key={freq}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setFrequency(freq);
                        }}
                        style={({ pressed }) => [
                          {
                            backgroundColor: frequency === freq ? colors.primary : colors.surface,
                            borderColor: colors.border,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                        className="flex-1 border rounded-xl px-4 py-3"
                      >
                        <Text
                          style={{
                            color: frequency === freq ? colors.background : colors.foreground,
                          }}
                          className="text-sm font-medium text-center capitalize"
                        >
                          {getFrequencyDisplayName(freq)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Max Members */}
                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Max Members (3-20) *</Text>
                  <TextInput
                    value={maxMembers}
                    onChangeText={setMaxMembers}
                    placeholder="5"
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

                {/* Start Date */}
                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Days Until Start *</Text>
                  <TextInput
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="7"
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

                {/* Create Button */}
                <Pressable
                  onPress={handleCreateCircle}
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
                    Create Circle
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Circle Details Modal */}
      <Modal
        visible={showCircleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCircleModal(false)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          {selectedCircle && (
            <View
              style={{ backgroundColor: colors.background }}
              className="rounded-t-3xl p-6"
            >
              <View className="flex-row items-center justify-between mb-6">
                <Text className="text-xl font-bold text-foreground">
                  {selectedCircle.name}
                </Text>
                <Pressable onPress={() => setShowCircleModal(false)}>
                  <Text className="text-2xl text-muted">✕</Text>
                </Pressable>
              </View>

              <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
                <View className="gap-4">
                  {/* Members List */}
                  <View className="gap-2">
                    <Text className="text-sm font-semibold text-foreground">Members</Text>
                    {selectedCircle.members.map((member) => (
                      <View
                        key={member.id}
                        style={{ backgroundColor: colors.surface }}
                        className="p-3 rounded-xl flex-row items-center justify-between"
                      >
                        <View>
                          <Text className="text-sm font-medium text-foreground">
                            {member.name} {member.is_admin && "👑"}
                          </Text>
                          <Text className="text-xs text-muted">
                            Position #{member.payout_position}
                          </Text>
                        </View>
                        <View className="items-end">
                          <Text className="text-xs text-muted">Credit Boost</Text>
                          <Text className="text-sm font-semibold text-foreground">
                            +{member.credit_score_boost} pts
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>

                  {/* Rules */}
                  <View className="gap-2">
                    <Text className="text-sm font-semibold text-foreground">Circle Rules</Text>
                    {selectedCircle.rules.map((rule, index) => (
                      <Text key={index} className="text-sm text-muted">
                        • {rule}
                      </Text>
                    ))}
                  </View>
                </View>
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>

      {/* Chat Modal */}
      <Modal
        visible={showChatModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowChatModal(false)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          {selectedCircle && (
            <View
              style={{ backgroundColor: colors.background }}
              className="rounded-t-3xl p-6"
            >
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-xl font-bold text-foreground">
                  Circle Chat
                </Text>
                <Pressable onPress={() => setShowChatModal(false)}>
                  <Text className="text-2xl text-muted">✕</Text>
                </Pressable>
              </View>

              <FlatList
                data={selectedCircle.messages}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 400 }}
                renderItem={({ item }) => (
                  <View
                    style={{
                      backgroundColor: item.type === "system" ? colors.muted + "20" : colors.surface,
                    }}
                    className="p-3 rounded-xl mb-2"
                  >
                    {item.type === "chat" && (
                      <Text className="text-xs font-semibold text-foreground mb-1">
                        {item.sender_name}
                      </Text>
                    )}
                    <Text
                      style={{
                        color: item.type === "system" ? colors.muted : colors.foreground,
                        fontStyle: item.type === "system" ? "italic" : "normal",
                      }}
                      className="text-sm"
                    >
                      {item.message}
                    </Text>
                    <Text className="text-xs text-muted mt-1">
                      {new Date(item.timestamp).toLocaleString()}
                    </Text>
                  </View>
                )}
              />

              <View className="flex-row gap-2 mt-4">
                <TextInput
                  value={chatMessage}
                  onChangeText={setChatMessage}
                  placeholder="Type a message..."
                  style={{
                    backgroundColor: colors.surface,
                    color: colors.foreground,
                    borderColor: colors.border,
                  }}
                  className="flex-1 border rounded-xl px-4 py-3 text-base"
                  placeholderTextColor={colors.muted}
                />
                <Pressable
                  onPress={handleSendMessage}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                  className="rounded-xl px-6 py-3 justify-center"
                >
                  <Text style={{ color: colors.background }} className="font-semibold">
                    Send
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </ScreenContainer>
  );
}
