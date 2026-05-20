import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class EmbeddedFinanceScreen extends StatelessWidget {
  const EmbeddedFinanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Embedded Finance',
      apiEndpoint: '/api/sdk/v1/partners',
      columnKeys: const ['id', 'name', 'industry', 'apiCalls', 'status'],
      columnLabels: const ['ID', 'Partner', 'Industry', 'API Calls', 'Status'],
      seedData: const [
      {'id': 'SDK-001', 'name': 'Jumia Nigeria', 'industry': 'E-Commerce', 'apiCalls': '2.5M', 'status': 'Active'},
    ],
    );
  }
}
