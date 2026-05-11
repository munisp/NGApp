import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PgConnectionPoolsScreen extends StatelessWidget {
  const PgConnectionPoolsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Connection Pools',
      apiEndpoint: '/api/platform/postgres/connection-pools',
      columnKeys: const ['name', 'poolMode', 'activeConnections', 'totalQueriesPerSec', 'status'],
      columnLabels: const ['Name', 'Mode', 'Active', 'QPS', 'Status'],
      seedData: const [
              {'name': 'Primary', 'poolMode': 'transaction', 'activeConnections': '85', 'totalQueriesPerSec': '12500', 'status': 'healthy'},
      ],
    );
  }
}
