import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KycEventRulesScreen extends StatelessWidget {
  const KycEventRulesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'KYC Event Rules',
      apiEndpoint: '/api/kyc/v1/event-rules',
      columnKeys: const ['id', 'event', 'action', 'status'],
      columnLabels: const ['ID', 'Event', 'Action', 'Status'],
      seedData: const [
      {'id': 'KER-001', 'event': 'BVN Updated', 'action': 'Re-verify', 'status': 'Active'},
    ],
    );
  }
}
