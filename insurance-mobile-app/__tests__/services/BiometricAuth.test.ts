import { BiometricAuthService } from '../../src/services/BiometricAuth';
import ReactNativeBiometrics from 'react-native-biometrics';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('react-native-biometrics');
jest.mock('@react-native-async-storage/async-storage');

describe('BiometricAuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkCapabilities', () => {
    it('should return available capabilities for Face ID', async () => {
      (ReactNativeBiometrics as jest.Mock).mockImplementation(() => ({
        isSensorAvailable: jest.fn().mockResolvedValue({
          available: true,
          biometryType: 'FaceID',
        }),
      }));

      const capabilities = await BiometricAuthService.checkCapabilities();

      expect(capabilities.isAvailable).toBe(true);
      expect(capabilities.isEnrolled).toBe(true);
      expect(capabilities.biometricType).toBe('facial');
    });

    it('should return available capabilities for Touch ID', async () => {
      (ReactNativeBiometrics as jest.Mock).mockImplementation(() => ({
        isSensorAvailable: jest.fn().mockResolvedValue({
          available: true,
          biometryType: 'TouchID',
        }),
      }));

      const capabilities = await BiometricAuthService.checkCapabilities();

      expect(capabilities.biometricType).toBe('fingerprint');
    });

    it('should return unavailable when no biometrics', async () => {
      (ReactNativeBiometrics as jest.Mock).mockImplementation(() => ({
        isSensorAvailable: jest.fn().mockResolvedValue({
          available: false,
          biometryType: undefined,
        }),
      }));

      const capabilities = await BiometricAuthService.checkCapabilities();

      expect(capabilities.isAvailable).toBe(false);
      expect(capabilities.biometricType).toBe('none');
    });

    it('should handle errors gracefully', async () => {
      (ReactNativeBiometrics as jest.Mock).mockImplementation(() => ({
        isSensorAvailable: jest.fn().mockRejectedValue(new Error('Test error')),
      }));

      const capabilities = await BiometricAuthService.checkCapabilities();

      expect(capabilities.isAvailable).toBe(false);
      expect(capabilities.isEnrolled).toBe(false);
      expect(capabilities.biometricType).toBe('none');
    });
  });

  describe('isBiometricEnabled', () => {
    it('should return true when biometric is enabled', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('true');

      const result = await BiometricAuthService.isBiometricEnabled();

      expect(result).toBe(true);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('@insureportal_biometric_enabled');
    });

    it('should return false when biometric is not enabled', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await BiometricAuthService.isBiometricEnabled();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const result = await BiometricAuthService.isBiometricEnabled();

      expect(result).toBe(false);
    });
  });

  describe('disableBiometric', () => {
    it('should remove biometric keys from storage', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

      const result = await BiometricAuthService.disableBiometric();

      expect(result).toBe(true);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@insureportal_biometric_enabled');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@insureportal_biometric_token');
    });

    it('should return false on error', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const result = await BiometricAuthService.disableBiometric();

      expect(result).toBe(false);
    });
  });

  describe('getBiometricTypeName', () => {
    it('should return Face ID for facial', () => {
      expect(BiometricAuthService.getBiometricTypeName('facial')).toBe('Face ID');
    });

    it('should return Touch ID for fingerprint', () => {
      expect(BiometricAuthService.getBiometricTypeName('fingerprint')).toBe('Touch ID');
    });

    it('should return Iris Scan for iris', () => {
      expect(BiometricAuthService.getBiometricTypeName('iris')).toBe('Iris Scan');
    });

    it('should return Biometric for none', () => {
      expect(BiometricAuthService.getBiometricTypeName('none')).toBe('Biometric');
    });
  });
});
