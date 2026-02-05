import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Asset {
  id: string;
  name: string;
  type: "cash" | "checking" | "savings" | "investment" | "property" | "vehicle" | "other";
  value: number;
  date: number;
  notes?: string;
}

export interface Liability {
  id: string;
  name: string;
  type: "mortgage" | "auto_loan" | "student_loan" | "credit_card" | "personal_loan" | "other";
  balance: number;
  interestRate: number;
  monthlyPayment: number;
  date: number;
  notes?: string;
}

export interface NetWorthSnapshot {
  date: number;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

const ASSETS_KEY = "net_worth_assets";
const LIABILITIES_KEY = "net_worth_liabilities";
const HISTORY_KEY = "net_worth_history";

/**
 * Save assets
 */
export async function saveAssets(assets: Asset[]): Promise<void> {
  try {
    await AsyncStorage.setItem(ASSETS_KEY, JSON.stringify(assets));
  } catch (error) {
    console.error("Failed to save assets:", error);
    throw error;
  }
}

/**
 * Load assets
 */
export async function loadAssets(): Promise<Asset[]> {
  try {
    const data = await AsyncStorage.getItem(ASSETS_KEY);
    return data ? JSON.parse(data) : getMockAssets();
  } catch (error) {
    console.error("Failed to load assets:", error);
    return getMockAssets();
  }
}

/**
 * Get mock assets for demonstration
 */
function getMockAssets(): Asset[] {
  const now = Date.now();

  return [
    {
      id: "1",
      name: "Checking Account",
      type: "checking",
      value: 5000,
      date: now,
    },
    {
      id: "2",
      name: "Savings Account",
      type: "savings",
      value: 25000,
      date: now,
    },
    {
      id: "3",
      name: "Investment Portfolio",
      type: "investment",
      value: 75000,
      date: now,
    },
    {
      id: "4",
      name: "Primary Residence",
      type: "property",
      value: 350000,
      date: now,
    },
    {
      id: "5",
      name: "Vehicle",
      type: "vehicle",
      value: 25000,
      date: now,
    },
  ];
}

/**
 * Save liabilities
 */
export async function saveLiabilities(liabilities: Liability[]): Promise<void> {
  try {
    await AsyncStorage.setItem(LIABILITIES_KEY, JSON.stringify(liabilities));
  } catch (error) {
    console.error("Failed to save liabilities:", error);
    throw error;
  }
}

/**
 * Load liabilities
 */
export async function loadLiabilities(): Promise<Liability[]> {
  try {
    const data = await AsyncStorage.getItem(LIABILITIES_KEY);
    return data ? JSON.parse(data) : getMockLiabilities();
  } catch (error) {
    console.error("Failed to load liabilities:", error);
    return getMockLiabilities();
  }
}

/**
 * Get mock liabilities for demonstration
 */
function getMockLiabilities(): Liability[] {
  const now = Date.now();

  return [
    {
      id: "1",
      name: "Mortgage",
      type: "mortgage",
      balance: 280000,
      interestRate: 3.5,
      monthlyPayment: 1500,
      date: now,
    },
    {
      id: "2",
      name: "Auto Loan",
      type: "auto_loan",
      balance: 15000,
      interestRate: 4.5,
      monthlyPayment: 450,
      date: now,
    },
    {
      id: "3",
      name: "Credit Card",
      type: "credit_card",
      balance: 3000,
      interestRate: 18.9,
      monthlyPayment: 150,
      date: now,
    },
  ];
}

/**
 * Add or update asset
 */
export async function saveAsset(asset: Asset): Promise<void> {
  try {
    const assets = await loadAssets();
    const index = assets.findIndex((a) => a.id === asset.id);

    if (index >= 0) {
      assets[index] = asset;
    } else {
      assets.push(asset);
    }

    await saveAssets(assets);
    await updateNetWorthHistory();
  } catch (error) {
    console.error("Failed to save asset:", error);
    throw error;
  }
}

/**
 * Delete asset
 */
export async function deleteAsset(assetId: string): Promise<void> {
  try {
    const assets = await loadAssets();
    const filtered = assets.filter((a) => a.id !== assetId);
    await saveAssets(filtered);
    await updateNetWorthHistory();
  } catch (error) {
    console.error("Failed to delete asset:", error);
    throw error;
  }
}

/**
 * Add or update liability
 */
export async function saveLiability(liability: Liability): Promise<void> {
  try {
    const liabilities = await loadLiabilities();
    const index = liabilities.findIndex((l) => l.id === liability.id);

    if (index >= 0) {
      liabilities[index] = liability;
    } else {
      liabilities.push(liability);
    }

    await saveLiabilities(liabilities);
    await updateNetWorthHistory();
  } catch (error) {
    console.error("Failed to save liability:", error);
    throw error;
  }
}

/**
 * Delete liability
 */
export async function deleteLiability(liabilityId: string): Promise<void> {
  try {
    const liabilities = await loadLiabilities();
    const filtered = liabilities.filter((l) => l.id !== liabilityId);
    await saveLiabilities(filtered);
    await updateNetWorthHistory();
  } catch (error) {
    console.error("Failed to delete liability:", error);
    throw error;
  }
}

/**
 * Calculate total assets
 */
export async function calculateTotalAssets(): Promise<number> {
  try {
    const assets = await loadAssets();
    return assets.reduce((sum, asset) => sum + asset.value, 0);
  } catch (error) {
    console.error("Failed to calculate total assets:", error);
    return 0;
  }
}

/**
 * Calculate total liabilities
 */
export async function calculateTotalLiabilities(): Promise<number> {
  try {
    const liabilities = await loadLiabilities();
    return liabilities.reduce((sum, liability) => sum + liability.balance, 0);
  } catch (error) {
    console.error("Failed to calculate total liabilities:", error);
    return 0;
  }
}

/**
 * Calculate net worth
 */
export async function calculateNetWorth(): Promise<number> {
  try {
    const totalAssets = await calculateTotalAssets();
    const totalLiabilities = await calculateTotalLiabilities();
    return totalAssets - totalLiabilities;
  } catch (error) {
    console.error("Failed to calculate net worth:", error);
    return 0;
  }
}

/**
 * Get assets by type
 */
export async function getAssetsByType(type: Asset["type"]): Promise<Asset[]> {
  try {
    const assets = await loadAssets();
    return assets.filter((a) => a.type === type);
  } catch (error) {
    console.error("Failed to get assets by type:", error);
    return [];
  }
}

/**
 * Get liabilities by type
 */
export async function getLiabilitiesByType(type: Liability["type"]): Promise<Liability[]> {
  try {
    const liabilities = await loadLiabilities();
    return liabilities.filter((l) => l.type === type);
  } catch (error) {
    console.error("Failed to get liabilities by type:", error);
    return [];
  }
}

/**
 * Calculate asset allocation
 */
export async function calculateAssetAllocation(): Promise<Record<string, number>> {
  try {
    const assets = await loadAssets();
    const totalAssets = await calculateTotalAssets();
    const allocation: Record<string, number> = {};

    assets.forEach((asset) => {
      const percentage = totalAssets > 0 ? (asset.value / totalAssets) * 100 : 0;
      allocation[asset.type] = (allocation[asset.type] || 0) + percentage;
    });

    return allocation;
  } catch (error) {
    console.error("Failed to calculate asset allocation:", error);
    return {};
  }
}

/**
 * Calculate debt-to-asset ratio
 */
export async function calculateDebtToAssetRatio(): Promise<number> {
  try {
    const totalAssets = await calculateTotalAssets();
    const totalLiabilities = await calculateTotalLiabilities();

    return totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;
  } catch (error) {
    console.error("Failed to calculate debt-to-asset ratio:", error);
    return 0;
  }
}

/**
 * Save net worth history
 */
async function saveHistory(history: NetWorthSnapshot[]): Promise<void> {
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error("Failed to save history:", error);
  }
}

