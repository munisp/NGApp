import AsyncStorage from "@react-native-async-storage/async-storage";

export interface ExpenseCategory {
  id: string;
  name: string;
  icon: string; // Emoji icon
  color: string;
  budget?: number;
  spent?: number;
}

export const DEFAULT_CATEGORIES: ExpenseCategory[] = [
  { id: "food", name: "Food & Dining", icon: "🍔", color: "#FF6B6B" },
  { id: "transport", name: "Transportation", icon: "🚗", color: "#4ECDC4" },
  { id: "shopping", name: "Shopping", icon: "🛍️", color: "#FFE66D" },
  { id: "entertainment", name: "Entertainment", icon: "🎬", color: "#A8E6CF" },
  { id: "bills", name: "Bills & Utilities", icon: "💡", color: "#FF8B94" },
  { id: "healthcare", name: "Healthcare", icon: "⚕️", color: "#95E1D3" },
  { id: "education", name: "Education", icon: "📚", color: "#F38181" },
  { id: "travel", name: "Travel", icon: "✈️", color: "#AA96DA" },
  { id: "groceries", name: "Groceries", icon: "🛒", color: "#FCBAD3" },
  { id: "fitness", name: "Fitness & Sports", icon: "💪", color: "#A8D8EA" },
  { id: "personal", name: "Personal Care", icon: "💅", color: "#FFD3B6" },
  { id: "gifts", name: "Gifts & Donations", icon: "🎁", color: "#FFAAA5" },
  { id: "home", name: "Home & Garden", icon: "🏠", color: "#C7CEEA" },
  { id: "other", name: "Other", icon: "📌", color: "#B5B5B5" },
];

const CATEGORIES_STORAGE_KEY = "expense_categories";
const CATEGORY_BUDGETS_STORAGE_KEY = "category_budgets";
const TRANSACTION_CATEGORIES_STORAGE_KEY = "transaction_categories";

/**
 * Get all expense categories
 */
export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  try {
    const categoriesJson = await AsyncStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (!categoriesJson) {
      // Initialize with default categories
      await AsyncStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(DEFAULT_CATEGORIES));
      return DEFAULT_CATEGORIES;
    }
    return JSON.parse(categoriesJson);
  } catch (error) {
    console.error("Failed to get expense categories:", error);
    return DEFAULT_CATEGORIES;
  }
}

/**
 * Get category by ID
 */
export async function getCategoryById(categoryId: string): Promise<ExpenseCategory | null> {
  const categories = await getExpenseCategories();
  return categories.find((c) => c.id === categoryId) || null;
}

/**
 * Set category budget
 */
export async function setCategoryBudget(
  categoryId: string,
  budget: number
): Promise<boolean> {
  try {
    const budgetsJson = await AsyncStorage.getItem(CATEGORY_BUDGETS_STORAGE_KEY);
    const budgets = budgetsJson ? JSON.parse(budgetsJson) : {};
    
    budgets[categoryId] = budget;
    
    await AsyncStorage.setItem(CATEGORY_BUDGETS_STORAGE_KEY, JSON.stringify(budgets));
    
    return true;
  } catch (error) {
    console.error("Failed to set category budget:", error);
    return false;
  }
}

/**
 * Get category budget
 */
export async function getCategoryBudget(categoryId: string): Promise<number> {
  try {
    const budgetsJson = await AsyncStorage.getItem(CATEGORY_BUDGETS_STORAGE_KEY);
    if (!budgetsJson) return 0;
    
    const budgets = JSON.parse(budgetsJson);
    return budgets[categoryId] || 0;
  } catch (error) {
    console.error("Failed to get category budget:", error);
    return 0;
  }
}

/**
 * Assign category to transaction
 */
export async function assignCategoryToTransaction(
  transactionId: string,
  categoryId: string
): Promise<boolean> {
  try {
    const mappingsJson = await AsyncStorage.getItem(TRANSACTION_CATEGORIES_STORAGE_KEY);
    const mappings = mappingsJson ? JSON.parse(mappingsJson) : {};
    
    mappings[transactionId] = categoryId;
    
    await AsyncStorage.setItem(TRANSACTION_CATEGORIES_STORAGE_KEY, JSON.stringify(mappings));
    
    return true;
  } catch (error) {
    console.error("Failed to assign category to transaction:", error);
    return false;
  }
}

/**
 * Get transaction category
 */
