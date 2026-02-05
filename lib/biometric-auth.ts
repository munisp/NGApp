/**
 * Biometric Authentication Service
 * Handles Face ID, Touch ID, and fingerprint authentication
 */

import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const BIOMETRIC_ENABLED_KEY = 'biometric_auth_enabled';
const BIOMETRIC_ENROLLMENT_KEY = 'biometric_enrolled_at';

export type BiometricType = 'fingerprint' | 'facial_recognition' | 'iris' | 'none';

export interface BiometricCapabilities {
  isAvailable: boolean;
  supportedTypes: BiometricType[];
  isEnrolled: boolean;
  securityLevel: 'strong' | 'weak' | 'none';
}

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  biometricType?: BiometricType;
}

class BiometricAuthService {
  /**
   * Check if biometric authentication is available on the device
   */
  async getCapabilities(): Promise<BiometricCapabilities> {
    try {
      const isAvailable = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const securityLevel = await LocalAuthentication.getEnrolledLevelAsync();

      const biometricTypes: BiometricType[] = supportedTypes.map((type) => {
        switch (type) {
          case LocalAuthentication.AuthenticationType.FINGERPRINT:
            return 'fingerprint';
          case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
            return 'facial_recognition';
          case LocalAuthentication.AuthenticationType.IRIS:
            return 'iris';
          default:
            return 'none';
        }
      }).filter(t => t !== 'none');

      return {
        isAvailable,
        supportedTypes: biometricTypes,
        isEnrolled,
        securityLevel: securityLevel === LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG ? 'strong' :
                      securityLevel === LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK ? 'weak' : 'none',
      };
    } catch (error) {
      console.error('Error checking biometric capabilities:', error);
      return {
        isAvailable: false,
        supportedTypes: [],
        isEnrolled: false,
        securityLevel: 'none',
      };
    }
  }

  /**
   * Get human-readable name for biometric type
   */
  getBiometricName(type: BiometricType): string {
    switch (type) {
      case 'fingerprint':
        return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
      case 'facial_recognition':
        return Platform.OS === 'ios' ? 'Face ID' : 'Face Recognition';
      case 'iris':
        return 'Iris Recognition';
      default:
        return 'Biometric';
    }
  }

  /**
   * Get the primary biometric type available on the device
   */
  async getPrimaryBiometricType(): Promise<BiometricType> {
    const capabilities = await this.getCapabilities();
    if (capabilities.supportedTypes.length === 0) {
      return 'none';
    }
    // Prefer facial recognition on iOS (Face ID), fingerprint on Android
    if (Platform.OS === 'ios' && capabilities.supportedTypes.includes('facial_recognition')) {
      return 'facial_recognition';
    }
    return capabilities.supportedTypes[0];
  }

