import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const BIOMETRIC_ENABLED_KEY = "@biometric_login_enabled";
const SESSION_KEY = "@quick_login_session";
const SESSION_DURATION = 15 * 60 * 1000; // 15 minutes

export interface BiometricCapabilities {
  isAvailable: boolean;
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedTypes: LocalAuthentication.AuthenticationType[];
}

export interface QuickLoginSession {
  userId: string;
  timestamp: number;
  expiresAt: number;
}

export async function checkBiometricCapabilities(): Promise<BiometricCapabilities> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

    return {
      isAvailable: hasHardware && isEnrolled,
      hasHardware,
      isEnrolled,
      supportedTypes,
    };
  } catch (error) {
    console.error("Failed to check biometric capabilities:", error);
    return {
      isAvailable: false,
      hasHardware: false,
      isEnrolled: false,
      supportedTypes: [],
    };
  }
}

export function getBiometricTypeName(type: LocalAuthentication.AuthenticationType): string {
  switch (type) {
    case LocalAuthentication.AuthenticationType.FINGERPRINT:
      return "Fingerprint";
    case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
      return "Face ID";
    case LocalAuthentication.AuthenticationType.IRIS:
      return "Iris";
    default:
      return "Biometric";
  }
}

export async function isBiometricLoginEnabled(): Promise<boolean> {
  try {
    const enabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
    return enabled === "true";
  } catch (error) {
    console.error("Failed to check biometric login status:", error);
    return false;
  }
}

export async function enableBiometricLogin(): Promise<void> {
  await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, "true");
}

export async function disableBiometricLogin(): Promise<void> {
  await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, "false");
  await clearQuickLoginSession();
}

export async function authenticateWithBiometric(
  promptMessage: string = "Authenticate to continue"
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const capabilities = await checkBiometricCapabilities();
    
    if (!capabilities.isAvailable) {
      return {
        success: false,
        error: capabilities.hasHardware
          ? "No biometric credentials enrolled"
          : "Biometric hardware not available",
      };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: "Use PIN",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });

    if (result.success) {
      return { success: true };
    } else {
      return {
        success: false,
        error: result.error || "Authentication failed",
      };
    }
  } catch (error) {
    console.error("Biometric authentication error:", error);
    return {
      success: false,
      error: "Authentication error occurred",
    };
  }
}

export async function createQuickLoginSession(userId: string): Promise<void> {
  const session: QuickLoginSession = {
    userId,
    timestamp: Date.now(),
    expiresAt: Date.now() + SESSION_DURATION,
  };

  try {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  } catch (error) {
    console.error("Failed to create quick login session:", error);
    throw error;
  }
}

export async function getQuickLoginSession(): Promise<QuickLoginSession | null> {
  try {
    const sessionData = await SecureStore.getItemAsync(SESSION_KEY);
    if (!sessionData) return null;

    const session: QuickLoginSession = JSON.parse(sessionData);

    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      await clearQuickLoginSession();
      return null;
    }

    return session;
  } catch (error) {
    console.error("Failed to get quick login session:", error);
    return null;
  }
}

export async function clearQuickLoginSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch (error) {
    console.error("Failed to clear quick login session:", error);
  }
}

export async function quickLogin(): Promise<{
  success: boolean;
  userId?: string;
  error?: string;
}> {
  try {
    // Check if biometric login is enabled
    const isEnabled = await isBiometricLoginEnabled();
    if (!isEnabled) {
      return {
        success: false,
        error: "Biometric login is not enabled",
      };
    }

    // Check if there's a valid session
    const session = await getQuickLoginSession();
    if (!session) {
      return {
        success: false,
        error: "No active session found",
      };
    }

    // Authenticate with biometric
    const authResult = await authenticateWithBiometric("Unlock with biometric");
    
    if (!authResult.success) {
      return {
        success: false,
        error: authResult.error,
      };
    }

    // Extend session
    await createQuickLoginSession(session.userId);

    return {
      success: true,
      userId: session.userId,
    };
  } catch (error) {
    console.error("Quick login error:", error);
    return {
      success: false,
      error: "Quick login failed",
    };
  }
}

export async function setupBiometricLogin(userId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Check capabilities
    const capabilities = await checkBiometricCapabilities();
    if (!capabilities.isAvailable) {
      return {
        success: false,
        error: "Biometric authentication is not available on this device",
      };
    }

    // Authenticate to confirm
    const authResult = await authenticateWithBiometric(
      "Authenticate to enable biometric login"
    );

    if (!authResult.success) {
      return {
        success: false,
        error: authResult.error,
      };
    }

    // Enable biometric login
    await enableBiometricLogin();

    // Create initial session
    await createQuickLoginSession(userId);

    return { success: true };
  } catch (error) {
    console.error("Failed to setup biometric login:", error);
    return {
      success: false,
      error: "Setup failed",
    };
  }
}

export function getSessionRemainingTime(session: QuickLoginSession): number {
  return Math.max(0, session.expiresAt - Date.now());
}

export function formatSessionRemainingTime(session: QuickLoginSession): string {
  const remaining = getSessionRemainingTime(session);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}
