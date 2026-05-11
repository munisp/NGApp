import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class WorkflowInstancesScreen extends StatelessWidget {
  const WorkflowInstancesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Workflow Instances',
      apiEndpoint: '/api/workflows/v1/instances',
      columnKeys: const ['id', 'definition', 'step', 'status'],
      columnLabels: const ['ID', 'Definition', 'Current Step', 'Status'],
      seedData: const [
      {'id': 'WFI-001', 'definition': 'Loan Approval', 'step': '3/5', 'status': 'In Progress'},
    ],
    );
  }
}
