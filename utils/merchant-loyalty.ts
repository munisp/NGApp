import AsyncStorage from "@react-native-async-storage/async-storage";

export interface LoyaltyMerchant {
  id: string;
  name: string;
  category: string;
  logo: string;
  basePoints: number; // Points per dollar spent
  bonusMultiplier: number; // Current bonus multiplier (e.g., 2x, 3x)
  tier: "bronze" | "silver" | "gold" | "platinum";
  description: string;
  location: string;
}

export interface LoyaltyTransaction {
  id: string;
  merchantId: string;
  merchantName: string;
  amount: number;
  pointsEarned: number;
  date: number;
  category: string;
}

export interface LoyaltyReward {
  id: string;
  merchantId: string;
  merchantName: string;
  title: string;
  description: string;
  pointsCost: number;
  value: number;
  expiryDate?: number;
  redeemed: boolean;
  redeemedDate?: number;
}

export interface UserLoyaltyProfile {
  totalPoints: number;
  lifetimePoints: number;
  tier: "bronze" | "silver" | "gold" | "platinum";
  merchantPoints: Record<string, number>; // Points per merchant
  transactionCount: number;
  totalSpent: number;
}

const MERCHANTS_KEY = "@loyalty_merchants";
const TRANSACTIONS_KEY = "@loyalty_transactions";
const REWARDS_KEY = "@loyalty_rewards";
const PROFILE_KEY = "@loyalty_profile";

// Sample merchants
const DEFAULT_MERCHANTS: LoyaltyMerchant[] = [
  {
    id: "m1",
    name: "ShopRite",
    category: "Grocery",
    logo: "🛒",
    basePoints: 2,
    bonusMultiplier: 2,
    tier: "gold",
    description: "Earn 2x points on all grocery purchases this month",
    location: "Lagos, Nigeria",
  },
  {
    id: "m2",
    name: "Chicken Republic",
    category: "Restaurant",
    logo: "🍗",
    basePoints: 3,
    bonusMultiplier: 1,
    tier: "silver",
    description: "Fast food favorite with great rewards",
    location: "Multiple locations",
  },
  {
    id: "m3",
    name: "Silverbird Cinemas",
    category: "Entertainment",
    logo: "🎬",
    basePoints: 5,
    bonusMultiplier: 3,
    tier: "platinum",
    description: "Triple points on movie tickets this weekend!",
    location: "Accra, Ghana",
  },
  {
    id: "m4",
    name: "Jumia",
    category: "E-commerce",
    logo: "📦",
    basePoints: 1,
    bonusMultiplier: 1,
    tier: "bronze",
    description: "Online shopping rewards",
    location: "Online",
  },
  {
    id: "m5",
    name: "Total Energies",
    category: "Fuel",
    logo: "⛽",
    basePoints: 2,
    bonusMultiplier: 1,
    tier: "silver",
    description: "Earn points on every fuel purchase",
    location: "Nairobi, Kenya",
  },
  {
    id: "m6",
    name: "Woolworths",
    category: "Retail",
    logo: "🏪",
    basePoints: 2,
    bonusMultiplier: 1,
    tier: "gold",
    description: "Premium retail rewards",
    location: "Johannesburg, South Africa",
  },
];

export async function getMerchants(): Promise<LoyaltyMerchant[]> {
  const data = await AsyncStorage.getItem(MERCHANTS_KEY);
  if (!data) {
    await AsyncStorage.setItem(MERCHANTS_KEY, JSON.stringify(DEFAULT_MERCHANTS));
    return DEFAULT_MERCHANTS;
  }
  return JSON.parse(data);
}

export async function getMerchant(id: string): Promise<LoyaltyMerchant | null> {
  const merchants = await getMerchants();
  return merchants.find((m) => m.id === id) || null;
}

export async function getLoyaltyTransactions(): Promise<LoyaltyTransaction[]> {
  const data = await AsyncStorage.getItem(TRANSACTIONS_KEY);
  if (!data) return [];
  return JSON.parse(data).sort((a: LoyaltyTransaction, b: LoyaltyTransaction) => b.date - a.date);
}

export async function addLoyaltyTransaction(
  merchantId: string,
  amount: number
): Promise<LoyaltyTransaction> {
  const merchant = await getMerchant(merchantId);
  if (!merchant) throw new Error("Merchant not found");

  const pointsEarned = Math.floor(amount * merchant.basePoints * merchant.bonusMultiplier);

  const transaction: LoyaltyTransaction = {
    id: Date.now().toString(),
    merchantId,
    merchantName: merchant.name,
    amount,
    pointsEarned,
    date: Date.now(),
    category: merchant.category,
  };

  const transactions = await getLoyaltyTransactions();
  transactions.unshift(transaction);
  await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));

  // Update profile
  await updateProfileAfterTransaction(transaction);

  return transaction;
}

