import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ApiAnalyticsScreen extends StatelessWidget {
  const ApiAnalyticsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'API Analytics',
      apiEndpoint: '/api/production/missing-domains/list',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'API_ANALYTICS_SCREEN-001', 'status': 'active'},
        {'id': 'API_ANALYTICS_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
