import { ScrollView, Text, View, Pressable, TextInput, Alert, Share } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  getReferralSettings,
  getReferralRewards,
  getReferralStatistics,
  sendReferralViaSMS,
  sendReferralViaEmail,
  redeemRewards,
  getShareMessage,
  getReferralLink,
  type ReferralSettings,
  type ReferralReward,
} from "@/utils/referral-rewards-enhanced";

export default function ReferralRewardsEnhancedScreen() {
  const colors = useColors();
  const [settings, setSettings] = useState<ReferralSettings | null>(null);
  const [rewards, setRewards] = useState<ReferralReward[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [redeemAmount, setRedeemAmount] = useState("");
  const [showRedeem, setShowRedeem] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [settingsData, rewardsData, statsData] = await Promise.all([
      getReferralSettings(),
      getReferralRewards(),
      getReferralStatistics(),
    ]);
    
    setSettings(settingsData);
    setRewards(rewardsData);
    setStats(statsData);
  };

  const handleCopyCode = async () => {
    if (!settings) return;
    
    try {
      await Clipboard.setStringAsync(settings.referral_code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Copied!", "Referral code copied to clipboard");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to copy code");
    }
  };

  const handleShare = async () => {
    if (!settings) return;
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const message = getShareMessage(settings.referral_code, settings.reward_per_referral);
      const link = await getReferralLink();
      
      await Share.share({
        message: `${message}\n\n${link}`,
      });
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to share");
    }
  };

  const handleSendSMS = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert("Error", "Please enter a phone number");
      return;
    }
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const success = await sendReferralViaSMS(phoneNumber);
      
      if (success) {
        setPhoneNumber("");
        Alert.alert("Success", "Referral sent via SMS");
        await loadData();
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to send SMS");
    }
  };

  const handleSendEmail = async () => {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter an email address");
      return;
    }
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const success = await sendReferralViaEmail(email);
      
      if (success) {
        setEmail("");
        Alert.alert("Success", "Referral sent via email");
        await loadData();
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to send email");
    }
  };

  const handleRedeem = async () => {
    const amount = parseFloat(redeemAmount);
    
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const success = await redeemRewards(amount);
      
      if (success) {
        setRedeemAmount("");
        setShowRedeem(false);
        Alert.alert("Success", `$${amount.toFixed(2)} redeemed to your account`);
        await loadData();
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to redeem rewards");
    }
  };

  if (!settings) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center">
          <Text className="text-base text-muted">Loading...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (showRedeem) {
    return (
      <ScreenContainer className="p-6">
        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="gap-6">
            <View className="flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-foreground">Redeem Rewards</Text>
              <Pressable onPress={() => setShowRedeem(false)}>
                <Text className="text-base text-muted">Cancel</Text>
              </Pressable>
            </View>

            <View
              style={{ backgroundColor: colors.success + "20" }}
              className="rounded-2xl p-6 items-center"
            >
              <Text className="text-sm text-muted mb-2">Available Balance</Text>
              <Text
                style={{ color: colors.success }}
                className="text-4xl font-bold"
              >
                ${settings.total_earned.toFixed(2)}
              </Text>
            </View>

            <View className="gap-3">
              <Text className="text-base font-semibold text-foreground">Redeem Amount</Text>
              <TextInput
                value={redeemAmount}
                onChangeText={setRedeemAmount}
                placeholder="Enter amount (min $5)"
                keyboardType="decimal-pad"
                style={{
                  backgroundColor: colors.surface,
                  color: colors.foreground,
                  borderColor: colors.border,
                }}
                className="border rounded-xl px-4 py-3 text-base"
                placeholderTextColor={colors.muted}
              />
              <Text className="text-sm text-muted">
                Minimum redemption: $5.00 • Maximum: ${settings.total_earned.toFixed(2)}
              </Text>
            </View>

            <Pressable
              onPress={handleRedeem}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.success,
                  opacity: pressed ? 0.7 : 1,
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
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">Referral Rewards</Text>
            <Text className="text-sm text-muted">Invite friends and earn together</Text>
          </View>

          {/* Referral Code Card */}
          <View
            style={{ backgroundColor: colors.primary }}
            className="rounded-2xl p-6 gap-4"
          >
            <Text style={{ color: colors.background }} className="text-base font-semibold">
              Your Referral Code
            </Text>
            <View className="flex-row items-center justify-between">
              <Text
                style={{ color: colors.background }}
                className="text-3xl font-bold tracking-widest"
              >
                {settings.referral_code}
              </Text>
              <Pressable
                onPress={handleCopyCode}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.background,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                className="px-4 py-2 rounded-lg"
              >
                <Text style={{ color: colors.primary }} className="font-semibold">
                  Copy
                </Text>
              </Pressable>
            </View>
            <Text style={{ color: colors.background + "CC" }} className="text-sm">
              Share this code with friends. You both get ${settings.reward_per_referral.toFixed(2)}{" "}
              when they sign up!
            </Text>
          </View>

          {/* Statistics */}
          {stats && (
            <View className="flex-row gap-3">
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Total Earned</Text>
                <Text style={{ color: colors.success }} className="text-2xl font-bold">
                  ${stats.total_earned.toFixed(0)}
                </Text>
              </View>
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Referrals</Text>
                <Text style={{ color: colors.primary }} className="text-2xl font-bold">
                  {stats.completed_referrals}
                </Text>
              </View>
            </View>
          )}

          {/* Redeem Button */}
          {settings.total_earned >= 5 && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowRedeem(true);
              }}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.success,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              className="rounded-xl py-4"
            >
              <Text
                style={{ color: colors.background }}
                className="text-center font-semibold text-base"
              >
                Redeem ${settings.total_earned.toFixed(2)}
              </Text>
            </Pressable>
          )}

          {/* Share Options */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Invite Friends</Text>
            
            <Pressable
              onPress={handleShare}
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
                📤 Share Referral Link
              </Text>
            </Pressable>

            <View className="flex-row gap-2">
              <View className="flex-1">
                <TextInput
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  placeholder="Phone number"
                  keyboardType="phone-pad"
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
                onPress={handleSendSMS}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                className="w-14 h-14 rounded-xl items-center justify-center border"
              >
                <Text className="text-xl">💬</Text>
              </Pressable>
            </View>

            <View className="flex-row gap-2">
              <View className="flex-1">
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email address"
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
                onPress={handleSendEmail}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                className="w-14 h-14 rounded-xl items-center justify-center border"
              >
                <Text className="text-xl">✉️</Text>
              </Pressable>
            </View>
          </View>

          {/* Referral History */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">
              Recent Referrals ({rewards.length})
            </Text>
            
            {rewards.length > 0 ? (
              rewards.slice(0, 10).map((reward) => (
                <View
                  key={reward.id}
                  style={{ backgroundColor: colors.surface }}
                  className="rounded-xl p-4 border border-border"
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-foreground">
                        {reward.referee_name}
                      </Text>
                      <Text className="text-sm text-muted">{reward.referee_email}</Text>
                    </View>
                    
                    <View
                      style={{
                        backgroundColor:
                          reward.status === "completed"
                            ? colors.success + "20"
                            : colors.warning + "20",
                      }}
                      className="px-3 py-1 rounded-full"
                    >
                      <Text
                        style={{
                          color: reward.status === "completed" ? colors.success : colors.warning,
                        }}
                        className="text-xs font-semibold"
                      >
                        {reward.status === "completed" ? "Earned" : "Pending"}
                      </Text>
                    </View>
                  </View>
                  
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-muted">
                      {new Date(reward.created_at).toLocaleDateString()}
                    </Text>
                    <Text
                      style={{ color: colors.success }}
                      className="text-base font-bold"
                    >
                      +${reward.reward_amount.toFixed(2)}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View className="items-center py-12">
                <Text className="text-6xl mb-4">🎁</Text>
                <Text className="text-lg font-semibold text-foreground mb-2">
                  No Referrals Yet
                </Text>
                <Text className="text-sm text-muted text-center">
                  Start inviting friends to earn rewards!
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
