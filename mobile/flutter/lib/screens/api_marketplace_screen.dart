import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ApiMarketplaceScreen extends StatelessWidget {
  const ApiMarketplaceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'API Marketplace',
      apiEndpoint: '/api/marketplace/v1/apis',
      columnKeys: const ['id', 'name', 'version', 'calls', 'status'],
      columnLabels: const ['ID', 'API', 'Version', 'Calls/Day', 'Status'],
      seedData: const [
      {'id': 'API-001', 'name': 'Account Inquiry', 'version': 'v2', 'calls': '450K', 'status': 'Active'},
    ],
    );
  }
}
