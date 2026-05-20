import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PgSlowQueriesScreen extends StatelessWidget {
  const PgSlowQueriesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Slow Queries',
      apiEndpoint: '/api/platform/postgres/slow-queries',
      columnKeys: const ['id', 'table', 'executionMs', 'planType', 'severity'],
      columnLabels: const ['ID', 'Table', 'Exec ms', 'Plan', 'Severity'],
      seedData: const [
              {'id': 'SQ-001', 'table': 'audit_trail', 'executionMs': '520', 'planType': 'Seq Scan', 'severity': 'critical'},
      ],
    );
  }
}
