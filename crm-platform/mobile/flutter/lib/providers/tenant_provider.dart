import 'package:flutter/material.dart';

class Tenant {
  final String id;
  final String name;
  final String tier;
  final Map<String, bool> products;

  Tenant({required this.id, required this.name, required this.tier, required this.products});
}

class TenantProvider extends ChangeNotifier {
  Tenant _currentTenant = _seedTenants[0];
  final List<Tenant> _tenants = _seedTenants;

  Tenant get currentTenant => _currentTenant;
  List<Tenant> get tenants => _tenants;

  void switchTenant(String tenantId) {
    _currentTenant = _tenants.firstWhere((t) => t.id == tenantId, orElse: () => _tenants[0]);
    notifyListeners();
  }

  bool hasProduct(String product) => _currentTenant.products[product] ?? false;

  static final List<Tenant> _seedTenants = [
    Tenant(id: 'tenant-acme-bank', name: 'Acme Microfinance Bank', tier: 'enterprise', products: {
      'core_banking': true, 'agent_banking': true, 'remittance': true, 'payments': true, 'merchant': true, 'mobile_money': true,
    }),
    Tenant(id: 'tenant-quickcash', name: 'QuickCash Mobile Money', tier: 'growth', products: {
      'agent_banking': true, 'payments': true, 'core_banking': false, 'remittance': false,
    }),
    Tenant(id: 'tenant-swiftremit', name: 'SwiftRemit International', tier: 'enterprise', products: {
      'remittance': true, 'payments': true, 'core_banking': false, 'agent_banking': false,
    }),
    Tenant(id: 'tenant-nextgen-mfb', name: 'NextGen MFB', tier: 'trial', products: {
      'core_banking': true, 'agent_banking': true, 'remittance': false, 'payments': false,
    }),
  ];
}
