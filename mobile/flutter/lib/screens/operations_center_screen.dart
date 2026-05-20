import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class OperationsCenterScreen extends StatelessWidget {
  const OperationsCenterScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Operations Center',
      apiEndpoint: '/api/operations/v1/tasks',
      columnKeys: const ['id', 'task', 'assignee', 'priority', 'status'],
      columnLabels: const ['ID', 'Task', 'Assignee', 'Priority', 'Status'],
      seedData: const [
      {'id': 'OPS-001', 'task': 'EOD Reconciliation', 'assignee': 'Ops Team', 'priority': 'High', 'status': 'In Progress'},
    ],
    );
  }
}