export async function getTransactionCategory(
  transactionId: string
): Promise<string | null> {
  try {
    const mappingsJson = await AsyncStorage.getItem(TRANSACTION_CATEGORIES_STORAGE_KEY);
    if (!mappingsJson) return null;
    
    const mappings = JSON.parse(mappingsJson);
    return mappings[transactionId] || null;
  } catch (error) {
    console.error("Failed to get transaction category:", error);
    return null;
  }
}

/**
 * Get transactions by category
 */
export async function getTransactionsByCategory(
  categoryId: string
): Promise<string[]> {
  try {
    const mappingsJson = await AsyncStorage.getItem(TRANSACTION_CATEGORIES_STORAGE_KEY);
    if (!mappingsJson) return [];
    
    const mappings = JSON.parse(mappingsJson);
    
    return Object.entries(mappings)
      .filter(([_, catId]) => catId === categoryId)
      .map(([txId, _]) => txId);
  } catch (error) {
    console.error("Failed to get transactions by category:", error);
    return [];
  }
}

/**
 * Calculate category spending
 */
export async function calculateCategorySpending(
  categoryId: string,
  transactions: Array<{ id: string; amount: number; type: string }>
): Promise<number> {
  try {
    const categoryTransactionIds = await getTransactionsByCategory(categoryId);
    
    let totalSpent = 0;
    
    for (const tx of transactions) {
      if (categoryTransactionIds.includes(tx.id) && tx.type === "expense") {
        totalSpent += Math.abs(tx.amount);
      }
    }
    
    return totalSpent;
  } catch (error) {
    console.error("Failed to calculate category spending:", error);
    return 0;
  }
}

/**
 * Get category spending analytics
 */
export async function getCategorySpendingAnalytics(
  transactions: Array<{ id: string; amount: number; type: string; timestamp: number }>,
  period: "week" | "month" | "year" = "month"
): Promise<
  Array<{
    category: ExpenseCategory;
    spent: number;
    budget: number;
    percentage: number;
    over_budget: boolean;
  }>
> {
  try {
    const categories = await getExpenseCategories();
    const now = Date.now();
    
    // Calculate period start
    let periodStart = now;
    switch (period) {
      case "week":
        periodStart = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case "month":
        periodStart = now - 30 * 24 * 60 * 60 * 1000;
        break;
      case "year":
        periodStart = now - 365 * 24 * 60 * 60 * 1000;
        break;
    }
    
    // Filter transactions by period
    const periodTransactions = transactions.filter(
      (tx) => tx.timestamp >= periodStart && tx.type === "expense"
    );
    
    const analytics = [];
    
    for (const category of categories) {
      const spent = await calculateCategorySpending(category.id, periodTransactions);
      const budget = await getCategoryBudget(category.id);
      
      const percentage = budget > 0 ? (spent / budget) * 100 : 0;
      const overBudget = budget > 0 && spent > budget;
      
      analytics.push({
        category,
        spent,
        budget,
        percentage,
        over_budget: overBudget,
      });
    }
    
    // Sort by spending (highest first)
    return analytics.sort((a, b) => b.spent - a.spent);
  } catch (error) {
    console.error("Failed to get category spending analytics:", error);
    return [];
  }
}

/**
 * Get top spending categories
 */
export async function getTopSpendingCategories(
  transactions: Array<{ id: string; amount: number; type: string }>,
  limit: number = 5
): Promise<Array<{ category: ExpenseCategory; spent: number }>> {
  try {
    const categories = await getExpenseCategories();
    const spending = [];
    
    for (const category of categories) {
      const spent = await calculateCategorySpending(category.id, transactions);
      if (spent > 0) {
        spending.push({ category, spent });
      }
    }
    
    return spending.sort((a, b) => b.spent - a.spent).slice(0, limit);
  } catch (error) {
    console.error("Failed to get top spending categories:", error);
    return [];
  }
}

/**
 * Get category spending trend
 */
export async function getCategorySpendingTrend(
  categoryId: string,
  transactions: Array<{ id: string; amount: number; type: string; timestamp: number }>,
  months: number = 6
): Promise<Array<{ month: string; spent: number }>> {
  try {
    const trend = [];
    const now = Date.now();
    
    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date(now);
      monthStart.setMonth(monthStart.getMonth() - i);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      
      const monthTransactions = transactions.filter(
        (tx) =>
          tx.timestamp >= monthStart.getTime() &&
          tx.timestamp < monthEnd.getTime() &&
          tx.type === "expense"
      );
      
      const spent = await calculateCategorySpending(categoryId, monthTransactions);
      
      trend.push({
        month: monthStart.toLocaleDateString("en-US", { month: "short" }),
        spent,
      });
    }
    
    return trend;
  } catch (error) {
    console.error("Failed to get category spending trend:", error);
    return [];
  }
}

