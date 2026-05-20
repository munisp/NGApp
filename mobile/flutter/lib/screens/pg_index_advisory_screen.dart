import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PgIndexAdvisoryScreen extends StatelessWidget {
  const PgIndexAdvisoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Index Advisory',
      apiEndpoint: '/api/platform/postgres/index-advisories',
      columnKeys: const ['id', 'table', 'indexType', 'estimatedSpeedup', 'priority', 'status'],
      columnLabels: const ['ID', 'Table', 'Type', 'Speedup', 'Priority', 'Status'],
      seedData: const [
              {'id': 'IDX-001', 'table': 'audit_trail', 'indexType': 'btree', 'estimatedSpeedup': '25x', 'priority': 'critical', 'status': 'recommended'},
      ],
    );
  }
}
