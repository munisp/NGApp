import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ApprovalWorkflowScreen extends StatelessWidget {
  const ApprovalWorkflowScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Approval Workflows',
      apiEndpoint: '/api/approvals/v1/requests',
      columnKeys: const ['id', 'type', 'initiator', 'amount', 'status'],
      columnLabels: const ['ID', 'Type', 'Initiator', 'Amount', 'Status'],
      seedData: const [
      {'id': 'APR-001', 'type': 'Loan Disbursement', 'initiator': 'Credit Officer', 'amount': 'NGN 5B', 'status': 'Pending L2'},
    ],
    );
  }
}
