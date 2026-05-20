import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class LoadTestingScreen extends StatelessWidget {
  const LoadTestingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Load Testing',
      apiEndpoint: '/api/load-tests/v1/results',
      columnKeys: const ['id', 'scenario', 'requests', 'success', 'p99'],
      columnLabels: const ['ID', 'Scenario', 'Requests', 'Success', 'P99 ms'],
      seedData: const [
      {'id': 'LT-001', 'scenario': 'Peak Hour', 'requests': '1,000,000', 'success': '99.97%', 'p99': '45'},
    ],
    );
  }
}
