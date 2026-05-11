import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class BillingOrchestratorScreen extends StatelessWidget {
  const BillingOrchestratorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Billing Orchestrator',
      apiEndpoint: '/api/billing/v1/rules',
      columnKeys: const ['id', 'rule', 'type', 'status'],
      columnLabels: const ['ID', 'Rule', 'Type', 'Status'],
      seedData: const [
      {'id': 'BO-001', 'rule': 'Transaction Fee', 'type': 'Per-Transaction', 'status': 'Active'},
    ],
    );
  }
}
