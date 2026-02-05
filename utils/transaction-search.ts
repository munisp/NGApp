import AsyncStorage from "@react-native-async-storage/async-storage";

export interface TransactionFilters {
  search_query?: string;
  date_from?: number;
  date_to?: number;
  amount_min?: number;
  amount_max?: number;
  categories?: string[];
  types?: ("income" | "expense")[];
  status?: ("completed" | "pending" | "failed")[];
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: number;
  status: "completed" | "pending" | "failed";
  merchant?: string;
  account?: string;
}

const SEARCH_HISTORY_STORAGE_KEY = "transaction_search_history";
const FILTER_PRESETS_STORAGE_KEY = "transaction_filter_presets";

/**
 * Search transactions with filters
 */
export function searchTransactions(
  transactions: Transaction[],
  filters: TransactionFilters
): Transaction[] {
  let results = [...transactions];
  
  // Text search
  if (filters.search_query && filters.search_query.trim()) {
    const query = filters.search_query.toLowerCase().trim();
    results = results.filter(
      (tx) =>
        tx.description.toLowerCase().includes(query) ||
        tx.merchant?.toLowerCase().includes(query) ||
        tx.category.toLowerCase().includes(query)
    );
  }
  
  // Date range filter
  if (filters.date_from) {
    results = results.filter((tx) => tx.date >= filters.date_from!);
  }
  
  if (filters.date_to) {
    results = results.filter((tx) => tx.date <= filters.date_to!);
  }
  
  // Amount range filter
  if (filters.amount_min !== undefined) {
    results = results.filter((tx) => Math.abs(tx.amount) >= filters.amount_min!);
  }
  
  if (filters.amount_max !== undefined) {
    results = results.filter((tx) => Math.abs(tx.amount) <= filters.amount_max!);
  }
  
  // Category filter
  if (filters.categories && filters.categories.length > 0) {
    results = results.filter((tx) => filters.categories!.includes(tx.category));
  }
  
  // Type filter
  if (filters.types && filters.types.length > 0) {
    results = results.filter((tx) => filters.types!.includes(tx.type));
  }
  
  // Status filter
  if (filters.status && filters.status.length > 0) {
    results = results.filter((tx) => filters.status!.includes(tx.status));
  }
  
  return results;
}

/**
 * Get search suggestions based on history
 */
export async function getSearchSuggestions(
  query: string,
  limit: number = 5
): Promise<string[]> {
  try {
    const historyJson = await AsyncStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
    if (!historyJson) return [];
    
    const history: string[] = JSON.parse(historyJson);
    
    if (!query.trim()) {
      return history.slice(0, limit);
    }
    
    const queryLower = query.toLowerCase();
    const suggestions = history.filter((item) =>
      item.toLowerCase().includes(queryLower)
    );
    
    return suggestions.slice(0, limit);
  } catch (error) {
    console.error("Failed to get search suggestions:", error);
    return [];
  }
}

/**
 * Save search query to history
 */
export async function saveSearchQuery(query: string): Promise<boolean> {
  try {
    if (!query.trim()) return false;
    
    const historyJson = await AsyncStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
    const history: string[] = historyJson ? JSON.parse(historyJson) : [];
    
    // Remove duplicate
    const filtered = history.filter((item) => item !== query);
    
    // Add to beginning
    filtered.unshift(query);
    
    // Keep only last 50
    if (filtered.length > 50) {
      filtered.splice(50);
    }
    
    await AsyncStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(filtered));
    
    return true;
  } catch (error) {
    console.error("Failed to save search query:", error);
    return false;
  }
}

/**
 * Clear search history
 */
export async function clearSearchHistory(): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(SEARCH_HISTORY_STORAGE_KEY);
    return true;
  } catch (error) {
    console.error("Failed to clear search history:", error);
    return false;
  }
}

/**
 * Get filter presets
 */
export async function getFilterPresets(): Promise<
  Array<{ name: string; filters: TransactionFilters }>
> {
  try {
    const presetsJson = await AsyncStorage.getItem(FILTER_PRESETS_STORAGE_KEY);
    if (!presetsJson) {
      // Return default presets
      return [
        {
          name: "Last 7 Days",
          filters: {
            date_from: Date.now() - 7 * 24 * 60 * 60 * 1000,
            date_to: Date.now(),
          },
        },
        {
          name: "Last 30 Days",
          filters: {
            date_from: Date.now() - 30 * 24 * 60 * 60 * 1000,
            date_to: Date.now(),
          },
        },
        {
          name: "This Month",
          filters: {
            date_from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime(),
            date_to: Date.now(),
          },
        },
        {
          name: "Expenses Only",
          filters: {
            types: ["expense"],
          },
        },
        {
          name: "Income Only",
          filters: {
            types: ["income"],
          },
        },
        {
          name: "Large Transactions",
          filters: {
            amount_min: 500,
          },
        },
      ];
    }
    return JSON.parse(presetsJson);
  } catch (error) {
    console.error("Failed to get filter presets:", error);
    return [];
  }
}

/**
 * Save filter preset
 */
export async function saveFilterPreset(
  name: string,
  filters: TransactionFilters
): Promise<boolean> {
  try {
    const presets = await getFilterPresets();
    
    // Remove existing preset with same name
    const filtered = presets.filter((p) => p.name !== name);
    
    // Add new preset
    filtered.push({ name, filters });
    
    await AsyncStorage.setItem(FILTER_PRESETS_STORAGE_KEY, JSON.stringify(filtered));
    
    return true;
  } catch (error) {
    console.error("Failed to save filter preset:", error);
    return false;
  }
}

