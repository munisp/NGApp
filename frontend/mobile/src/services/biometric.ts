// ============================================================
// NEXCOM Exchange - Biometric Authentication Service
// ============================================================

import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const BIOMETRIC_ENABLED_KEY = "nexcom_biometric_enabled";
const AUTH_TOKEN_KEY = "nexcom_auth_token";

export interface BiometricResult {
  success: boolean;
  error?: string;
}

/**
 * Check if biometric authentication is available on the device
 */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) return false;
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return enrolled;
  } catch {
    return false;
  }
}

/**
 * Get the types of biometric authentication available
 */
export async function getBiometricTypes(): Promise<string[]> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    return types.map((type) => {
      switch (type) {
        case LocalAuthentication.AuthenticationType.FINGERPRINT:
          return "Fingerprint";
        case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
          return "Face ID";
        case LocalAuthentication.AuthenticationType.IRIS:
          return "Iris";
        default:
          return "Unknown";
      }
    });
  } catch {
    return [];
  }
}

/**
 * Authenticate using biometrics
 */
export async function authenticateWithBiometrics(
  promptMessage = "Authenticate to access NEXCOM Exchange"
): Promise<BiometricResult> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: "Use Password",
      disableDeviceFallback: false,
      fallbackLabel: "Use Password",
    });

    if (result.success) {
      return { success: true };
    }
    return { success: false, error: result.error || "Authentication failed" };
  } catch (err) {
    return { success: false, error: "Biometric authentication unavailable" };
  }
}

/**
 * Check if biometric login is enabled by user preference
 */
export async function isBiometricLoginEnabled(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    return value === "true";
  } catch {
    return false;
  }
}

/**
 * Enable or disable biometric login
 */
export async function setBiometricLoginEnabled(enabled: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled ? "true" : "false");
  } catch {
    // Silently fail
  }
}

/**
 * Store auth token securely for biometric login
 */
export async function storeAuthToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
  } catch {
    // Silently fail
  }
}

/**
 * Retrieve stored auth token after biometric verification
 */
export async function getStoredAuthToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Clear stored auth credentials
 */
export async function clearStoredCredentials(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
  } catch {
    // Silently fail
  }
}

/**
 * Full biometric login flow:
 * 1. Check if biometric is available and enabled
 * 2. Authenticate with biometrics
 * 3. Retrieve stored token
 */
export async function biometricLogin(): Promise<{ success: boolean; token?: string; error?: string }> {
  const available = await isBiometricAvailable();
  if (!available) {
    return { success: false, error: "Biometric authentication not available" };
  }

  const enabled = await isBiometricLoginEnabled();
  if (!enabled) {
    return { success: false, error: "Biometric login not enabled" };
  }

  const authResult = await authenticateWithBiometrics();
  if (!authResult.success) {
    return { success: false, error: authResult.error };
  }

  const token = await getStoredAuthToken();
  if (!token) {
    return { success: false, error: "No stored credentials found" };
  }

  return { success: true, token };
}