  /**
   * Check if biometric authentication is enabled by user
   */
  async isBiometricEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
      return enabled === 'true';
    } catch (error) {
      console.error('Error checking biometric enabled status:', error);
      return false;
    }
  }

  /**
   * Enable biometric authentication
   */
  async enableBiometric(): Promise<void> {
    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
    await AsyncStorage.setItem(BIOMETRIC_ENROLLMENT_KEY, new Date().toISOString());
  }

  /**
   * Disable biometric authentication
   */
  async disableBiometric(): Promise<void> {
    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'false');
  }

  /**
   * Authenticate user with biometrics
   */
  async authenticate(options: {
    promptMessage?: string;
    cancelLabel?: string;
    disableDeviceFallback?: boolean;
    requireConfirmation?: boolean;
  } = {}): Promise<BiometricAuthResult> {
    try {
      const capabilities = await this.getCapabilities();

      if (!capabilities.isAvailable) {
        return {
          success: false,
          error: 'Biometric authentication is not available on this device',
        };
      }

      if (!capabilities.isEnrolled) {
        return {
          success: false,
          error: 'No biometric credentials are enrolled on this device',
        };
      }

      const biometricType = await this.getPrimaryBiometricType();
      const biometricName = this.getBiometricName(biometricType);

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: options.promptMessage || `Authenticate with ${biometricName}`,
        cancelLabel: options.cancelLabel || 'Cancel',
        disableDeviceFallback: options.disableDeviceFallback || false,
        requireConfirmation: options.requireConfirmation || false,
      });

      if (result.success) {
        return {
          success: true,
          biometricType,
        };
      } else {
        return {
          success: false,
          error: result.error || 'Authentication failed',
        };
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  /**
   * Authenticate for app login
   */
  async authenticateForLogin(): Promise<BiometricAuthResult> {
    const biometricType = await this.getPrimaryBiometricType();
    const biometricName = this.getBiometricName(biometricType);

    return this.authenticate({
      promptMessage: `Sign in with ${biometricName}`,
      cancelLabel: 'Use Password',
      disableDeviceFallback: false,
    });
  }

  /**
   * Authenticate for transaction approval
   */
  async authenticateForTransaction(amount?: string, currency?: string): Promise<BiometricAuthResult> {
    const biometricType = await this.getPrimaryBiometricType();
    const biometricName = this.getBiometricName(biometricType);

    const message = amount && currency
      ? `Confirm transaction of ${currency} ${amount} with ${biometricName}`
      : `Confirm transaction with ${biometricName}`;

    return this.authenticate({
      promptMessage: message,
      cancelLabel: 'Cancel',
      disableDeviceFallback: true,
      requireConfirmation: true,
    });
  }

  /**
   * Authenticate for sensitive action
   */
  async authenticateForSensitiveAction(action: string): Promise<BiometricAuthResult> {
    const biometricType = await this.getPrimaryBiometricType();
    const biometricName = this.getBiometricName(biometricType);

    return this.authenticate({
      promptMessage: `Authenticate to ${action}`,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
  }

  /**
   * Check if device supports strong biometric authentication
   */
  async supportsStrongBiometric(): Promise<boolean> {
    const capabilities = await this.getCapabilities();
    return capabilities.securityLevel === 'strong';
  }

  /**
   * Get biometric enrollment status
   */
  async getEnrollmentStatus(): Promise<{
    isEnrolled: boolean;
    enrolledAt?: string;
    biometricType?: BiometricType;
  }> {
    const isEnabled = await this.isBiometricEnabled();
    const enrolledAt = await AsyncStorage.getItem(BIOMETRIC_ENROLLMENT_KEY);
    const biometricType = await this.getPrimaryBiometricType();

    return {
      isEnrolled: isEnabled,
      enrolledAt: enrolledAt || undefined,
      biometricType: biometricType !== 'none' ? biometricType : undefined,
    };
  }

  /**
   * Prompt user to enable biometric authentication
   */
  async promptEnrollment(): Promise<{
    shouldEnroll: boolean;
    capabilities: BiometricCapabilities;
  }> {
    const capabilities = await this.getCapabilities();

    if (!capabilities.isAvailable || !capabilities.isEnrolled) {
      return {
        shouldEnroll: false,
        capabilities,
      };
    }

    const isAlreadyEnabled = await this.isBiometricEnabled();
    if (isAlreadyEnabled) {
      return {
        shouldEnroll: false,
        capabilities,
      };
    }

    return {
      shouldEnroll: true,
      capabilities,
    };
  }

  /**
   * Test biometric authentication (for setup/enrollment)
   */
  async testAuthentication(): Promise<BiometricAuthResult> {
    const biometricType = await this.getPrimaryBiometricType();
    const biometricName = this.getBiometricName(biometricType);

    return this.authenticate({
      promptMessage: `Test ${biometricName} authentication`,
      cancelLabel: 'Cancel',
      disableDeviceFallback: true,
    });
  }
}

// Export singleton instance
export const biometricAuth = new BiometricAuthService();
