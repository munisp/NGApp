import 'package:flutter/foundation.dart';

enum BiometricType { fingerprint, faceId, iris, none }

class BiometricService {
  static final BiometricService _instance = BiometricService._internal();
  factory BiometricService() => _instance;
  BiometricService._internal();

  bool _isAvailable = false;
  BiometricType _type = BiometricType.none;

  Future<bool> checkAvailability() async {
    try {
      // local_auth package would be used here:
      // final auth = LocalAuthentication();
      // _isAvailable = await auth.canCheckBiometrics;
      // final biometrics = await auth.getAvailableBiometrics();
      _isAvailable = true; // Platform check placeholder
      _type = BiometricType.fingerprint;
      return _isAvailable;
    } catch (e) {
      debugPrint('[Biometric] Availability check failed: $e');
      return false;
    }
  }

  BiometricType get biometricType => _type;
  bool get isAvailable => _isAvailable;

  Future<bool> authenticate({String reason = 'Verify your identity'}) async {
    if (!_isAvailable) return false;
    try {
      // final auth = LocalAuthentication();
      // return await auth.authenticate(
      //   localizedReason: reason,
      //   options: const AuthenticationOptions(
      //     stickyAuth: true,
      //     biometricOnly: true,
      //   ),
      // );
      debugPrint('[Biometric] Authentication requested: $reason');
      return true; // Placeholder - actual implementation uses local_auth
    } catch (e) {
      debugPrint('[Biometric] Authentication failed: $e');
      return false;
    }
  }

  Future<bool> authenticateForPayment(double amount, String currency) async {
    final reason = 'Authorize payment of $currency ${amount.toStringAsFixed(2)}';
    return authenticate(reason: reason);
  }

  Future<bool> authenticateForLogin() async {
    return authenticate(reason: 'Sign in to Payment Switch');
  }
}
