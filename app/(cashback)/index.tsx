import { ScrollView, Text, View, Pressable, TextInput, Alert, Modal, FlatList } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  getMerchants,
  getFeaturedMerchants,
  getCashbackBalance,
  getRecentTransactions,
  getActiveBonusCategories,
  getCashbackStatistics,
  redeemCashback,
  simulatePurchase,
  getEffectiveCashbackRate,
  type Merchant,
  type CashbackTransaction,
  type BonusCategory,
} from "@/utils/cashback-rewards";

export default function CashbackRewardsScreen() {
  const colors = useColors();
  const [balance, setBalance] = useState<any>(null);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [featuredMerchants, setFeaturedMerchants] = useState<Merchant[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<CashbackTransaction[]>([]);
  const [bonusCategories, setBonusCategories] = useState<BonusCategory[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [showMerchantModal, setShowMerchantModal] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [redeemAmount, setRedeemAmount] = useState("");
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [bal, merch, featured, recent, bonus, statistics] = await Promise.all([
      getCashbackBalance(),
      getMerchants(),
      getFeaturedMerchants(),
      getRecentTransactions(5),
      getActiveBonusCategories(),
      getCashbackStatistics(),
    ]);
    
    setBalance(bal);
    setMerchants(merch);
    setFeaturedMerchants(featured);
    setRecentTransactions(recent);
    setBonusCategories(bonus);
    setStats(statistics);
  };

  const handleRedeem = async () => {
    const amount = parseFloat(redeemAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const result = await redeemCashback(amount);
      
      if (result.success) {
        Alert.alert("Success", result.message);
        setRedeemAmount("");
        setShowRedeemModal(false);
        await loadData();
      } else {
        Alert.alert("Error", result.message);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to redeem cashback");
    }
  };

  const handleSimulatePurchase = async () => {
    if (!selectedMerchant) return;

    const amount = parseFloat(purchaseAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Error", "Please enter a valid purchase amount");
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const transaction = await simulatePurchase(selectedMerchant.id, amount);
      
      Alert.alert(
        "Purchase Simulated",
        `You'll earn $${transaction.cashback_amount.toFixed(2)} cashback (${transaction.cashback_rate}%)`,
        [{ text: "Great!", style: "default" }]
      );
      
      setPurchaseAmount("");
      setShowMerchantModal(false);
      setSelectedMerchant(null);
      
      await loadData();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to simulate purchase");
    }
  };

  const renderMerchant = (merchant: Merchant) => {
    const effectiveRate = merchant.bonus_rate || merchant.base_cashback_rate;

    return (
      <Pressable
        key={merchant.id}
        onPress={async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelectedMerchant(merchant);
          setShowMerchantModal(true);
        }}
        style={({ pressed }) => [
          {
            backgroundColor: colors.surface,
            borderColor: merchant.is_featured ? colors.primary : colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
        className="rounded-2xl p-4 border mb-3"
      >
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1">
            <Text className="text-lg font-semibold text-foreground mb-1">
              {merchant.name}
            </Text>
            <Text className="text-xs text-muted mb-1">{merchant.category}</Text>
            <Text className="text-sm text-muted">{merchant.description}</Text>
          </View>
          
          <View
            style={{
              backgroundColor: merchant.is_featured ? colors.primary + "20" : colors.success + "20",
            }}
            className="px-3 py-2 rounded-xl"
          >
            <Text
              style={{
                color: merchant.is_featured ? colors.primary : colors.success,
              }}
              className="text-lg font-bold"
            >
              {effectiveRate}%
            </Text>
            <Text
              style={{
                color: merchant.is_featured ? colors.primary : colors.success,
              }}
              className="text-xs"
            >
              cashback
            </Text>
          </View>
        </View>

        {merchant.is_featured && (
          <View
            style={{ backgroundColor: colors.primary + "10" }}
            className="p-2 rounded-lg"
          >
            <Text style={{ color: colors.primary }} className="text-xs font-semibold">
              ⭐ Featured Merchant
            </Text>
          </View>
        )}
      </Pressable>
    );
  };

  const filteredMerchants = searchQuery
    ? merchants.filter((m) =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : merchants;

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">
              Cashback Rewards
            </Text>
            <Text className="text-sm text-muted">
              Earn cashback on every purchase
            </Text>
          </View>

          {/* Balance Card */}
          {balance && (
            <View
              style={{ backgroundColor: colors.primary }}
              className="rounded-2xl p-6"
            >
              <Text
                style={{ color: colors.background }}
                className="text-sm mb-2 opacity-80"
              >
                Available Cashback
              </Text>
              <Text
                style={{ color: colors.background }}
                className="text-4xl font-bold mb-4"
              >
                ${balance.available.toFixed(2)}
              </Text>
              
              <View className="flex-row gap-4 mb-4">
                <View>
                  <Text
                    style={{ color: colors.background }}
                    className="text-xs opacity-80 mb-1"
                  >
                    Pending
                  </Text>
                  <Text
                    style={{ color: colors.background }}
                    className="text-base font-semibold"
                  >
                    ${balance.pending.toFixed(2)}
                  </Text>
                </View>
                <View>
                  <Text
                    style={{ color: colors.background }}
                    className="text-xs opacity-80 mb-1"
                  >
                    Lifetime
                  </Text>
                  <Text
                    style={{ color: colors.background }}
                    className="text-base font-semibold"
                  >
                    ${balance.lifetime_earnings.toFixed(2)}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowRedeemModal(true);
                }}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.background,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                className="rounded-xl py-3"
              >
                <Text
                  style={{ color: colors.primary }}
                  className="text-center font-semibold"
                >
                  Redeem Cashback
                </Text>
              </Pressable>
            </View>
          )}

          {/* Stats */}
          {stats && (
            <View className="flex-row gap-3">
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">This Month</Text>
                <Text className="text-xl font-bold text-foreground">
                  ${stats.monthly_earnings.toFixed(2)}
                </Text>
              </View>
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Avg Rate</Text>
                <Text className="text-xl font-bold text-foreground">
                  {stats.average_cashback_rate.toFixed(1)}%
                </Text>
              </View>
            </View>
          )}

          {/* Bonus Categories */}
          {bonusCategories.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">
                🔥 Bonus Categories
              </Text>
              {bonusCategories.map((bonus) => (
                <View
                  key={bonus.id}
                  style={{ backgroundColor: colors.warning + "10", borderColor: colors.warning + "30" }}
                  className="rounded-2xl p-4 border"
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-2xl">{bonus.icon}</Text>
                      <Text className="text-base font-semibold text-foreground">
                        {bonus.name}
                      </Text>
                    </View>
                    <View
                      style={{ backgroundColor: colors.warning + "20" }}
                      className="px-3 py-1 rounded-full"
                    >
                      <Text style={{ color: colors.warning }} className="text-sm font-bold">
                        {bonus.bonus_rate}%
                      </Text>
                    </View>
                  </View>
                  <Text className="text-sm text-muted mb-2">{bonus.description}</Text>
                  <Text className="text-xs text-muted">
                    Ends {new Date(bonus.end_date).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Featured Merchants */}
          {featuredMerchants.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">
                ⭐ Featured Merchants
              </Text>
              {featuredMerchants.map(renderMerchant)}
            </View>
          )}

          {/* Search */}
          <View className="gap-2">
            <Text className="text-lg font-semibold text-foreground">
              All Merchants
            </Text>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search merchants..."
              style={{
                backgroundColor: colors.surface,
                color: colors.foreground,
                borderColor: colors.border,
              }}
              className="border rounded-xl px-4 py-3 text-base"
              placeholderTextColor={colors.muted}
            />
          </View>

          {/* All Merchants */}
          <View className="gap-3">
            {filteredMerchants.map(renderMerchant)}
          </View>

          {/* Recent Transactions */}
          {recentTransactions.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">
                Recent Cashback
              </Text>
              {recentTransactions.map((transaction) => (
                <View
                  key={transaction.id}
                  style={{ backgroundColor: colors.surface }}
                  className="rounded-xl p-4 border border-border"
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-foreground">
                        {transaction.merchant_name}
                      </Text>
                      <Text className="text-sm text-muted">
                        ${transaction.amount.toFixed(2)} purchase
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text style={{ color: colors.success }} className="text-lg font-bold">
                        +${transaction.cashback_amount.toFixed(2)}
                      </Text>
                      <Text className="text-xs text-muted">
                        {transaction.cashback_rate}% cashback
                      </Text>
                    </View>
                  </View>
                  <View
                    style={{
                      backgroundColor:
                        transaction.status === "approved"
                          ? colors.success + "20"
                          : transaction.status === "pending"
                          ? colors.warning + "20"
                          : colors.muted + "20",
                    }}
                    className="px-3 py-1 rounded-full self-start"
                  >
                    <Text
                      style={{
                        color:
                          transaction.status === "approved"
                            ? colors.success
                            : transaction.status === "pending"
                            ? colors.warning
                            : colors.muted,
                      }}
                      className="text-xs font-semibold capitalize"
                    >
                      {transaction.status}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Info Card */}
          <View
            style={{ backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }}
            className="rounded-2xl p-4 border"
          >
            <Text className="text-sm font-semibold text-foreground mb-2">
              💰 How Cashback Works
            </Text>
            <Text className="text-sm text-muted mb-1">
              • Earn cashback on purchases at partner merchants
            </Text>
            <Text className="text-sm text-muted mb-1">
              • Cashback approved within 24-48 hours
            </Text>
            <Text className="text-sm text-muted mb-1">
              • Minimum redemption amount is $5
            </Text>
            <Text className="text-sm text-muted">
              • Bonus categories change monthly
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Redeem Modal */}
      <Modal
        visible={showRedeemModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRedeemModal(false)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View
            style={{ backgroundColor: colors.background }}
            className="rounded-t-3xl p-6"
          >
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-foreground">
                Redeem Cashback
              </Text>
              <Pressable onPress={() => setShowRedeemModal(false)}>
                <Text className="text-2xl text-muted">✕</Text>
              </Pressable>
            </View>

            <View className="gap-4">
              {balance && (
                <View className="bg-surface rounded-xl p-4 mb-2">
                  <Text className="text-sm text-muted mb-1">Available Balance</Text>
                  <Text className="text-2xl font-bold text-foreground">
                    ${balance.available.toFixed(2)}
                  </Text>
                </View>
              )}

              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">Amount to Redeem</Text>
                <TextInput
                  value={redeemAmount}
                  onChangeText={setRedeemAmount}
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
                <Text className="text-xs text-muted">Minimum redemption: $5.00</Text>
              </View>

              <Pressable
                onPress={handleRedeem}
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
                  Redeem to Account
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Merchant Modal */}
      <Modal
        visible={showMerchantModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMerchantModal(false)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          {selectedMerchant && (
            <View
              style={{ backgroundColor: colors.background }}
              className="rounded-t-3xl p-6"
            >
              <View className="flex-row items-center justify-between mb-6">
                <Text className="text-xl font-bold text-foreground">
                  {selectedMerchant.name}
                </Text>
                <Pressable onPress={() => setShowMerchantModal(false)}>
                  <Text className="text-2xl text-muted">✕</Text>
                </Pressable>
              </View>

              <View className="gap-4">
                <View className="bg-surface rounded-xl p-4">
                  <Text className="text-sm text-muted mb-1">Cashback Rate</Text>
                  <Text className="text-3xl font-bold text-foreground">
                    {selectedMerchant.bonus_rate || selectedMerchant.base_cashback_rate}%
                  </Text>
                  {selectedMerchant.bonus_rate && (
                    <Text style={{ color: colors.primary }} className="text-xs font-semibold mt-1">
                      ⭐ Bonus rate active!
                    </Text>
                  )}
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">
                    Simulate Purchase (Demo)
                  </Text>
                  <TextInput
                    value={purchaseAmount}
                    onChangeText={setPurchaseAmount}
                    placeholder="Enter purchase amount"
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

                <Pressable
                  onPress={handleSimulatePurchase}
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
                    Simulate Purchase
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