async function updateProfileAfterTransaction(transaction: LoyaltyTransaction): Promise<void> {
  const profile = await getUserProfile();

  profile.totalPoints += transaction.pointsEarned;
  profile.lifetimePoints += transaction.pointsEarned;
  profile.transactionCount += 1;
  profile.totalSpent += transaction.amount;

  if (!profile.merchantPoints[transaction.merchantId]) {
    profile.merchantPoints[transaction.merchantId] = 0;
  }
  profile.merchantPoints[transaction.merchantId] += transaction.pointsEarned;

  // Update tier based on lifetime points
  if (profile.lifetimePoints >= 10000) {
    profile.tier = "platinum";
  } else if (profile.lifetimePoints >= 5000) {
    profile.tier = "gold";
  } else if (profile.lifetimePoints >= 2000) {
    profile.tier = "silver";
  } else {
    profile.tier = "bronze";
  }

  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export async function getUserProfile(): Promise<UserLoyaltyProfile> {
  const data = await AsyncStorage.getItem(PROFILE_KEY);
  if (!data) {
    const defaultProfile: UserLoyaltyProfile = {
      totalPoints: 0,
      lifetimePoints: 0,
      tier: "bronze",
      merchantPoints: {},
      transactionCount: 0,
      totalSpent: 0,
    };
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(defaultProfile));
    return defaultProfile;
  }
  return JSON.parse(data);
}

export async function getRewards(): Promise<LoyaltyReward[]> {
  const data = await AsyncStorage.getItem(REWARDS_KEY);
  if (!data) {
    // Generate default rewards
    const merchants = await getMerchants();
    const defaultRewards: LoyaltyReward[] = merchants.flatMap((merchant) => [
      {
        id: `${merchant.id}_r1`,
        merchantId: merchant.id,
        merchantName: merchant.name,
        title: `$5 Off at ${merchant.name}`,
        description: "Get $5 off your next purchase",
        pointsCost: 500,
        value: 5,
        redeemed: false,
      },
      {
        id: `${merchant.id}_r2`,
        merchantId: merchant.id,
        merchantName: merchant.name,
        title: `$10 Off at ${merchant.name}`,
        description: "Get $10 off your next purchase",
        pointsCost: 1000,
        value: 10,
        redeemed: false,
      },
      {
        id: `${merchant.id}_r3`,
        merchantId: merchant.id,
        merchantName: merchant.name,
        title: `$25 Off at ${merchant.name}`,
        description: "Get $25 off your next purchase",
        pointsCost: 2500,
        value: 25,
        redeemed: false,
      },
    ]);
    await AsyncStorage.setItem(REWARDS_KEY, JSON.stringify(defaultRewards));
    return defaultRewards;
  }
  return JSON.parse(data);
}

export async function redeemReward(rewardId: string): Promise<boolean> {
  const rewards = await getRewards();
  const reward = rewards.find((r) => r.id === rewardId);

  if (!reward) throw new Error("Reward not found");
  if (reward.redeemed) throw new Error("Reward already redeemed");

  const profile = await getUserProfile();

  if (profile.totalPoints < reward.pointsCost) {
    throw new Error("Insufficient points");
  }

  // Deduct points
  profile.totalPoints -= reward.pointsCost;
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));

  // Mark reward as redeemed
  reward.redeemed = true;
  reward.redeemedDate = Date.now();
  await AsyncStorage.setItem(REWARDS_KEY, JSON.stringify(rewards));

  return true;
}

export function getTierBenefits(tier: "bronze" | "silver" | "gold" | "platinum"): string[] {
  const benefits = {
    bronze: ["Earn base points on all purchases", "Access to standard rewards"],
    silver: [
      "Earn base points on all purchases",
      "Access to standard rewards",
      "5% bonus points",
      "Birthday bonus",
    ],
    gold: [
      "Earn base points on all purchases",
      "Access to standard rewards",
      "10% bonus points",
      "Birthday bonus",
      "Exclusive gold rewards",
      "Priority customer support",
    ],
    platinum: [
      "Earn base points on all purchases",
      "Access to standard rewards",
      "20% bonus points",
      "Birthday bonus",
      "Exclusive platinum rewards",
      "Priority customer support",
      "VIP events access",
      "Concierge service",
    ],
  };
  return benefits[tier];
}

export function getNextTierRequirement(currentTier: "bronze" | "silver" | "gold" | "platinum"): {
  nextTier: string;
  pointsRequired: number;
} | null {
  const requirements = {
    bronze: { nextTier: "Silver", pointsRequired: 2000 },
    silver: { nextTier: "Gold", pointsRequired: 5000 },
    gold: { nextTier: "Platinum", pointsRequired: 10000 },
    platinum: null,
  };
  return requirements[currentTier];
}

export async function simulatePurchase(merchantId: string, amount: number): Promise<void> {
  await addLoyaltyTransaction(merchantId, amount);
}
