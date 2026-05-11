import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class E2eTestsScreen extends StatelessWidget {
  const E2eTestsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'E2E Tests',
      apiEndpoint: '/api/tests/v1/cases',
      columnKeys: const ['id', 'name', 'type', 'status'],
      columnLabels: const ['ID', 'Test', 'Type', 'Status'],
      seedData: const [
      {'id': 'TST-001', 'name': 'Customer Onboarding', 'type': 'E2E', 'status': 'Passed'},
    ],
    );
  }
}