/**
 * Delete filter preset
 */
export async function deleteFilterPreset(name: string): Promise<boolean> {
  try {
    const presets = await getFilterPresets();
    const filtered = presets.filter((p) => p.name !== name);
    
    await AsyncStorage.setItem(FILTER_PRESETS_STORAGE_KEY, JSON.stringify(filtered));
    
    return true;
  } catch (error) {
    console.error("Failed to delete filter preset:", error);
    return false;
  }
}

/**
 * Get transaction statistics from filtered results
 */
export function getTransactionStatistics(transactions: Transaction[]): {
  total_count: number;
  total_income: number;
  total_expenses: number;
  net_amount: number;
  avg_transaction: number;
  largest_transaction: number;
  smallest_transaction: number;
  by_category: Record<string, { count: number; amount: number }>;
  by_type: Record<string, { count: number; amount: number }>;
} {
  const stats = {
    total_count: transactions.length,
    total_income: 0,
    total_expenses: 0,
    net_amount: 0,
    avg_transaction: 0,
    largest_transaction: 0,
    smallest_transaction: 0,
    by_category: {} as Record<string, { count: number; amount: number }>,
    by_type: {} as Record<string, { count: number; amount: number }>,
  };
  
  if (transactions.length === 0) return stats;
  
  let totalAmount = 0;
  let largestAbs = 0;
  let smallestAbs = Infinity;
  
  for (const tx of transactions) {
    const absAmount = Math.abs(tx.amount);
    
    // Income/Expenses
    if (tx.type === "income") {
      stats.total_income += absAmount;
    } else {
      stats.total_expenses += absAmount;
    }
    
    totalAmount += absAmount;
    
    // Largest/Smallest
    if (absAmount > largestAbs) {
      largestAbs = absAmount;
      stats.largest_transaction = tx.amount;
    }
    
    if (absAmount < smallestAbs) {
      smallestAbs = absAmount;
      stats.smallest_transaction = tx.amount;
    }
    
    // By category
    if (!stats.by_category[tx.category]) {
      stats.by_category[tx.category] = { count: 0, amount: 0 };
    }
    stats.by_category[tx.category].count++;
    stats.by_category[tx.category].amount += absAmount;
    
    // By type
    if (!stats.by_type[tx.type]) {
      stats.by_type[tx.type] = { count: 0, amount: 0 };
    }
    stats.by_type[tx.type].count++;
    stats.by_type[tx.type].amount += absAmount;
  }
  
  stats.net_amount = stats.total_income - stats.total_expenses;
  stats.avg_transaction = totalAmount / transactions.length;
  
  return stats;
}

/**
 * Export filtered transactions to CSV
 */
export function exportTransactionsToCSV(transactions: Transaction[]): string {
  const headers = ["Date", "Description", "Category", "Type", "Amount", "Status"];
  const rows = transactions.map((tx) => [
    new Date(tx.date).toLocaleDateString(),
    tx.description,
    tx.category,
    tx.type,
    tx.amount.toFixed(2),
    tx.status,
  ]);
  
  const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
  
  return csv;
}

/**
 * Get active filters count
 */
export function getActiveFiltersCount(filters: TransactionFilters): number {
  let count = 0;
  
  if (filters.search_query && filters.search_query.trim()) count++;
  if (filters.date_from || filters.date_to) count++;
  if (filters.amount_min !== undefined || filters.amount_max !== undefined) count++;
  if (filters.categories && filters.categories.length > 0) count++;
  if (filters.types && filters.types.length > 0) count++;
  if (filters.status && filters.status.length > 0) count++;
  
  return count;
}

/**
 * Clear all filters
 */
export function clearAllFilters(): TransactionFilters {
  return {};
}

/**
 * Format filter summary for display
 */
export function formatFilterSummary(filters: TransactionFilters): string {
  const parts: string[] = [];
  
  if (filters.search_query) {
    parts.push(`Search: "${filters.search_query}"`);
  }
  
  if (filters.date_from || filters.date_to) {
    if (filters.date_from && filters.date_to) {
      parts.push(
        `${new Date(filters.date_from).toLocaleDateString()} - ${new Date(
          filters.date_to
        ).toLocaleDateString()}`
      );
    } else if (filters.date_from) {
      parts.push(`From ${new Date(filters.date_from).toLocaleDateString()}`);
    } else if (filters.date_to) {
      parts.push(`Until ${new Date(filters.date_to).toLocaleDateString()}`);
    }
  }
  
  if (filters.amount_min !== undefined || filters.amount_max !== undefined) {
    if (filters.amount_min !== undefined && filters.amount_max !== undefined) {
      parts.push(`$${filters.amount_min} - $${filters.amount_max}`);
    } else if (filters.amount_min !== undefined) {
      parts.push(`≥ $${filters.amount_min}`);
    } else if (filters.amount_max !== undefined) {
      parts.push(`≤ $${filters.amount_max}`);
    }
  }
  
  if (filters.categories && filters.categories.length > 0) {
    parts.push(`Categories: ${filters.categories.join(", ")}`);
  }
  
  if (filters.types && filters.types.length > 0) {
    parts.push(`Type: ${filters.types.join(", ")}`);
  }
  
  if (filters.status && filters.status.length > 0) {
    parts.push(`Status: ${filters.status.join(", ")}`);
  }
  
  return parts.join(" • ");
}
