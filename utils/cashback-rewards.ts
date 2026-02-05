import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Merchant {
  id: string;
  name: string;
  category: string;
  logo_url: string;
  base_cashback_rate: number; // percentage
  bonus_rate?: number; // bonus percentage for featured period
  is_featured: boolean;
  description: string;
}

export interface CashbackTransaction {
  id: string;
  merchant_id: string;
  merchant_name: string;
  transaction_id: string;
  amount: number;
  cashback_rate: number;
  cashback_amount: number;
  status: "pending" | "approved" | "paid" | "expired";
  transaction_date: number;
  approved_date?: number;
  paid_date?: number;
  expires_at: number;
}

export interface CashbackBalance {
  total_earned: number;
  pending: number;
  available: number;
  redeemed: number;
  lifetime_earnings: number;
}

export interface BonusCategory {
  id: string;
  name: string;
  icon: string;
  bonus_rate: number;
  start_date: number;
  end_date: number;
  description: string;
}

const MERCHANTS_STORAGE_KEY = "cashback_merchants";
const TRANSACTIONS_STORAGE_KEY = "cashback_transactions";
const BALANCE_STORAGE_KEY = "cashback_balance";
const BONUS_CATEGORIES_STORAGE_KEY = "bonus_categories";

// Mock merchant data
const DEFAULT_MERCHANTS: Merchant[] = [
  {
    id: "merchant_1",
    name: "ShopRite",
    category: "Groceries",
    logo_url: "https://example.com/shoprite.png",
    base_cashback_rate: 2,
    is_featured: false,
    description: "Leading supermarket chain across Africa",
  },
  {
    id: "merchant_2",
    name: "Jumia",
    category: "Online Shopping",
    logo_url: "https://example.com/jumia.png",
    base_cashback_rate: 3,
    bonus_rate: 5,
    is_featured: true,
    description: "Africa's leading online marketplace",
  },
  {
    id: "merchant_3",
    name: "Uber",
    category: "Transportation",
    logo_url: "https://example.com/uber.png",
    base_cashback_rate: 1.5,
    is_featured: false,
    description: "Ride-sharing and food delivery",
  },
  {
    id: "merchant_4",
    name: "Spar",
    category: "Groceries",
    logo_url: "https://example.com/spar.png",
    base_cashback_rate: 2,
    bonus_rate: 4,
    is_featured: true,
    description: "International supermarket chain",
  },
  {
    id: "merchant_5",
    name: "KFC",
    category: "Dining",
    logo_url: "https://example.com/kfc.png",
    base_cashback_rate: 2.5,
    is_featured: false,
    description: "Fast food restaurant",
  },
  {
    id: "merchant_6",
    name: "Woolworths",
    category: "Retail",
    logo_url: "https://example.com/woolworths.png",
    base_cashback_rate: 3,
    is_featured: false,
    description: "Premium retail and food store",
  },
  {
    id: "merchant_7",
    name: "Bolt",
    category: "Transportation",
    logo_url: "https://example.com/bolt.png",
    base_cashback_rate: 1.5,
    is_featured: false,
    description: "Ride-hailing service",
  },
  {
    id: "merchant_8",
    name: "Game",
    category: "Electronics",
    logo_url: "https://example.com/game.png",
    base_cashback_rate: 2,
    is_featured: false,
    description: "Electronics and appliances retailer",
  },
];

/**
 * Get all merchants
 */
export async function getMerchants(): Promise<Merchant[]> {
  try {
    const merchantsJson = await AsyncStorage.getItem(MERCHANTS_STORAGE_KEY);
    if (!merchantsJson) {
      // Initialize with default merchants
      await AsyncStorage.setItem(MERCHANTS_STORAGE_KEY, JSON.stringify(DEFAULT_MERCHANTS));
      return DEFAULT_MERCHANTS;
    }
    return JSON.parse(merchantsJson);
  } catch (error) {
    console.error("Failed to get merchants:", error);
    return DEFAULT_MERCHANTS;
  }
}

/**
 * Get featured merchants
 */
export async function getFeaturedMerchants(): Promise<Merchant[]> {
  const merchants = await getMerchants();
  return merchants.filter((m) => m.is_featured);
}

/**
 * Get merchants by category
 */
export async function getMerchantsByCategory(category: string): Promise<Merchant[]> {
  const merchants = await getMerchants();
  return merchants.filter((m) => m.category === category);
}

/**
 * Get all categories
 */
export async function getCategories(): Promise<string[]> {
  const merchants = await getMerchants();
  const categories = new Set(merchants.map((m) => m.category));
  return Array.from(categories).sort();
}

/**
 * Get cashback transactions
 */
export async function getCashbackTransactions(): Promise<CashbackTransaction[]> {
  try {
    const transactionsJson = await AsyncStorage.getItem(TRANSACTIONS_STORAGE_KEY);
    if (!transactionsJson) return [];
    return JSON.parse(transactionsJson);
  } catch (error) {
    console.error("Failed to get cashback transactions:", error);
    return [];
  }
}

/**
 * Save cashback transactions
 */
