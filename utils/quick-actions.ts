import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";

export interface QuickAction {
  id: string;
  title: string;
  icon: string;
  description: string;
  enabled: boolean;
  requires_biometric: boolean;
}

export const AVAILABLE_QUICK_ACTIONS: QuickAction[] = [
  {
    id: "check_balance",
    title: "Check Balance",
    icon: "💰",
    description: "View your account balance instantly",
    enabled: true,
    requires_biometric: true,
  },
  {
    id: "pay_last_recipient",
    title: "Pay Last Recipient",
    icon: "💸",
    description: "Send money to your most recent recipient",
    enabled: true,
    requires_biometric: true,
  },
  {
    id: "recent_transactions",
    title: "Recent Transactions",
    icon: "📊",
    description: "View your latest transactions",
    enabled: true,
    requires_biometric: false,
  },
  {
    id: "scan_qr",
    title: "Scan QR Code",
    icon: "📷",
    description: "Quickly scan a payment QR code",
    enabled: true,
    requires_biometric: false,
  },
  {
    id: "voice_assistant",
    title: "Voice Assistant",
    icon: "🎤",
    description: "Ask your financial questions",
    enabled: true,
    requires_biometric: false,
  },
];

const QUICK_ACTIONS_STORAGE_KEY = "quick_actions_settings";
const LAST_RECIPIENT_STORAGE_KEY = "last_payment_recipient";
const QUICK_ACTION_HISTORY_STORAGE_KEY = "quick_action_history";

/**
 * Check if biometric authentication is available
 */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) return false;
    
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return enrolled;
  } catch (error) {
    console.error("Failed to check biometric availability:", error);
    return false;
  }
}

/**
 * Authenticate with biometrics
 */
export async function authenticateWithBiometric(
  reason: string = "Authenticate to continue"
): Promise<{ success: boolean; error?: string }> {
  try {
    const available = await isBiometricAvailable();
    
    if (!available) {
      return {
        success: false,
        error: "Biometric authentication not available",
      };
    }
    
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      fallbackLabel: "Use passcode",
      cancelLabel: "Cancel",
    });
    
    if (result.success) {
      return { success: true };
    } else {
      return {
        success: false,
        error: result.error || "Authentication failed",
      };
    }
  } catch (error: any) {
    console.error("Biometric authentication error:", error);
    return {
      success: false,
      error: error.message || "Authentication failed",
    };
  }
}

/**
 * Get quick actions settings
 */
export async function getQuickActionsSettings(): Promise<QuickAction[]> {
  try {
    const settingsJson = await AsyncStorage.getItem(QUICK_ACTIONS_STORAGE_KEY);
    if (!settingsJson) {
      // Initialize with default settings
      await AsyncStorage.setItem(
        QUICK_ACTIONS_STORAGE_KEY,
        JSON.stringify(AVAILABLE_QUICK_ACTIONS)
      );
      return AVAILABLE_QUICK_ACTIONS;
    }
    return JSON.parse(settingsJson);
  } catch (error) {
    console.error("Failed to get quick actions settings:", error);
    return AVAILABLE_QUICK_ACTIONS;
  }
}

/**
 * Update quick action setting
 */
export async function updateQuickActionSetting(
  actionId: string,
  enabled: boolean
): Promise<boolean> {
  try {
    const settings = await getQuickActionsSettings();
    const action = settings.find((a) => a.id === actionId);
    
    if (!action) return false;
    
    action.enabled = enabled;
    
    await AsyncStorage.setItem(QUICK_ACTIONS_STORAGE_KEY, JSON.stringify(settings));
    
    return true;
  } catch (error) {
    console.error("Failed to update quick action setting:", error);
    return false;
  }
}

/**
 * Execute quick action: Check Balance
 */
export async function executeCheckBalance(): Promise<{
  success: boolean;
  balance?: number;
  error?: string;
}> {
  try {
    // Authenticate
    const auth = await authenticateWithBiometric("Authenticate to view balance");
    
    if (!auth.success) {
      return { success: false, error: auth.error };
    }
    
    // In production, fetch from API
    // For now, return mock data
    const mockBalance = 5432.50;
    
    // Log action
    await logQuickAction("check_balance");
    
    return {
      success: true,
      balance: mockBalance,
    };
  } catch (error: any) {
    console.error("Failed to check balance:", error);
    return {
      success: false,
      error: error.message || "Failed to check balance",
    };
  }
}

/**
 * Save last payment recipient
 */
export async function saveLastPaymentRecipient(recipient: {
  name: string;
  account: string;
  amount: number;
}): Promise<boolean> {
  try {
    await AsyncStorage.setItem(LAST_RECIPIENT_STORAGE_KEY, JSON.stringify(recipient));
    return true;
  } catch (error) {
    console.error("Failed to save last recipient:", error);
    return false;
  }
}

/**
 * Get last payment recipient
 */