/**
 * Load net worth history
 */
export async function loadHistory(): Promise<NetWorthSnapshot[]> {
  try {
    const data = await AsyncStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : getMockHistory();
  } catch (error) {
    console.error("Failed to load history:", error);
    return getMockHistory();
  }
}

/**
 * Get mock history for demonstration
 */
function getMockHistory(): NetWorthSnapshot[] {
  const now = Date.now();
  const oneMonth = 30 * 24 * 60 * 60 * 1000;

  return [
    {
      date: now - 6 * oneMonth,
      totalAssets: 450000,
      totalLiabilities: 310000,
      netWorth: 140000,
    },
    {
      date: now - 5 * oneMonth,
      totalAssets: 455000,
      totalLiabilities: 307000,
      netWorth: 148000,
    },
    {
      date: now - 4 * oneMonth,
      totalAssets: 460000,
      totalLiabilities: 304000,
      netWorth: 156000,
    },
    {
      date: now - 3 * oneMonth,
      totalAssets: 465000,
      totalLiabilities: 301000,
      netWorth: 164000,
    },
    {
      date: now - 2 * oneMonth,
      totalAssets: 470000,
      totalLiabilities: 298000,
      netWorth: 172000,
    },
    {
      date: now - oneMonth,
      totalAssets: 475000,
      totalLiabilities: 295000,
      netWorth: 180000,
    },
    {
      date: now,
      totalAssets: 480000,
      totalLiabilities: 298000,
      netWorth: 182000,
    },
  ];
}

