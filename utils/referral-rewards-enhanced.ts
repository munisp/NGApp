import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SMS from "expo-sms";
import * as MailComposer from "expo-mail-composer";

export interface ReferralReward {
  id: string;
  referrer_id: string;
  referee_id: string;
  referee_name: string;
  referee_email: string;
  status: "pending" | "completed" | "expired";
  reward_amount: number;
  created_at: number;
  completed_at?: number;
}

export interface ReferralSettings {
  referral_code: string;
  reward_per_referral: number;
  total_earned: number;
  total_referrals: number;
  pending_rewards: number;
}

const REFERRAL_SETTINGS_STORAGE_KEY = "referral_settings_enhanced";
const REFERRAL_REWARDS_STORAGE_KEY = "referral_rewards_enhanced";
const REFERRAL_INVITES_STORAGE_KEY = "referral_invites_enhanced";

/**
 * Generate unique referral code
 */
function generateReferralCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Get or create referral settings
 */
export async function getReferralSettings(): Promise<ReferralSettings> {
  try {
    const settingsJson = await AsyncStorage.getItem(REFERRAL_SETTINGS_STORAGE_KEY);
    
    if (!settingsJson) {
      // Create new settings
      const newSettings: ReferralSettings = {
        referral_code: generateReferralCode(),
        reward_per_referral: 10.00,
        total_earned: 0,
        total_referrals: 0,
        pending_rewards: 0,
      };
      
      await AsyncStorage.setItem(
        REFERRAL_SETTINGS_STORAGE_KEY,
        JSON.stringify(newSettings)
      );
      
      return newSettings;
    }
    
    return JSON.parse(settingsJson);
  } catch (error) {
    console.error("Failed to get referral settings:", error);
    return {
      referral_code: generateReferralCode(),
      reward_per_referral: 10.00,
      total_earned: 0,
      total_referrals: 0,
      pending_rewards: 0,
    };
  }
}

/**
 * Get all referral rewards
 */
export async function getReferralRewards(): Promise<ReferralReward[]> {
  try {
    const rewardsJson = await AsyncStorage.getItem(REFERRAL_REWARDS_STORAGE_KEY);
    if (!rewardsJson) return [];
    
    const rewards: ReferralReward[] = JSON.parse(rewardsJson);
    
    // Sort by created_at descending
    rewards.sort((a, b) => b.created_at - a.created_at);
    
    return rewards;
  } catch (error) {
    console.error("Failed to get referral rewards:", error);
    return [];
  }
}

/**
 * Create referral reward
 */
