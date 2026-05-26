import 'package:flutter/material.dart';

class AuthProvider extends ChangeNotifier {
  bool _isAuthenticated = true;
  String _userId = 'user-001';
  String _userName = 'Adebayo Okonkwo';
  String _role = 'tenant-admin';
  String _tenantId = 'tenant-acme-bank';

  bool get isAuthenticated => _isAuthenticated;
  String get userId => _userId;
  String get userName => _userName;
  String get role => _role;
  String get tenantId => _tenantId;

  Future<bool> login(String email, String password) async {
    // Keycloak OIDC token exchange
    _isAuthenticated = true;
    _userId = 'user-001';
    _userName = 'Adebayo Okonkwo';
    _role = 'tenant-admin';
    notifyListeners();
    return true;
  }

  void logout() {
    _isAuthenticated = false;
    notifyListeners();
  }
}
