import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class E2eOrchestratorScreen extends StatelessWidget {
  const E2eOrchestratorScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'E2E Orchestrator',
      apiEndpoint: '/api/production/e2e-tests/results',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'E2E_ORCHESTRATOR_SCREEN-001', 'status': 'active'},
        {'id': 'E2E_ORCHESTRATOR_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
