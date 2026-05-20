import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TenantIsolationScreen extends StatelessWidget {
  const TenantIsolationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Tenant Isolation',
      apiEndpoint: '/api/tenant/v1/isolation',
      columnKeys: const ['id', 'tenant', 'dataPartition', 'status'],
      columnLabels: const ['ID', 'Tenant', 'Partition', 'Status'],
      seedData: const [
      {'id': 'TI-001', 'tenant': 'GTBank', 'dataPartition': 'Dedicated Schema', 'status': 'Isolated'},
    ],
    );
  }
}
