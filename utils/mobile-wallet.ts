import { Platform, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const WALLET_ENABLED_KEY = "@mobile_wallet_enabled";
const WALLET_CARDS_KEY = "@mobile_wallet_cards";

export type WalletProvider = "apple_pay" | "google_pay";

export interface WalletCard {
  id: string;
  lastFour: string;
  brand: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
  addedAt: number;
}

export interface PaymentRequest {
  amount: number;
  currency: string;
  description: string;
  merchantId: string;
  merchantName: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  paymentMethod?: {
    type: WalletProvider;
    lastFour: string;
    brand: string;
  };
}

/**
 * Check if mobile wallet is available on the device
 */
export async function isMobileWalletAvailable(): Promise<{
  available: boolean;
  provider?: WalletProvider;
  reason?: string;
}> {
  if (Platform.OS === "ios") {
    // Check for Apple Pay availability
    // In a real implementation, this would use PassKit
    return {
      available: true,
      provider: "apple_pay",
    };
  } else if (Platform.OS === "android") {
    // Check for Google Pay availability
    // In a real implementation, this would use Google Pay API
    return {
      available: true,
      provider: "google_pay",
    };
  }

  return {
    available: false,
    reason: "Mobile wallet not supported on this platform",
  };
}

/**
 * Check if mobile wallet is enabled in app settings
 */
export async function isMobileWalletEnabled(): Promise<boolean> {
  try {
    const enabled = await AsyncStorage.getItem(WALLET_ENABLED_KEY);
    return enabled === "true";
  } catch (error) {
    console.error("Failed to check mobile wallet status:", error);
    return false;
  }
}

/**
 * Enable mobile wallet
 */
export async function enableMobileWallet(): Promise<void> {
  await AsyncStorage.setItem(WALLET_ENABLED_KEY, "true");
}

/**
 * Disable mobile wallet
 */
export async function disableMobileWallet(): Promise<void> {
  await AsyncStorage.setItem(WALLET_ENABLED_KEY, "false");
}

/**
 * Get saved wallet cards
 */
export async function getWalletCards(): Promise<WalletCard[]> {
  try {
    const cardsData = await AsyncStorage.getItem(WALLET_CARDS_KEY);
    if (!cardsData) return [];
    return JSON.parse(cardsData);
  } catch (error) {
    console.error("Failed to get wallet cards:", error);
    return [];
  }
}

/**
 * Add card to mobile wallet
 */
export async function addCardToWallet(card: Omit<WalletCard, "id" | "addedAt">): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const availability = await isMobileWalletAvailable();
    if (!availability.available) {
      return {
        success: false,
        error: availability.reason || "Mobile wallet not available",
      };
    }

    const cards = await getWalletCards();
    
    // Check if card already exists
    const exists = cards.some((c) => c.lastFour === card.lastFour && c.brand === card.brand);
    if (exists) {
      return {
        success: false,
        error: "This card is already added to your wallet",
      };
    }

    const newCard: WalletCard = {
      ...card,
      id: `card_${Date.now()}`,
      addedAt: Date.now(),
    };

    // If this is the first card, make it default
    if (cards.length === 0) {
      newCard.isDefault = true;
    }

    cards.push(newCard);
    await AsyncStorage.setItem(WALLET_CARDS_KEY, JSON.stringify(cards));

    return { success: true };
  } catch (error) {
    console.error("Failed to add card to wallet:", error);
    return {
      success: false,
      error: "Failed to add card",
    };
  }
}

/**
 * Remove card from mobile wallet
 */
export async function removeCardFromWallet(cardId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const cards = await getWalletCards();
    const updatedCards = cards.filter((c) => c.id !== cardId);
    
    // If removed card was default, make first remaining card default
    if (updatedCards.length > 0 && !updatedCards.some((c) => c.isDefault)) {
      updatedCards[0].isDefault = true;
    }

    await AsyncStorage.setItem(WALLET_CARDS_KEY, JSON.stringify(updatedCards));
    return { success: true };
  } catch (error) {
    console.error("Failed to remove card from wallet:", error);
    return {
      success: false,
      error: "Failed to remove card",
    };
  }
}

