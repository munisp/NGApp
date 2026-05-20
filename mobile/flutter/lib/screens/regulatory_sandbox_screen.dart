import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class RegulatorySandboxScreen extends StatelessWidget {
  const RegulatorySandboxScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Regulatory Sandbox',
      apiEndpoint: '/api/production/missing-domains/list',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'REGULATORY_SANDBOX_SCREEN-001', 'status': 'active'},
        {'id': 'REGULATORY_SANDBOX_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
