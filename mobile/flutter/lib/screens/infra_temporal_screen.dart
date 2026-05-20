import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class InfraTemporalScreen extends StatelessWidget {
  const InfraTemporalScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Infra: Temporal',
      apiEndpoint: '/api/infra/v1/temporal',
      columnKeys: const ['id', 'workflow', 'running', 'completed'],
      columnLabels: const ['ID', 'Workflow', 'Running', 'Completed'],
      seedData: const [
      {'id': 'TMP-001', 'workflow': 'LoanApproval', 'running': '12', 'completed': '4,500'},
    ],
    );
  }
}