/**
 * Set default wallet card
 */
export async function setDefaultWalletCard(cardId: string): Promise<void> {
  const cards = await getWalletCards();
  const updatedCards = cards.map((c) => ({
    ...c,
    isDefault: c.id === cardId,
  }));
  await AsyncStorage.setItem(WALLET_CARDS_KEY, JSON.stringify(updatedCards));
}

/**
 * Process payment with mobile wallet
 */
export async function processWalletPayment(
  request: PaymentRequest
): Promise<PaymentResult> {
  try {
    const availability = await isMobileWalletAvailable();
    if (!availability.available || !availability.provider) {
      return {
        success: false,
        error: "Mobile wallet not available",
      };
    }

    const isEnabled = await isMobileWalletEnabled();
    if (!isEnabled) {
      return {
        success: false,
        error: "Mobile wallet is not enabled. Please enable it in settings.",
      };
    }

    const cards = await getWalletCards();
    const defaultCard = cards.find((c) => c.isDefault);
    
    if (!defaultCard) {
      return {
        success: false,
        error: "No payment method available. Please add a card first.",
      };
    }

    // Simulate payment processing
    // In a real implementation, this would:
    // 1. Show native payment sheet (Apple Pay / Google Pay)
    // 2. Get payment token from wallet provider
    // 3. Send token to payment processor
    // 4. Return transaction result

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      transactionId,
      paymentMethod: {
        type: availability.provider,
        lastFour: defaultCard.lastFour,
        brand: defaultCard.brand,
      },
    };
  } catch (error) {
    console.error("Payment processing error:", error);
    return {
      success: false,
      error: "Payment processing failed",
    };
  }
}

/**
 * Show native payment sheet
 */
export async function showPaymentSheet(request: PaymentRequest): Promise<PaymentResult> {
  const availability = await isMobileWalletAvailable();
  
  if (!availability.available || !availability.provider) {
    Alert.alert("Error", "Mobile wallet is not available on this device");
    return {
      success: false,
      error: "Mobile wallet not available",
    };
  }

  const providerName = availability.provider === "apple_pay" ? "Apple Pay" : "Google Pay";

  return new Promise((resolve) => {
    Alert.alert(
      `Pay with ${providerName}`,
      `${request.merchantName}\n${request.description}\n\nAmount: ${formatCurrency(
        request.amount,
        request.currency
      )}`,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            resolve({
              success: false,
              error: "Payment cancelled by user",
            });
          },
        },
        {
          text: `Pay with ${providerName}`,
          onPress: async () => {
            const result = await processWalletPayment(request);
            resolve(result);
          },
        },
      ]
    );
  });
}

/**
 * Verify payment method
 */
export async function verifyPaymentMethod(cardId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const cards = await getWalletCards();
    const card = cards.find((c) => c.id === cardId);
    
    if (!card) {
      return {
        success: false,
        error: "Card not found",
      };
    }

    // Check if card is expired
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (
      card.expiryYear < currentYear ||
      (card.expiryYear === currentYear && card.expiryMonth < currentMonth)
    ) {
      return {
        success: false,
        error: "Card has expired",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to verify payment method:", error);
    return {
      success: false,
      error: "Verification failed",
    };
  }
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

/**
 * Get wallet provider name
 */
export function getWalletProviderName(provider: WalletProvider): string {
  return provider === "apple_pay" ? "Apple Pay" : "Google Pay";
}

/**
 * Get card brand display name
 */
export function getCardBrandName(brand: string): string {
  const brands: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "American Express",
    discover: "Discover",
  };
  return brands[brand.toLowerCase()] || brand;
}
