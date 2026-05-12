import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class LoadTestRunnerScreen extends StatelessWidget {
  const LoadTestRunnerScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Load Tests',
      apiEndpoint: '/api/production/load-tests/results',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'LOAD_TEST_RUNNER_SCREEN-001', 'status': 'active'},
        {'id': 'LOAD_TEST_RUNNER_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
