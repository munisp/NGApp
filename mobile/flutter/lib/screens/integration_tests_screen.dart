import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class IntegrationTestsScreen extends StatelessWidget {
  const IntegrationTestsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Integration Tests',
      apiEndpoint: '/api/tests/v1/integration',
      columnKeys: const ['id', 'suite', 'tests', 'passed', 'status'],
      columnLabels: const ['ID', 'Suite', 'Tests', 'Passed', 'Status'],
      seedData: const [
      {'id': 'IT-001', 'suite': 'Core Banking', 'tests': '45', 'passed': '45', 'status': 'All Passed'},
    ],
    );
  }
}
