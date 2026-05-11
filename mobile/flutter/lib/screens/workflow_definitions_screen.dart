import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class WorkflowDefinitionsScreen extends StatelessWidget {
  const WorkflowDefinitionsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Workflow Definitions',
      apiEndpoint: '/api/workflows/v1/definitions',
      columnKeys: const ['id', 'name', 'steps', 'status'],
      columnLabels: const ['ID', 'Definition', 'Steps', 'Status'],
      seedData: const [
      {'id': 'WFD-001', 'name': 'Account Opening', 'steps': '5', 'status': 'Active'},
    ],
    );
  }
}
