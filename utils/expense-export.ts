import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";

export type ExportFormat = "csv" | "excel";

export interface ExportOptions {
  format: ExportFormat;
  startDate?: Date;
  endDate?: Date;
  categories?: string[];
  includeIncome?: boolean;
  includeExpenses?: boolean;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  account?: string;
  notes?: string;
}

const TRANSACTIONS_KEY = "@transactions";

/**
 * Get all transactions from storage
 */
export async function getAllTransactions(): Promise<Transaction[]> {
  try {
    const data = await AsyncStorage.getItem(TRANSACTIONS_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error("Failed to get transactions:", error);
    return [];
  }
}

/**
 * Filter transactions based on export options
 */
export function filterTransactions(
  transactions: Transaction[],
  options: ExportOptions
): Transaction[] {
  let filtered = [...transactions];

  // Filter by date range
  if (options.startDate) {
    const startTime = options.startDate.getTime();
    filtered = filtered.filter((t) => new Date(t.date).getTime() >= startTime);
  }

  if (options.endDate) {
    const endTime = options.endDate.getTime();
    filtered = filtered.filter((t) => new Date(t.date).getTime() <= endTime);
  }

  // Filter by categories
  if (options.categories && options.categories.length > 0) {
    filtered = filtered.filter((t) => options.categories!.includes(t.category));
  }

  // Filter by type
  if (!options.includeIncome) {
    filtered = filtered.filter((t) => t.type !== "income");
  }

  if (!options.includeExpenses) {
    filtered = filtered.filter((t) => t.type !== "expense");
  }

  return filtered;
}

/**
 * Generate CSV content from transactions
 */
export function generateCSV(transactions: Transaction[]): string {
  const headers = ["Date", "Description", "Amount", "Type", "Category", "Account", "Notes"];
  const csvRows = [headers.join(",")];

  transactions.forEach((transaction) => {
    const row = [
      formatDate(new Date(transaction.date)),
      escapeCSV(transaction.description),
      transaction.amount.toFixed(2),
      transaction.type,
      escapeCSV(transaction.category),
      escapeCSV(transaction.account || ""),
      escapeCSV(transaction.notes || ""),
    ];
    csvRows.push(row.join(","));
  });

  // Add summary
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const netAmount = totalIncome - totalExpenses;

  csvRows.push("");
  csvRows.push("Summary");
  csvRows.push(`Total Income,${totalIncome.toFixed(2)}`);
  csvRows.push(`Total Expenses,${totalExpenses.toFixed(2)}`);
  csvRows.push(`Net Amount,${netAmount.toFixed(2)}`);

  return csvRows.join("\n");
}

/**
 * Generate Excel-compatible CSV content (with UTF-8 BOM)
 */
export function generateExcel(transactions: Transaction[]): string {
  // Add UTF-8 BOM for Excel compatibility
  const bom = "\uFEFF";
  return bom + generateCSV(transactions);
}

/**
 * Export transactions to file
 */
export async function exportTransactions(
  options: ExportOptions
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    // Get and filter transactions
    const allTransactions = await getAllTransactions();
    const filtered = filterTransactions(allTransactions, options);

    if (filtered.length === 0) {
      return {
        success: false,
        error: "No transactions found matching the selected criteria",
      };
    }

    // Generate content based on format
    const content =
      options.format === "excel"
        ? generateExcel(filtered)
        : generateCSV(filtered);

    // Create filename
    const timestamp = new Date().toISOString().split("T")[0];
    const extension = options.format === "excel" ? "csv" : "csv";
    const filename = `transactions_${timestamp}.${extension}`;
    const filePath = `${FileSystem.documentDirectory}${filename}`;

    // Write file
    await FileSystem.writeAsStringAsync(filePath, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return {
      success: true,
      filePath,
    };
  } catch (error) {
    console.error("Export failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Export failed",
    };
  }
}

/**
 * Share exported file
 */
export async function shareExportedFile(filePath: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      return {
        success: false,
        error: "Sharing is not available on this device",
      };
    }

    await Sharing.shareAsync(filePath, {
      mimeType: "text/csv",
      dialogTitle: "Share Transactions",
    });

    return { success: true };
  } catch (error) {
    console.error("Share failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Share failed",
    };
  }
}

/**
 * Get export statistics
 */
export async function getExportStatistics(
  options: ExportOptions
): Promise<{
  totalTransactions: number;
  totalIncome: number;
  totalExpenses: number;
  netAmount: number;
  dateRange: string;
}> {
  const allTransactions = await getAllTransactions();
  const filtered = filterTransactions(allTransactions, options);

  const totalIncome = filtered
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = filtered
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const netAmount = totalIncome - totalExpenses;

  let dateRange = "All time";
  if (options.startDate && options.endDate) {
    dateRange = `${formatDate(options.startDate)} - ${formatDate(options.endDate)}`;
  } else if (options.startDate) {
    dateRange = `From ${formatDate(options.startDate)}`;
  } else if (options.endDate) {
    dateRange = `Until ${formatDate(options.endDate)}`;
  }

  return {
    totalTransactions: filtered.length,
    totalIncome,
    totalExpenses,
    netAmount,
    dateRange,
  };
}

/**
 * Get available categories from transactions
 */
export async function getAvailableCategories(): Promise<string[]> {
  const transactions = await getAllTransactions();
  const categories = new Set<string>();
  
  transactions.forEach((t) => {
    if (t.category) {
      categories.add(t.category);
    }
  });

  return Array.from(categories).sort();
}

/**
 * Helper: Escape CSV field
 */
function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Helper: Format date
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Helper: Format currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

/**
 * Get default export options
 */
export function getDefaultExportOptions(): ExportOptions {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  return {
    format: "csv",
    startDate: startOfMonth,
    endDate: now,
    categories: [],
    includeIncome: true,
    includeExpenses: true,
  };
}