async function saveCashbackTransactions(transactions: CashbackTransaction[]): Promise<void> {
  try {
    await AsyncStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(transactions));
  } catch (error) {
    console.error("Failed to save cashback transactions:", error);
    throw error;
  }
}

/**
 * Record cashback transaction
 */
export async function recordCashbackTransaction(
  merchantId: string,
  transactionId: string,
  amount: number
): Promise<CashbackTransaction> {
  const merchants = await getMerchants();
  const merchant = merchants.find((m) => m.id === merchantId);
  
  if (!merchant) {
    throw new Error("Merchant not found");
  }
  
  // Check for bonus categories
  const bonusCategories = await getBonusCategories();
  const activeBonus = bonusCategories.find(
    (b) => b.name === merchant.category && Date.now() >= b.start_date && Date.now() <= b.end_date
  );
  
  // Calculate cashback rate (use bonus if available)
  const cashbackRate = merchant.bonus_rate || (activeBonus ? activeBonus.bonus_rate : merchant.base_cashback_rate);
  const cashbackAmount = (amount * cashbackRate) / 100;
  
  const transaction: CashbackTransaction = {
    id: `cashback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    merchant_id: merchantId,
    merchant_name: merchant.name,
    transaction_id: transactionId,
    amount,
    cashback_rate: cashbackRate,
    cashback_amount: cashbackAmount,
    status: "pending",
    transaction_date: Date.now(),
    expires_at: Date.now() + 90 * 24 * 60 * 60 * 1000, // 90 days
  };
  
  const transactions = await getCashbackTransactions();
  transactions.push(transaction);
  await saveCashbackTransactions(transactions);
  
  // Update balance
  await updateBalance();
  
  return transaction;
}

/**
 * Approve cashback transaction (simulated - would be done by backend)
 */
export async function approveCashbackTransaction(transactionId: string): Promise<boolean> {
  const transactions = await getCashbackTransactions();
  const transaction = transactions.find((t) => t.id === transactionId);
  
  if (!transaction || transaction.status !== "pending") {
    return false;
  }
  
  transaction.status = "approved";
  transaction.approved_date = Date.now();
  
  await saveCashbackTransactions(transactions);
  await updateBalance();
  
  return true;
}

/**
 * Get cashback balance
 */
export async function getCashbackBalance(): Promise<CashbackBalance> {
  try {
    const balanceJson = await AsyncStorage.getItem(BALANCE_STORAGE_KEY);
    if (!balanceJson) {
      const defaultBalance: CashbackBalance = {
        total_earned: 0,
        pending: 0,
        available: 0,
        redeemed: 0,
        lifetime_earnings: 0,
      };
      await AsyncStorage.setItem(BALANCE_STORAGE_KEY, JSON.stringify(defaultBalance));
      return defaultBalance;
    }
    return JSON.parse(balanceJson);
  } catch (error) {
    console.error("Failed to get cashback balance:", error);
    return {
      total_earned: 0,
      pending: 0,
      available: 0,
      redeemed: 0,
      lifetime_earnings: 0,
    };
  }
}

/**
 * Update cashback balance
 */
async function updateBalance(): Promise<void> {
  const transactions = await getCashbackTransactions();
  
  const pending = transactions
    .filter((t) => t.status === "pending")
    .reduce((sum, t) => sum + t.cashback_amount, 0);
  
  const available = transactions
    .filter((t) => t.status === "approved")
    .reduce((sum, t) => sum + t.cashback_amount, 0);
  
  const redeemed = transactions
    .filter((t) => t.status === "paid")
    .reduce((sum, t) => sum + t.cashback_amount, 0);
  
  const lifetimeEarnings = transactions
    .filter((t) => t.status !== "expired")
    .reduce((sum, t) => sum + t.cashback_amount, 0);
  
  const balance: CashbackBalance = {
    total_earned: pending + available + redeemed,
    pending,
    available,
    redeemed,
    lifetime_earnings: lifetimeEarnings,
  };
  
  await AsyncStorage.setItem(BALANCE_STORAGE_KEY, JSON.stringify(balance));
}

/**
 * Redeem cashback
 */
export async function redeemCashback(amount: number): Promise<{ success: boolean; message: string }> {
  const balance = await getCashbackBalance();
  
  if (amount > balance.available) {
    return { success: false, message: "Insufficient available cashback" };
  }
  
  if (amount < 5) {
    return { success: false, message: "Minimum redemption amount is $5" };
  }
  
  const transactions = await getCashbackTransactions();
  
  // Mark approved transactions as paid until we reach the redemption amount
  let remaining = amount;
  for (const transaction of transactions) {
    if (transaction.status === "approved" && remaining > 0) {
      if (transaction.cashback_amount <= remaining) {
        transaction.status = "paid";
        transaction.paid_date = Date.now();
        remaining -= transaction.cashback_amount;
      }
    }
  }
  
  await saveCashbackTransactions(transactions);
  await updateBalance();
  
  return { success: true, message: `Successfully redeemed $${amount.toFixed(2)}` };
}

/**
 * Get bonus categories
 */
export async function getBonusCategories(): Promise<BonusCategory[]> {
  try {
    const bonusJson = await AsyncStorage.getItem(BONUS_CATEGORIES_STORAGE_KEY);
    if (!bonusJson) {
      // Initialize with default bonus categories
      const now = Date.now();
      const defaultBonus: BonusCategory[] = [
        {
          id: "bonus_1",
          name: "Groceries",
          icon: "🛒",
          bonus_rate: 5,
          start_date: now,
          end_date: now + 30 * 24 * 60 * 60 * 1000, // 30 days
          description: "Get 5% cashback on all grocery purchases this month!",
        },
      ];
      await AsyncStorage.setItem(BONUS_CATEGORIES_STORAGE_KEY, JSON.stringify(defaultBonus));
      return defaultBonus;
    }
    return JSON.parse(bonusJson);
  } catch (error) {
    console.error("Failed to get bonus categories:", error);
    return [];
  }
}

/**
 * Get active bonus categories
 */
export async function getActiveBonusCategories(): Promise<BonusCategory[]> {
  const bonusCategories = await getBonusCategories();
  const now = Date.now();
  return bonusCategories.filter((b) => now >= b.start_date && now <= b.end_date);
}

/**
 * Get cashback statistics
 */
export async function getCashbackStatistics(): Promise<{
  total_transactions: number;
  total_merchants: number;
  average_cashback_rate: number;
  best_merchant: { name: string; total_cashback: number } | null;
  monthly_earnings: number;
}> {
  const transactions = await getCashbackTransactions();
  const merchants = await getMerchants();
  
  const totalTransactions = transactions.length;
  const totalMerchants = new Set(transactions.map((t) => t.merchant_id)).size;
  
  const averageCashbackRate = totalTransactions > 0
    ? transactions.reduce((sum, t) => sum + t.cashback_rate, 0) / totalTransactions
    : 0;
  
  // Find best merchant by total cashback
  const merchantCashback = new Map<string, { name: string; total: number }>();
  for (const transaction of transactions) {
    const current = merchantCashback.get(transaction.merchant_id) || {
      name: transaction.merchant_name,
      total: 0,
    };
    current.total += transaction.cashback_amount;
    merchantCashback.set(transaction.merchant_id, current);
  }
  
  let bestMerchant: { name: string; total_cashback: number } | null = null;
  for (const [_, data] of merchantCashback) {
    if (!bestMerchant || data.total > bestMerchant.total_cashback) {
      bestMerchant = { name: data.name, total_cashback: data.total };
    }
  }
  
  // Calculate monthly earnings (last 30 days)
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const monthlyEarnings = transactions
    .filter((t) => t.transaction_date >= thirtyDaysAgo)
    .reduce((sum, t) => sum + t.cashback_amount, 0);
  
  return {
    total_transactions: totalTransactions,
    total_merchants: totalMerchants,
    average_cashback_rate: averageCashbackRate,
    best_merchant: bestMerchant,
    monthly_earnings: monthlyEarnings,
  };
}

/**
 * Get transactions by merchant
 */
export async function getTransactionsByMerchant(merchantId: string): Promise<CashbackTransaction[]> {
  const transactions = await getCashbackTransactions();
  return transactions.filter((t) => t.merchant_id === merchantId).sort((a, b) => b.transaction_date - a.transaction_date);
}

/**
 * Get recent transactions
 */
export async function getRecentTransactions(limit: number = 10): Promise<CashbackTransaction[]> {
  const transactions = await getCashbackTransactions();
  return transactions.sort((a, b) => b.transaction_date - a.transaction_date).slice(0, limit);
}

/**
 * Search merchants
 */
export async function searchMerchants(query: string): Promise<Merchant[]> {
  const merchants = await getMerchants();
  const lowerQuery = query.toLowerCase();
  return merchants.filter(
    (m) =>
      m.name.toLowerCase().includes(lowerQuery) ||
      m.category.toLowerCase().includes(lowerQuery) ||
      m.description.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get effective cashback rate for merchant
 */
export async function getEffectiveCashbackRate(merchantId: string): Promise<number> {
  const merchants = await getMerchants();
  const merchant = merchants.find((m) => m.id === merchantId);
  
  if (!merchant) return 0;
  
  // Check for bonus rate
  if (merchant.bonus_rate) return merchant.bonus_rate;
  
  // Check for bonus categories
  const bonusCategories = await getActiveBonusCategories();
  const activeBonus = bonusCategories.find((b) => b.name === merchant.category);
  
  if (activeBonus) return activeBonus.bonus_rate;
  
  return merchant.base_cashback_rate;
}

/**
 * Simulate purchase with cashback (for demo purposes)
 */
export async function simulatePurchase(merchantId: string, amount: number): Promise<CashbackTransaction> {
  const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const transaction = await recordCashbackTransaction(merchantId, transactionId, amount);
  
  // Auto-approve after 1 second (simulating backend processing)
  setTimeout(async () => {
    await approveCashbackTransaction(transaction.id);
  }, 1000);
  
  return transaction;
}
