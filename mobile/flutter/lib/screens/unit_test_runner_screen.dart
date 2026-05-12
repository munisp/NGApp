import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class UnitTestRunnerScreen extends StatelessWidget {
  const UnitTestRunnerScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Unit Tests',
      apiEndpoint: '/api/production/unit-tests/results',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'UNIT_TEST_RUNNER_SCREEN-001', 'status': 'active'},
        {'id': 'UNIT_TEST_RUNNER_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
