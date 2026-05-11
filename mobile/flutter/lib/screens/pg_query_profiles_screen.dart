import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PgQueryProfilesScreen extends StatelessWidget {
  const PgQueryProfilesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Query Profiles',
      apiEndpoint: '/api/platform/postgres/query-profiles',
      columnKeys: const ['id', 'table', 'avgExecutionMs', 'hitRatio', 'status'],
      columnLabels: const ['ID', 'Table', 'Avg ms', 'Hit Ratio', 'Status'],
      seedData: const [
              {'id': 'QP-001', 'table': 'accounts', 'avgExecutionMs': '0.8', 'hitRatio': '0.998', 'status': 'optimized'},
              {'id': 'QP-005', 'table': 'audit_trail', 'avgExecutionMs': '125.8', 'hitRatio': '0.167', 'status': 'critical'},
      ],
    );
  }
}
