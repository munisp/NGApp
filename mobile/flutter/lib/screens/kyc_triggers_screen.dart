import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KycTriggersScreen extends StatelessWidget {
  const KycTriggersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'KYC Triggers',
      apiEndpoint: '/api/kyc/v1/triggers',
      columnKeys: const ['id', 'trigger', 'action', 'status'],
      columnLabels: const ['ID', 'Trigger', 'Action', 'Status'],
      seedData: const [
      {'id': 'KT-001', 'trigger': 'Transaction > 10M', 'action': 'EDD Review', 'status': 'Active'},
    ],
    );
  }
}