/**
 * Update net worth history
 */
async function updateNetWorthHistory(): Promise<void> {
  try {
    const history = await loadHistory();
    const totalAssets = await calculateTotalAssets();
    const totalLiabilities = await calculateTotalLiabilities();
    const netWorth = totalAssets - totalLiabilities;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    // Check if there's already an entry for today
    const existingIndex = history.findIndex((snapshot) => {
      const snapshotDate = new Date(snapshot.date);
      snapshotDate.setHours(0, 0, 0, 0);
      return snapshotDate.getTime() === todayTimestamp;
    });

    const newSnapshot: NetWorthSnapshot = {
      date: todayTimestamp,
      totalAssets,
      totalLiabilities,
      netWorth,
    };

    if (existingIndex >= 0) {
      history[existingIndex] = newSnapshot;
    } else {
      history.push(newSnapshot);
    }

    // Keep only last 12 months
    const twelveMonthsAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    const filtered = history.filter((snapshot) => snapshot.date >= twelveMonthsAgo);

    // Sort by date
    filtered.sort((a, b) => a.date - b.date);

    await saveHistory(filtered);
  } catch (error) {
    console.error("Failed to update net worth history:", error);
  }
}

/**
 * Calculate growth rate
 */
export async function calculateGrowthRate(): Promise<number> {
  try {
    const history = await loadHistory();
    if (history.length < 2) return 0;

    const oldest = history[0];
    const newest = history[history.length - 1];

    if (oldest.netWorth === 0) return 0;

    return ((newest.netWorth - oldest.netWorth) / oldest.netWorth) * 100;
  } catch (error) {
    console.error("Failed to calculate growth rate:", error);
    return 0;
  }
}

/**
 * Project future net worth
 */
export async function projectNetWorth(months: number): Promise<number> {
  try {
    const history = await loadHistory();
    if (history.length < 2) {
      const currentNetWorth = await calculateNetWorth();
      return currentNetWorth;
    }

    // Calculate average monthly growth
    const oldest = history[0];
    const newest = history[history.length - 1];
    const monthsElapsed = (newest.date - oldest.date) / (30 * 24 * 60 * 60 * 1000);
    const totalGrowth = newest.netWorth - oldest.netWorth;
    const averageMonthlyGrowth = monthsElapsed > 0 ? totalGrowth / monthsElapsed : 0;

    // Project future value
    const currentNetWorth = await calculateNetWorth();
    return currentNetWorth + averageMonthlyGrowth * months;
  } catch (error) {
    console.error("Failed to project net worth:", error);
    return 0;
  }
}

/**
 * Get asset type icon
 */
export function getAssetTypeIcon(type: Asset["type"]): string {
  const icons: Record<Asset["type"], string> = {
    cash: "💵",
    checking: "🏦",
    savings: "🏦",
    investment: "📈",
    property: "🏠",
    vehicle: "🚗",
    other: "💼",
  };

  return icons[type] || "💼";
}

/**
 * Get asset type label
 */
export function getAssetTypeLabel(type: Asset["type"]): string {
  const labels: Record<Asset["type"], string> = {
    cash: "Cash",
    checking: "Checking Account",
    savings: "Savings Account",
    investment: "Investment",
    property: "Property",
    vehicle: "Vehicle",
    other: "Other",
  };

  return labels[type] || "Other";
}

/**
 * Get liability type icon
 */
export function getLiabilityTypeIcon(type: Liability["type"]): string {
  const icons: Record<Liability["type"], string> = {
    mortgage: "🏠",
    auto_loan: "🚗",
    student_loan: "🎓",
    credit_card: "💳",
    personal_loan: "💰",
    other: "📄",
  };

  return icons[type] || "📄";
}

/**
 * Get liability type label
 */
export function getLiabilityTypeLabel(type: Liability["type"]): string {
  const labels: Record<Liability["type"], string> = {
    mortgage: "Mortgage",
    auto_loan: "Auto Loan",
    student_loan: "Student Loan",
    credit_card: "Credit Card",
    personal_loan: "Personal Loan",
    other: "Other",
  };

  return labels[type] || "Other";
}
