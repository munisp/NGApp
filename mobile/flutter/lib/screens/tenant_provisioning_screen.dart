import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TenantProvisioningScreen extends StatelessWidget {
  const TenantProvisioningScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Tenant Provisioning',
      apiEndpoint: '/api/tenant-provisioning/v1/tenants',
      columnKeys: const ['id', 'tenant', 'package', 'status'],
      columnLabels: const ['ID', 'Tenant', 'Package', 'Status'],
      seedData: const [
      {'id': 'TP-001', 'tenant': 'GTBank', 'package': 'Enterprise', 'status': 'Active'},
    ],
    );
  }
}
