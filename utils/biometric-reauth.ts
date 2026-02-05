import * as LocalAuthentication from "expo-local-authentication";
import { Platform, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BIOMETRIC_ENABLED_KEY = "biometric_enabled";
const LAST_AUTH_KEY = "last_biometric_auth";
const AUTH_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * Check if biometric authentication is enabled by user
 */
export async function isBiometricEnabled(): Promise<boolean> {
  try {
    const enabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
    return enabled === "true";
  } catch (error) {
    console.error("Check biometric enabled error:", error);
    return false;
  }
}

/**
 * Check if device supports biometric authentication
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }

  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return compatible && enrolled;
  } catch (error) {
    console.error("Check biometric availability error:", error);
    return false;
  }
}

/**
 * Check if recent authentication is still valid (within timeout)
 */
async function isRecentAuthValid(): Promise<boolean> {
  try {
    const lastAuthStr = await AsyncStorage.getItem(LAST_AUTH_KEY);
    if (!lastAuthStr) {
      return false;
    }

    const lastAuth = parseInt(lastAuthStr, 10);
    const now = Date.now();
    return now - lastAuth < AUTH_TIMEOUT;
  } catch (error) {
    console.error("Check recent auth error:", error);
    return false;
  }
}

/**
 * Update last authentication timestamp
 */
async function updateLastAuth(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_AUTH_KEY, Date.now().toString());
  } catch (error) {
    console.error("Update last auth error:", error);
  }
}

/**
 * Authenticate user with biometrics
 */
export async function authenticateWithBiometrics(
  reason: string = "Authenticate to continue"
): Promise<boolean> {
  if (Platform.OS === "web") {
    // Web fallback - just return true
    return true;
  }

  try {
    const biometricEnabled = await isBiometricEnabled();
    if (!biometricEnabled) {
      // Biometric not enabled, allow action
      return true;
    }

    const available = await isBiometricAvailable();
    if (!available) {
      Alert.alert(
        "Biometric Not Available",
        "Biometric authentication is not available on this device. Please use your password.",
        [{ text: "OK" }]
      );
      return false;
    }

    // Check if recent auth is still valid
    const recentAuthValid = await isRecentAuthValid();
    if (recentAuthValid) {
      return true;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
      fallbackLabel: "Use Password",
    });

    if (result.success) {
      await updateLastAuth();
      return true;
    }

    return false;
  } catch (error) {
    console.error("Biometric authentication error:", error);
    Alert.alert("Authentication Error", "Failed to authenticate. Please try again.");
    return false;
  }
}

/**
 * Require biometric authentication before viewing sensitive data
 */
export async function requireBiometricForView(
  dataType: string = "sensitive information"
): Promise<boolean> {
  return authenticateWithBiometrics(`Authenticate to view ${dataType}`);
}

/**
 * Require biometric authentication before editing sensitive data
 */
export async function requireBiometricForEdit(
  dataType: string = "this information"
): Promise<boolean> {
  return authenticateWithBiometrics(`Authenticate to edit ${dataType}`);
}

/**
 * Require biometric authentication before performing sensitive action
 */
export async function requireBiometricForAction(
  action: string = "this action"
): Promise<boolean> {
  return authenticateWithBiometrics(`Authenticate to ${action}`);
}

/**
 * Require biometric authentication for large transactions
 */
export async function requireBiometricForTransaction(
  amount: number,
  threshold: number = 1000
): Promise<boolean> {
  if (amount < threshold) {
    // Small transaction, no biometric required
    return true;
  }

  return authenticateWithBiometrics(
    `Authenticate to send $${amount.toFixed(2)}`
  );
}

/**
 * Clear authentication cache (force re-authentication)
 */
export async function clearAuthCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAST_AUTH_KEY);
  } catch (error) {
    console.error("Clear auth cache error:", error);
  }
}

/**
 * Biometric re-authentication hook for sensitive screens
 */
export interface BiometricGuardOptions {
  reason?: string;
  onAuthFail?: () => void;
  skipIfRecent?: boolean;
}

export async function useBiometricGuard(
  options: BiometricGuardOptions = {}
): Promise<boolean> {
  const {
    reason = "Authenticate to access this screen",
    onAuthFail,
    skipIfRecent = true,
  } = options;

  const biometricEnabled = await isBiometricEnabled();
  if (!biometricEnabled) {
    return true;
  }

  if (skipIfRecent) {
    const recentAuthValid = await isRecentAuthValid();
    if (recentAuthValid) {
      return true;
    }
  }

  const authenticated = await authenticateWithBiometrics(reason);

  if (!authenticated && onAuthFail) {
    onAuthFail();
  }

  return authenticated;
}
