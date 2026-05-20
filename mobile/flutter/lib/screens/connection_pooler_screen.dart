import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ConnectionPoolerScreen extends StatelessWidget {
  const ConnectionPoolerScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Connection Pooler',
      apiEndpoint: '/api/production/connection-pool/config',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'CONNECTION_POOLER_SCREEN-001', 'status': 'active'},
        {'id': 'CONNECTION_POOLER_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
