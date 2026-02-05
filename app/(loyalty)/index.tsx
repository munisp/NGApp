import { ScrollView, Text, View, TouchableOpacity, TextInput, RefreshControl, Platform } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  getMerchants,
  getUserProfile,
  getLoyaltyTransactions,
  getRewards,
  redeemReward,
  simulatePurchase,
  getTierBenefits,
  getNextTierRequirement,
  type LoyaltyMerchant,
  type UserLoyaltyProfile,
  type LoyaltyTransaction,
  type LoyaltyReward,
} from "@/utils/merchant-loyalty";

export default function MerchantLoyaltyScreen() {
  const colors = useColors();
  const [merchants, setMerchants] = useState<LoyaltyMerchant[]>([]);
  const [profile, setProfile] = useState<UserLoyaltyProfile | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"merchants" | "rewards" | "profile">("merchants");
  const [selectedMerchant, setSelectedMerchant] = useState<LoyaltyMerchant | null>(null);
  const [purchaseAmount, setPurchaseAmount] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [merchantsData, profileData, transactionsData, rewardsData] = await Promise.all([
      getMerchants(),
      getUserProfile(),
      getLoyaltyTransactions(),
      getRewards(),
    ]);

    setMerchants(merchantsData);
    setProfile(profileData);
    setTransactions(transactionsData);
    setRewards(rewardsData.filter((r) => !r.redeemed));
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSimulatePurchase = async () => {
    if (!selectedMerchant || !purchaseAmount) return;

    const amount = parseFloat(purchaseAmount);
    if (isNaN(amount) || amount <= 0) return;

    try {
      await simulatePurchase(selectedMerchant.id, amount);
      setPurchaseAmount("");
      setSelectedMerchant(null);
      await loadData();
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Failed to simulate purchase:", error);
    }
  };

  const handleRedeemReward = async (rewardId: string) => {
    try {
      await redeemReward(rewardId);
      await loadData();
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error: any) {
      console.error("Failed to redeem reward:", error.message);
      alert(error.message);
    }
  };

  if (!profile) {
    return (
      <ScreenContainer className="p-4 justify-center items-center">
        <Text className="text-muted">Loading loyalty data...</Text>
      </ScreenContainer>
    );
  }

  const tierColors = {
    bronze: "#CD7F32",
    silver: "#C0C0C0",
    gold: "#FFD700",
    platinum: "#E5E4E2",
  };

  const tierColor = tierColors[profile.tier];
  const nextTier = getNextTierRequirement(profile.tier);

  return (
    <ScreenContainer className="p-4">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Header */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground">Merchant Loyalty</Text>
          <Text className="text-sm text-muted mt-1">Earn points and redeem exclusive rewards</Text>
        </View>

        {/* Points Summary */}
        <View className="bg-surface rounded-2xl p-6 mb-4 border border-border">
          <View className="flex-row justify-between items-center mb-4">
            <View>
              <Text className="text-sm text-muted mb-1">Total Points</Text>
              <Text className="text-4xl font-bold text-foreground">{profile.totalPoints.toLocaleString()}</Text>
            </View>
            <View className="px-4 py-2 rounded-full" style={{ backgroundColor: tierColor + "40" }}>
              <Text className="font-bold capitalize" style={{ color: tierColor }}>
                {profile.tier}
              </Text>
            </View>
          </View>

          {nextTier && (
            <View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-xs text-muted">Progress to {nextTier.nextTier}</Text>
                <Text className="text-xs text-muted">
                  {profile.lifetimePoints} / {nextTier.pointsRequired}
                </Text>
              </View>
              <View className="bg-background rounded-full h-2">
                <View
                  className="bg-primary rounded-full h-2"
                  style={{ width: `${(profile.lifetimePoints / nextTier.pointsRequired) * 100}%` }}
                />
              </View>
            </View>
          )}
        </View>

        {/* Tabs */}
        <View className="flex-row mb-4 bg-surface rounded-xl p-1">
          {(["merchants", "rewards", "profile"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg ${activeTab === tab ? "bg-primary" : ""}`}
            >
              <Text
                className={`text-center font-semibold capitalize ${
                  activeTab === tab ? "text-background" : "text-muted"
                }`}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Merchants Tab */}
        {activeTab === "merchants" && (
          <View>
            {merchants.map((merchant) => (
              <TouchableOpacity
                key={merchant.id}
                onPress={() => setSelectedMerchant(merchant)}
                className="bg-surface rounded-xl p-4 mb-3 border border-border"
              >
                <View className="flex-row items-center mb-3">
                  <Text className="text-4xl mr-3">{merchant.logo}</Text>
                  <View className="flex-1">
                    <Text className="text-lg font-bold text-foreground">{merchant.name}</Text>
                    <Text className="text-xs text-muted">{merchant.category} • {merchant.location}</Text>
                  </View>
                  <View
                    className="px-3 py-1 rounded-full"
                    style={{ backgroundColor: tierColors[merchant.tier] + "40" }}
                  >
                    <Text className="text-xs font-semibold capitalize" style={{ color: tierColors[merchant.tier] }}>
                      {merchant.tier}
                    </Text>
                  </View>
                </View>

                <Text className="text-sm text-muted mb-3">{merchant.description}</Text>

                <View className="flex-row justify-between items-center">
                  <View>
                    <Text className="text-xs text-muted">Base Points</Text>
                    <Text className="text-base font-bold text-foreground">{merchant.basePoints}x per $1</Text>
                  </View>
                  {merchant.bonusMultiplier > 1 && (
                    <View className="bg-success px-3 py-1 rounded-full">
                      <Text className="text-background text-xs font-bold">{merchant.bonusMultiplier}x BONUS</Text>
                    </View>
                  )}
                </View>

                {profile.merchantPoints[merchant.id] && (
                  <View className="mt-3 pt-3 border-t border-border">
                    <Text className="text-xs text-muted">
                      Your points: {profile.merchantPoints[merchant.id].toLocaleString()}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Rewards Tab */}
        {activeTab === "rewards" && (
          <View>
            {rewards.length === 0 ? (
              <View className="bg-surface rounded-xl p-6 border border-border items-center">
                <Text className="text-muted text-center">No rewards available. Earn more points to unlock rewards!</Text>
              </View>
            ) : (
              rewards.map((reward) => (
                <View key={reward.id} className="bg-surface rounded-xl p-4 mb-3 border border-border">
                  <View className="flex-row justify-between items-start mb-2">
                    <View className="flex-1">
                      <Text className="text-base font-bold text-foreground mb-1">{reward.title}</Text>
                      <Text className="text-xs text-muted mb-2">{reward.merchantName}</Text>
                      <Text className="text-sm text-muted">{reward.description}</Text>
                    </View>
                  </View>

                  <View className="flex-row justify-between items-center mt-3">
                    <View>
                      <Text className="text-xs text-muted">Cost</Text>
                      <Text className="text-lg font-bold text-foreground">{reward.pointsCost.toLocaleString()} pts</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRedeemReward(reward.id)}
                      disabled={profile.totalPoints < reward.pointsCost}
                      className={`px-6 py-2 rounded-full ${
                        profile.totalPoints >= reward.pointsCost ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <Text
                        className={`font-semibold ${
                          profile.totalPoints >= reward.pointsCost ? "text-background" : "text-background"
                        }`}
                      >
                        {profile.totalPoints >= reward.pointsCost ? "Redeem" : "Insufficient"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <View>
            {/* Tier Benefits */}
            <View className="bg-surface rounded-xl p-4 mb-4 border border-border">
              <Text className="text-lg font-bold text-foreground mb-3">
                {profile.tier.charAt(0).toUpperCase() + profile.tier.slice(1)} Tier Benefits
              </Text>
              {getTierBenefits(profile.tier).map((benefit, index) => (
                <View key={index} className="flex-row items-center mb-2">
                  <Text className="text-success mr-2">✓</Text>
                  <Text className="text-sm text-foreground flex-1">{benefit}</Text>
                </View>
              ))}
            </View>

            {/* Stats */}
            <View className="bg-surface rounded-xl p-4 mb-4 border border-border">
              <Text className="text-lg font-bold text-foreground mb-3">Your Stats</Text>
              <View className="flex-row justify-between mb-3">
                <Text className="text-sm text-muted">Lifetime Points</Text>
                <Text className="text-base font-bold text-foreground">{profile.lifetimePoints.toLocaleString()}</Text>
              </View>
              <View className="flex-row justify-between mb-3">
                <Text className="text-sm text-muted">Total Transactions</Text>
                <Text className="text-base font-bold text-foreground">{profile.transactionCount}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">Total Spent</Text>
                <Text className="text-base font-bold text-foreground">${profile.totalSpent.toFixed(2)}</Text>
              </View>
            </View>

            {/* Recent Transactions */}
            <View className="mb-4">
              <Text className="text-lg font-bold text-foreground mb-3">Recent Transactions</Text>
              {transactions.length === 0 ? (
                <View className="bg-surface rounded-xl p-6 border border-border items-center">
                  <Text className="text-muted text-center">No transactions yet. Start earning points today!</Text>
                </View>
              ) : (
                transactions.slice(0, 5).map((transaction) => (
                  <View key={transaction.id} className="bg-surface rounded-xl p-4 mb-3 border border-border">
                    <View className="flex-row justify-between items-center">
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-foreground">{transaction.merchantName}</Text>
                        <Text className="text-xs text-muted">
                          {new Date(transaction.date).toLocaleDateString()}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-base font-bold text-foreground">${transaction.amount.toFixed(2)}</Text>
                        <Text className="text-sm text-success">+{transaction.pointsEarned} pts</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* Purchase Simulator (when merchant selected) */}
        {selectedMerchant && (
          <View className="bg-surface rounded-2xl p-4 mt-4 border border-border">
            <Text className="text-xl font-bold text-foreground mb-4">
              Simulate Purchase at {selectedMerchant.name}
            </Text>

            <TextInput
              value={purchaseAmount}
              onChangeText={setPurchaseAmount}
              placeholder="Purchase amount"
              keyboardType="numeric"
              placeholderTextColor={colors.muted}
              className="bg-background border border-border rounded-lg px-4 py-3 text-foreground mb-3"
            />

            {purchaseAmount && parseFloat(purchaseAmount) > 0 && (
              <View className="bg-background rounded-lg p-3 mb-4">
                <Text className="text-sm text-muted mb-1">You'll earn:</Text>
                <Text className="text-2xl font-bold text-success">
                  {Math.floor(
                    parseFloat(purchaseAmount) * selectedMerchant.basePoints * selectedMerchant.bonusMultiplier
                  )}{" "}
                  points
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleSimulatePurchase}
              className="bg-primary rounded-xl py-4 items-center mb-3"
            >
              <Text className="text-background font-bold text-lg">Simulate Purchase</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSelectedMerchant(null)}
              className="py-3 items-center"
            >
              <Text className="text-muted font-semibold">Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
