import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class RegulatoryAutomationScreen extends StatelessWidget {
  const RegulatoryAutomationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Regulatory Automation',
      apiEndpoint: '/api/regulatory-automation/v1/regulatory/returns',
      columnKeys: const ['id', 'name', 'framework', 'status'],
      columnLabels: const ['ID', 'Return', 'Framework', 'Status'],
      seedData: const [
      {'id': 'RA-001', 'name': 'eFASS Monthly', 'framework': 'CBN', 'status': 'Auto-Generated'},
    ],
    );
  }
}