export async function createReferralReward(
  refereeName: string,
  refereeEmail: string
): Promise<ReferralReward> {
  try {
    const settings = await getReferralSettings();
    const rewards = await getReferralRewards();
    
    const reward: ReferralReward = {
      id: `reward_${Date.now()}`,
      referrer_id: "current_user",
      referee_id: `referee_${Date.now()}`,
      referee_name: refereeName,
      referee_email: refereeEmail,
      status: "pending",
      reward_amount: settings.reward_per_referral,
      created_at: Date.now(),
    };
    
    rewards.push(reward);
    
    await AsyncStorage.setItem(REFERRAL_REWARDS_STORAGE_KEY, JSON.stringify(rewards));
    
    // Update settings
    settings.total_referrals++;
    settings.pending_rewards += settings.reward_per_referral;
    
    await AsyncStorage.setItem(REFERRAL_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    
    return reward;
  } catch (error) {
    console.error("Failed to create referral reward:", error);
    throw error;
  }
}

/**
 * Complete referral reward
 */
export async function completeReferralReward(rewardId: string): Promise<boolean> {
  try {
    const rewards = await getReferralRewards();
    const reward = rewards.find((r) => r.id === rewardId);
    
    if (!reward || reward.status !== "pending") return false;
    
    reward.status = "completed";
    reward.completed_at = Date.now();
    
    await AsyncStorage.setItem(REFERRAL_REWARDS_STORAGE_KEY, JSON.stringify(rewards));
    
    // Update settings
    const settings = await getReferralSettings();
    settings.total_earned += reward.reward_amount;
    settings.pending_rewards -= reward.reward_amount;
    
    await AsyncStorage.setItem(REFERRAL_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    
    return true;
  } catch (error) {
    console.error("Failed to complete referral reward:", error);
    return false;
  }
}

/**
 * Send referral invite via SMS
 */
export async function sendReferralViaSMS(phoneNumber: string): Promise<boolean> {
  try {
    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) {
      throw new Error("SMS is not available on this device");
    }
    
    const settings = await getReferralSettings();
    
    const message = `Join me on this amazing fintech app! Use my referral code ${settings.referral_code} and we both get $${settings.reward_per_referral}! Download now: https://app.example.com/ref/${settings.referral_code}`;
    
    const { result } = await SMS.sendSMSAsync([phoneNumber], message);
    
    if (result === "sent") {
      await logReferralInvite("sms", phoneNumber);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error("Failed to send referral via SMS:", error);
    throw error;
  }
}

/**
 * Send referral invite via Email
 */
export async function sendReferralViaEmail(email: string): Promise<boolean> {
  try {
    const isAvailable = await MailComposer.isAvailableAsync();
    if (!isAvailable) {
      throw new Error("Email is not available on this device");
    }
    
    const settings = await getReferralSettings();
    
    const subject = "Join me on this amazing fintech app!";
    const body = `Hi there!\n\nI've been using this incredible fintech app and thought you might like it too. Use my referral code ${settings.referral_code} when you sign up, and we'll both get $${settings.reward_per_referral}!\n\nDownload the app here: https://app.example.com/ref/${settings.referral_code}\n\nLooking forward to having you on board!`;
    
    const { status } = await MailComposer.composeAsync({
      recipients: [email],
      subject,
      body,
    });
    
    if (status === "sent") {
      await logReferralInvite("email", email);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error("Failed to send referral via email:", error);
    throw error;
  }
}

/**
 * Log referral invite
 */
async function logReferralInvite(method: "sms" | "email", recipient: string): Promise<void> {
  try {
    const invitesJson = await AsyncStorage.getItem(REFERRAL_INVITES_STORAGE_KEY);
    const invites = invitesJson ? JSON.parse(invitesJson) : [];
    
    invites.push({
      method,
      recipient,
      timestamp: Date.now(),
    });
    
    // Keep only last 100 invites
    if (invites.length > 100) {
      invites.splice(0, invites.length - 100);
    }
    
    await AsyncStorage.setItem(REFERRAL_INVITES_STORAGE_KEY, JSON.stringify(invites));
  } catch (error) {
    console.error("Failed to log referral invite:", error);
  }
}

/**
 * Get referral invite history
 */
export async function getReferralInviteHistory(): Promise<
  Array<{ method: string; recipient: string; timestamp: number }>
> {
  try {
    const invitesJson = await AsyncStorage.getItem(REFERRAL_INVITES_STORAGE_KEY);
    if (!invitesJson) return [];
    
    const invites = JSON.parse(invitesJson);
    invites.sort((a: any, b: any) => b.timestamp - a.timestamp);
    
    return invites;
  } catch (error) {
    console.error("Failed to get referral invite history:", error);
    return [];
  }
}

/**
 * Get referral statistics
 */
export async function getReferralStatistics(): Promise<{
  total_referrals: number;
  pending_referrals: number;
  completed_referrals: number;
  total_earned: number;
  pending_rewards: number;
  conversion_rate: number;
  total_invites_sent: number;
}> {
  try {
    const [settings, rewards, invites] = await Promise.all([
      getReferralSettings(),
      getReferralRewards(),
      getReferralInviteHistory(),
    ]);
    
    const pendingReferrals = rewards.filter((r) => r.status === "pending").length;
    const completedReferrals = rewards.filter((r) => r.status === "completed").length;
    
    const conversionRate =
      invites.length > 0 ? (completedReferrals / invites.length) * 100 : 0;
    
    return {
      total_referrals: settings.total_referrals,
      pending_referrals: pendingReferrals,
      completed_referrals: completedReferrals,
      total_earned: settings.total_earned,
      pending_rewards: settings.pending_rewards,
      conversion_rate: conversionRate,
      total_invites_sent: invites.length,
    };
  } catch (error) {
    console.error("Failed to get referral statistics:", error);
    return {
      total_referrals: 0,
      pending_referrals: 0,
      completed_referrals: 0,
      total_earned: 0,
      pending_rewards: 0,
      conversion_rate: 0,
      total_invites_sent: 0,
    };
  }
}

/**
 * Redeem rewards
 */
export async function redeemRewards(amount: number): Promise<boolean> {
  try {
    const settings = await getReferralSettings();
    
    if (amount > settings.total_earned) {
      throw new Error("Insufficient rewards balance");
    }
    
    if (amount < 5) {
      throw new Error("Minimum redemption amount is $5");
    }
    
    // In production, process redemption via API
    // For now, just update local balance
    settings.total_earned -= amount;
    
    await AsyncStorage.setItem(REFERRAL_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    
    return true;
  } catch (error) {
    console.error("Failed to redeem rewards:", error);
    throw error;
  }
}

/**
 * Get pending rewards
 */
export async function getPendingRewards(): Promise<ReferralReward[]> {
  const rewards = await getReferralRewards();
  return rewards.filter((r) => r.status === "pending");
}

/**
 * Get completed rewards
 */
export async function getCompletedRewards(): Promise<ReferralReward[]> {
  const rewards = await getReferralRewards();
  return rewards.filter((r) => r.status === "completed");
}

/**
 * Get referral link
 */
export async function getReferralLink(): Promise<string> {
  const settings = await getReferralSettings();
  return `https://app.example.com/ref/${settings.referral_code}`;
}

/**
 * Share referral code
 */
export function getShareMessage(referralCode: string, rewardAmount: number): string {
  return `Join me on this amazing fintech app! Use my referral code ${referralCode} and we both get $${rewardAmount}! Download now: https://app.example.com/ref/${referralCode}`;
}

/**
 * Validate referral code format
 */
export function isValidReferralCode(code: string): boolean {
  return /^[A-Z0-9]{8}$/.test(code);
}

/**
 * Clear all referral data
 */
export async function clearReferralData(): Promise<boolean> {
  try {
    await Promise.all([
      AsyncStorage.removeItem(REFERRAL_SETTINGS_STORAGE_KEY),
      AsyncStorage.removeItem(REFERRAL_REWARDS_STORAGE_KEY),
      AsyncStorage.removeItem(REFERRAL_INVITES_STORAGE_KEY),
    ]);
    return true;
  } catch (error) {
    console.error("Failed to clear referral data:", error);
    return false;
  }
}
