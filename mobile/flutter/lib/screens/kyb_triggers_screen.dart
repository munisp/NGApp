import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KybTriggersScreen extends StatelessWidget {
  const KybTriggersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'KYB Triggers',
      apiEndpoint: '/api/kyb/v1/triggers',
      columnKeys: const ['id', 'trigger', 'action', 'status'],
      columnLabels: const ['ID', 'Trigger', 'Action', 'Status'],
      seedData: const [
      {'id': 'KBT-001', 'trigger': 'Director Change', 'action': 'Re-verify', 'status': 'Active'},
    ],
    );
  }
}
