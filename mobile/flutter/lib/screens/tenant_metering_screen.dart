import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TenantMeteringScreen extends StatelessWidget {
  const TenantMeteringScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Tenant Metering',
      apiEndpoint: '/api/tenant/v1/metering',
      columnKeys: const ['id', 'tenant', 'apiCalls', 'storage', 'status'],
      columnLabels: const ['ID', 'Tenant', 'API Calls', 'Storage', 'Status'],
      seedData: const [
      {'id': 'TM-001', 'tenant': 'GTBank', 'apiCalls': '2.5M', 'storage': '45 GB', 'status': 'Active'},
    ],
    );
  }
}
