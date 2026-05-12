import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class Customer360DashboardScreen extends StatelessWidget {
  const Customer360DashboardScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Customer 360',
      apiEndpoint: '/api/production/missing-domains/list',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'CUSTOMER_360_DASHBOARD_SCREEN-001', 'status': 'active'},
        {'id': 'CUSTOMER_360_DASHBOARD_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
