import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KycWorkflowScreen extends StatelessWidget {
  const KycWorkflowScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'KYC Workflow Orchestration',
      apiEndpoint: '/api/kyc-enhanced/analytics-dashboard',
      columnKeys: const ['id', 'name', 'status'],
      columnLabels: const ['ID', 'Workflow', 'Status'],
      seedData: const [
        {'id': 'KYC_WORKFLOW-001', 'status': 'active'},
        {'id': 'KYC_WORKFLOW-002', 'status': 'pending'},
      ],
    );
  }
}
