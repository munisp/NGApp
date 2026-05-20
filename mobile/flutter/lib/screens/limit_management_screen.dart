import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class LimitManagementScreen extends StatelessWidget {
  const LimitManagementScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Limits',
      apiEndpoint: '/api/limits/v1/rules',
      columnKeys: const ['id', 'name', 'value', 'scope', 'status'],
      columnLabels: const ['ID', 'Limit', 'Value', 'Scope', 'Status'],
      seedData: const [
      {'id': 'LIM-001', 'name': 'Single Transfer', 'value': 'NGN 10M', 'scope': 'Retail', 'status': 'Active'},
      {'id': 'LIM-002', 'name': 'Daily Cumulative', 'value': 'NGN 50M', 'scope': 'Corporate', 'status': 'Active'},
    ],
    );
  }
}
