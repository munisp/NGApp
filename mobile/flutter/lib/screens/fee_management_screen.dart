import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class FeeManagementScreen extends StatelessWidget {
  const FeeManagementScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Fee Management',
      apiEndpoint: '/api/production/missing-domains/list',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'FEE_MANAGEMENT_SCREEN-001', 'status': 'active'},
        {'id': 'FEE_MANAGEMENT_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