/**
 * Auto-categorize transaction based on description
 */
export function autoCategorizeTransaction(description: string): string {
  const desc = description.toLowerCase();
  
  // Food & Dining
  if (
    desc.includes("restaurant") ||
    desc.includes("cafe") ||
    desc.includes("food") ||
    desc.includes("pizza") ||
    desc.includes("burger") ||
    desc.includes("starbucks") ||
    desc.includes("mcdonald")
  ) {
    return "food";
  }
  
  // Transportation
  if (
    desc.includes("uber") ||
    desc.includes("lyft") ||
    desc.includes("taxi") ||
    desc.includes("gas") ||
    desc.includes("fuel") ||
    desc.includes("parking") ||
    desc.includes("transport")
  ) {
    return "transport";
  }
  
  // Shopping
  if (
    desc.includes("amazon") ||
    desc.includes("walmart") ||
    desc.includes("target") ||
    desc.includes("shop") ||
    desc.includes("store") ||
    desc.includes("mall")
  ) {
    return "shopping";
  }
  
  // Entertainment
  if (
    desc.includes("netflix") ||
    desc.includes("spotify") ||
    desc.includes("movie") ||
    desc.includes("cinema") ||
    desc.includes("theater") ||
    desc.includes("game")
  ) {
    return "entertainment";
  }
  
  // Bills & Utilities
  if (
    desc.includes("electric") ||
    desc.includes("water") ||
    desc.includes("internet") ||
    desc.includes("phone") ||
    desc.includes("utility") ||
    desc.includes("bill")
  ) {
    return "bills";
  }
  
  // Healthcare
  if (
    desc.includes("hospital") ||
    desc.includes("doctor") ||
    desc.includes("pharmacy") ||
    desc.includes("medical") ||
    desc.includes("health") ||
    desc.includes("clinic")
  ) {
    return "healthcare";
  }
  
  // Groceries
  if (
    desc.includes("grocery") ||
    desc.includes("supermarket") ||
    desc.includes("market") ||
    desc.includes("safeway") ||
    desc.includes("kroger")
  ) {
    return "groceries";
  }
  
  // Fitness
  if (
    desc.includes("gym") ||
    desc.includes("fitness") ||
    desc.includes("sport") ||
    desc.includes("yoga") ||
    desc.includes("exercise")
  ) {
    return "fitness";
  }
  
  // Default to "other"
  return "other";
}

/**
 * Get category statistics
 */
export async function getCategoryStatistics(
  transactions: Array<{ id: string; amount: number; type: string }>
): Promise<{
  total_categories: number;
  categories_with_budget: number;
  categories_over_budget: number;
  total_budgeted: number;
  total_spent: number;
}> {
  try {
    const categories = await getExpenseCategories();
    const budgetsJson = await AsyncStorage.getItem(CATEGORY_BUDGETS_STORAGE_KEY);
    const budgets = budgetsJson ? JSON.parse(budgetsJson) : {};
    
    let categoriesWithBudget = 0;
    let categoriesOverBudget = 0;
    let totalBudgeted = 0;
    let totalSpent = 0;
    
    for (const category of categories) {
      const budget = budgets[category.id] || 0;
      const spent = await calculateCategorySpending(category.id, transactions);
      
      if (budget > 0) {
        categoriesWithBudget++;
        totalBudgeted += budget;
      }
      
      if (budget > 0 && spent > budget) {
        categoriesOverBudget++;
      }
      
      totalSpent += spent;
    }
    
    return {
      total_categories: categories.length,
      categories_with_budget: categoriesWithBudget,
      categories_over_budget: categoriesOverBudget,
      total_budgeted: totalBudgeted,
      total_spent: totalSpent,
    };
  } catch (error) {
    console.error("Failed to get category statistics:", error);
    return {
      total_categories: 0,
      categories_with_budget: 0,
      categories_over_budget: 0,
      total_budgeted: 0,
      total_spent: 0,
    };
  }
}

/**
 * Clear all category data
 */
export async function clearAllCategoryData(): Promise<boolean> {
  try {
    await AsyncStorage.multiRemove([
      CATEGORIES_STORAGE_KEY,
      CATEGORY_BUDGETS_STORAGE_KEY,
      TRANSACTION_CATEGORIES_STORAGE_KEY,
    ]);
    return true;
  } catch (error) {
    console.error("Failed to clear category data:", error);
    return false;
  }
}