export async function getLastPaymentRecipient(): Promise<{
  name: string;
  account: string;
  amount: number;
} | null> {
  try {
    const recipientJson = await AsyncStorage.getItem(LAST_RECIPIENT_STORAGE_KEY);
    if (!recipientJson) return null;
    
    return JSON.parse(recipientJson);
  } catch (error) {
    console.error("Failed to get last recipient:", error);
    return null;
  }
}

/**
 * Execute quick action: Pay Last Recipient
 */
export async function executePayLastRecipient(): Promise<{
  success: boolean;
  recipient?: any;
  error?: string;
}> {
  try {
    // Get last recipient
    const recipient = await getLastPaymentRecipient();
    
    if (!recipient) {
      return {
        success: false,
        error: "No recent recipient found",
      };
    }
    
    // Authenticate
    const auth = await authenticateWithBiometric(
      `Authenticate to pay ${recipient.name}`
    );
    
    if (!auth.success) {
      return { success: false, error: auth.error };
    }
    
    // Log action
    await logQuickAction("pay_last_recipient");
    
    return {
      success: true,
      recipient,
    };
  } catch (error: any) {
    console.error("Failed to pay last recipient:", error);
    return {
      success: false,
      error: error.message || "Failed to pay last recipient",
    };
  }
}

/**
 * Execute quick action: Recent Transactions
 */
export async function executeRecentTransactions(): Promise<{
  success: boolean;
  transactions?: any[];
  error?: string;
}> {
  try {
    // In production, fetch from API
    // For now, return mock data
    const mockTransactions = [
      {
        id: "1",
        description: "Grocery Store",
        amount: -45.50,
        date: new Date().toISOString(),
      },
      {
        id: "2",
        description: "Salary Deposit",
        amount: 3000.00,
        date: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: "3",
        description: "Electric Bill",
        amount: -120.00,
        date: new Date(Date.now() - 172800000).toISOString(),
      },
    ];
    
    // Log action
    await logQuickAction("recent_transactions");
    
    return {
      success: true,
      transactions: mockTransactions,
    };
  } catch (error: any) {
    console.error("Failed to get recent transactions:", error);
    return {
      success: false,
      error: error.message || "Failed to get recent transactions",
    };
  }
}

/**
 * Log quick action usage
 */
async function logQuickAction(actionId: string): Promise<void> {
  try {
    const historyJson = await AsyncStorage.getItem(QUICK_ACTION_HISTORY_STORAGE_KEY);
    const history = historyJson ? JSON.parse(historyJson) : [];
    
    history.push({
      action_id: actionId,
      timestamp: Date.now(),
    });
    
    // Keep only last 100 actions
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    
    await AsyncStorage.setItem(QUICK_ACTION_HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (error) {
    console.error("Failed to log quick action:", error);
  }
}

/**
 * Get quick action usage statistics
 */
export async function getQuickActionStatistics(): Promise<{
  total_uses: number;
  most_used: string;
  usage_by_action: Record<string, number>;
}> {
  try {
    const historyJson = await AsyncStorage.getItem(QUICK_ACTION_HISTORY_STORAGE_KEY);
    if (!historyJson) {
      return {
        total_uses: 0,
        most_used: "",
        usage_by_action: {},
      };
    }
    
    const history = JSON.parse(historyJson);
    const usageByAction: Record<string, number> = {};
    
    for (const entry of history) {
      usageByAction[entry.action_id] = (usageByAction[entry.action_id] || 0) + 1;
    }
    
    let mostUsed = "";
    let maxUses = 0;
    
    for (const [actionId, count] of Object.entries(usageByAction)) {
      if (count > maxUses) {
        maxUses = count;
        mostUsed = actionId;
      }
    }
    
    return {
      total_uses: history.length,
      most_used: mostUsed,
      usage_by_action: usageByAction,
    };
  } catch (error) {
    console.error("Failed to get quick action statistics:", error);
    return {
      total_uses: 0,
      most_used: "",
      usage_by_action: {},
    };
  }
}

/**
 * Clear quick action history
 */
export async function clearQuickActionHistory(): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(QUICK_ACTION_HISTORY_STORAGE_KEY);
    return true;
  } catch (error) {
    console.error("Failed to clear quick action history:", error);
    return false;
  }
}

/**
 * Get enabled quick actions
 */
export async function getEnabledQuickActions(): Promise<QuickAction[]> {
  const settings = await getQuickActionsSettings();
  return settings.filter((a) => a.enabled);
}

/**
 * Check if quick action is enabled
 */
export async function isQuickActionEnabled(actionId: string): Promise<boolean> {
  const settings = await getQuickActionsSettings();
  const action = settings.find((a) => a.id === actionId);
  return action?.enabled || false;
}

/**
 * Reset quick actions to default
 */
export async function resetQuickActionsToDefault(): Promise<boolean> {
  try {
    await AsyncStorage.setItem(
      QUICK_ACTIONS_STORAGE_KEY,
      JSON.stringify(AVAILABLE_QUICK_ACTIONS)
    );
    return true;
  } catch (error) {
    console.error("Failed to reset quick actions:", error);
    return false;
  }
}
