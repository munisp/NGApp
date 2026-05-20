import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class WorkflowEngineScreen extends StatelessWidget {
  const WorkflowEngineScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Workflows',
      apiEndpoint: '/api/workflows/v1/definitions',
      columnKeys: const ['id', 'name', 'type', 'status'],
      columnLabels: const ['ID', 'Workflow', 'Type', 'Status'],
      seedData: const [
      {'id': 'WF-001', 'name': 'Loan Approval', 'type': 'Multi-Level', 'status': 'Active'},
    ],
    );
  }
}
