import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  biometricType?: 'fingerprint' | 'facial' | 'iris';
}

export interface BiometricCapabilities {
  isAvailable: boolean;
  isEnrolled: boolean;
  biometricType: 'fingerprint' | 'facial' | 'iris' | 'none';
}

const BIOMETRIC_ENABLED_KEY = '@insureportal_biometric_enabled';
const BIOMETRIC_TOKEN_KEY = '@insureportal_biometric_token';

const rnBiometrics = new ReactNativeBiometrics({ allowDeviceCredentials: true });

export class BiometricAuthService {
  static async checkCapabilities(): Promise<BiometricCapabilities> {
    try {
      const { available, biometryType } = await rnBiometrics.isSensorAvailable();

      let biometricType: 'fingerprint' | 'facial' | 'iris' | 'none' = 'none';
      
      if (biometryType === BiometryTypes.FaceID) {
        biometricType = 'facial';
      } else if (biometryType === BiometryTypes.TouchID || biometryType === BiometryTypes.Biometrics) {
        biometricType = 'fingerprint';
      }

      return {
        isAvailable: available,
        isEnrolled: available,
        biometricType,
      };
    } catch (error) {
      console.error('Error checking biometric capabilities:', error);
      return {
        isAvailable: false,
        isEnrolled: false,
        biometricType: 'none',
      };
    }
  }

  static async authenticate(promptMessage?: string): Promise<BiometricAuthResult> {
    try {
      const capabilities = await this.checkCapabilities();
      
      if (!capabilities.isAvailable) {
        return {
          success: false,
          error: 'Biometric authentication is not available on this device',
        };
      }

      const { success, error } = await rnBiometrics.simplePrompt({
        promptMessage: promptMessage || 'Authenticate to access InsurePortal',
        cancelButtonText: 'Cancel',
      });

      if (success) {
        return {
          success: true,
          biometricType: capabilities.biometricType as 'fingerprint' | 'facial' | 'iris',
        };
      } else {
        return {
          success: false,
          error: error || 'Authentication failed',
        };
      }
    } catch (error: any) {
      console.error('Biometric authentication error:', error);
      
      let errorMessage = 'An unexpected error occurred during authentication';
      
      if (error.message?.includes('cancel')) {
        errorMessage = 'Authentication cancelled by user';
      } else if (error.message?.includes('lockout')) {
        errorMessage = 'Too many failed attempts. Please try again later.';
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  static async isBiometricEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
      return enabled === 'true';
    } catch (error) {
      console.error('Error checking biometric enabled status:', error);
      return false;
    }
  }

  static async enableBiometric(authToken: string): Promise<boolean> {
    try {
      const result = await this.authenticate('Enable biometric login for InsurePortal');
      
      if (result.success) {
        await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
        await AsyncStorage.setItem(BIOMETRIC_TOKEN_KEY, authToken);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error enabling biometric:', error);
      return false;
    }
  }

  static async disableBiometric(): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(BIOMETRIC_ENABLED_KEY);
      await AsyncStorage.removeItem(BIOMETRIC_TOKEN_KEY);
      return true;
    } catch (error) {
      console.error('Error disabling biometric:', error);
      return false;
    }
  }

  static async authenticateAndGetToken(): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
      const isEnabled = await this.isBiometricEnabled();
      
      if (!isEnabled) {
        return {
          success: false,
          error: 'Biometric login is not enabled',
        };
      }

      const authResult = await this.authenticate('Sign in to InsurePortal');
      
      if (authResult.success) {
        const token = await AsyncStorage.getItem(BIOMETRIC_TOKEN_KEY);
        
        if (token) {
          return {
            success: true,
            token,
          };
        } else {
          return {
            success: false,
            error: 'No stored credentials found. Please sign in with your password.',
          };
        }
      }

      return {
        success: false,
        error: authResult.error,
      };
    } catch (error) {
      console.error('Error authenticating with biometric:', error);
      return {
        success: false,
        error: 'An unexpected error occurred',
      };
    }
  }

  static getBiometricTypeName(type: 'fingerprint' | 'facial' | 'iris' | 'none'): string {
    switch (type) {
      case 'facial':
        return 'Face ID';
      case 'fingerprint':
        return 'Touch ID';
      case 'iris':
        return 'Iris Scan';
      default:
        return 'Biometric';
    }
  }

  static async createKeys(): Promise<{ publicKey: string } | null> {
    try {
      const { publicKey } = await rnBiometrics.createKeys();
      return { publicKey };
    } catch (error) {
      console.error('Error creating biometric keys:', error);
      return null;
    }
  }

  static async deleteKeys(): Promise<boolean> {
    try {
      const { keysDeleted } = await rnBiometrics.deleteKeys();
      return keysDeleted;
    } catch (error) {
      console.error('Error deleting biometric keys:', error);
      return false;
    }
  }

  static async createSignature(payload: string, promptMessage?: string): Promise<string | null> {
    try {
      const { success, signature } = await rnBiometrics.createSignature({
        promptMessage: promptMessage || 'Sign in to InsurePortal',
        payload,
      });

      if (success && signature) {
        return signature;
      }
      return null;
    } catch (error) {
      console.error('Error creating signature:', error);
      return null;
    }
  }
}

export default BiometricAuthService;
